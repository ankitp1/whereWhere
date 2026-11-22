import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { generateId } from "@/lib/server/crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();

    let session = await db.getSessionBySlug(id);
    if (!session) {
      session = await db.getSession(id);
    }
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check removedNames in private meta to prevent rejoin trolling
    const meta = await db.getPrivateMeta(session.sessionId);
    if (meta && meta.removedNames) {
      const isBlocked = meta.removedNames.some(
        (rn) => rn.toLowerCase() === trimmedName.toLowerCase()
      );
      if (isBlocked) {
        return NextResponse.json(
          { error: "This name has been removed by the organizer." },
          { status: 403 }
        );
      }
    }

    // Check if participant name already exists
    const existing = Object.values(session.participants).find(
      (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existing) {
      return NextResponse.json({
        message: "Participant already exists",
        session,
        participantId: Object.keys(session.participants).find(
          (k) => session.participants[k].name.toLowerCase() === trimmedName.toLowerCase()
        ),
      });
    }

    const newId = generateId("p_" + trimmedName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6));

    const updated = await db.updateSession(session.sessionId, (curr) => {
      curr.participants[newId] = {
        name: trimmedName,
        status: "pending",
        isClaimed: true,
        vetoUsed: false,
        objectionUsed: false,
        acknowledgedLock: false,
        availableSlots: [],
        topPickVenueId: null,
        approvedVenueIds: [],
      };
      curr.expectedHeadcount = Math.max(curr.expectedHeadcount, Object.keys(curr.participants).length);
      return curr;
    });

    return NextResponse.json({ session: updated, participantId: newId });
  } catch (err: any) {
    console.error("Error joining session:", err);
    return NextResponse.json({ error: err.message || "Failed to join" }, { status: 500 });
  }
}
