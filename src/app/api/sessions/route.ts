import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { generateId, generateToken, hashSecret } from "@/lib/server/crypto";
import { SessionDocument, SessionPrivateMeta } from "@/types/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      topic = "Meetup",
      expectedHeadcount = 8,
      participants = {},
      constraints = [],
      dateSlots = [],
      timeZone = "America/New_York",
    } = body;

    const sessionId = generateId("s", 8);
    const adminSecret = generateToken(16);
    const adminSecretHash = hashSecret(adminSecret);

    // Generate readable slug
    const cleanTopic = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 24) || "meetup";
    const slugSuffix = generateId("", 6).replace("^_", "");
    const slug = `${cleanTopic}-${slugSuffix}`;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days TTL

    const organizerParticipantId = Object.keys(participants)[0] || "p_organizer";

    const sessionDoc: SessionDocument = {
      sessionId,
      slug,
      effortType: "meetup",
      status: "collecting",
      timeZone,
      createdAt: now.toISOString(),
      expiresAt,
      quorumRatio: 0.6,
      expectedHeadcount: Math.max(expectedHeadcount, Object.keys(participants).length),
      objectionWindowExpiresAt: null,
      organizerParticipantId,
      constraints,
      participants,
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
      details: { topic, headcount: expectedHeadcount },
      createdAt: now.toISOString(),
      expiresAt,
    });

    return NextResponse.json({
      sessionId,
      slug,
      adminSecret,
      shareUrl: `/s/${slug}#admin=${adminSecret}`,
      session: sessionDoc,
    });
  } catch (err: any) {
    console.error("Error creating session:", err);
    return NextResponse.json({ error: err.message || "Failed to create session" }, { status: 500 });
  }
}
