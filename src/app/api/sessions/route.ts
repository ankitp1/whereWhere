import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { generateId, generateToken, hashSecret } from "@/lib/server/crypto";
import { SessionDocument, SessionPrivateMeta, Participant } from "@/types/session";

// In-memory sliding window IP rate limiter (Section 2.B: max 50 sessions/hr per IP)
const ipRequestTimestamps = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 50;

  const timestamps = (ipRequestTimestamps.get(ip) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return false;
  }
  timestamps.push(now);
  ipRequestTimestamps.set(ip, timestamps);
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a bit before creating another meetup." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      topic = "Meetup",
      expectedHeadcount,
      hostName,
      constraints = [],
      dateSlots = [],
      timeZone = "America/New_York",
    } = body;

    // Fix Item 2 & 4: Server builds participant state with random IDs to prevent collision and spoofing
    let rawNames: string[] = [];
    if (Array.isArray(body.participantNames) && body.participantNames.length > 0) {
      rawNames = body.participantNames;
    } else if (body.participants && typeof body.participants === "object") {
      rawNames = Object.values(body.participants)
        .map((p: any) => (typeof p === "string" ? p : p?.name))
        .filter(Boolean);
    }

    if (rawNames.length === 0) {
      rawNames = ["You", "Friend 1", "Friend 2", "Friend 3"];
    }

    const cleanHostName = (hostName || rawNames[0]).trim();
    const sanitizedParticipants: Record<string, Participant> = {};
    let organizerParticipantId = "";

    rawNames.forEach((name) => {
      const cleanName = name.trim();
      // Generate random unique ID so two friends with the same name never collide
      const pId = generateId("p", 6);
      const isHost = cleanName.toLowerCase() === cleanHostName.toLowerCase() && !organizerParticipantId;
      if (isHost) {
        organizerParticipantId = pId;
      }
      sanitizedParticipants[pId] = {
        name: cleanName,
        status: isHost ? "done" : "pending",
        isClaimed: isHost,
        vetoUsed: false,
        objectionUsed: false,
        acknowledgedLock: false,
        availableSlots: [],
        topPickVenueId: null,
        approvedVenueIds: [],
      };
    });

    if (!organizerParticipantId) {
      organizerParticipantId = Object.keys(sanitizedParticipants)[0];
      sanitizedParticipants[organizerParticipantId].isClaimed = true;
      sanitizedParticipants[organizerParticipantId].status = "done";
    }

    const sessionId = generateId("s", 8);
    const adminSecret = generateToken(16);
    const adminSecretHash = hashSecret(adminSecret);

    // Generate readable slug
    const cleanTopic =
      topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 24) || "meetup";
    const slugSuffix = generateId("", 6).replace("^_", "");
    const slug = `${cleanTopic}-${slugSuffix}`;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days TTL

    const sessionDoc: SessionDocument = {
      sessionId,
      slug,
      effortType: "meetup",
      status: "collecting",
      timeZone,
      createdAt: now.toISOString(),
      expiresAt,
      quorumRatio: 0.6,
      expectedHeadcount: Math.max(expectedHeadcount || 0, Object.keys(sanitizedParticipants).length),
      objectionWindowExpiresAt: null,
      organizerParticipantId,
      constraints,
      participants: sanitizedParticipants,
      options: {
        dateSlots,
        venues: [],
      },
      lockedPlan: null,
    };

    const privateMeta: SessionPrivateMeta = {
      adminSecretHash,
      organizerUid: "anon_organizer_" + sessionId,
      participantOwners: {
        [organizerParticipantId]: "anon_organizer_" + sessionId,
      },
      removedNames: [],
      apiUsage: {
        placesCalls: 0,
        geminiCalls: 0,
      },
      expiresAt,
    };

    await db.createSession(sessionDoc, privateMeta);
    await db.addAuditLog(sessionId, {
      id: generateId("ev", 8),
      type: "session_created",
      details: { topic, headcount: sessionDoc.expectedHeadcount },
      createdAt: now.toISOString(),
      expiresAt,
    });

    // Fix Item 1: Separate public share URL (NO SECRET) from private admin recovery link
    const publicShareUrl = `/s/${slug}`;
    const adminRecoveryUrl = `/s/${slug}#admin=${adminSecret}`;

    return NextResponse.json({
      sessionId,
      slug,
      adminSecret,
      publicShareUrl,
      adminRecoveryUrl,
      shareUrl: publicShareUrl, // Default share link is public with NO host key
      session: sessionDoc,
    });
  } catch (err: any) {
    console.error("Error creating session:", err);
    return NextResponse.json({ error: err.message || "Failed to create session" }, { status: 500 });
  }
}
