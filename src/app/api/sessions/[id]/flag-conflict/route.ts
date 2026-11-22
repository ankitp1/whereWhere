import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { generateId } from "@/lib/server/crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { participantId, reason } = await req.json();

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json({ error: "A 1-line reason is required" }, { status: 400 });
    }

    let session = await db.getSessionBySlug(id);
    if (!session) {
      session = await db.getSession(id);
    }
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "objection_window") {
      return NextResponse.json({ error: "Cannot flag conflict outside objection window" }, { status: 400 });
    }

    const participant = session.participants[participantId];
    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    if (participant.objectionUsed) {
      return NextResponse.json(
        { error: "You have already flagged a conflict for this lock cycle." },
        { status: 400 }
      );
    }

    const cleanReason = reason.trim().slice(0, 140);
    const now = new Date().toISOString();

    const updated = await db.updateSession(session.sessionId, (curr) => {
      const p = curr.participants[participantId];
      if (p) {
        p.objectionUsed = true;
      }
      curr.status = "collecting";
      curr.objectionWindowExpiresAt = null;

      if (!curr.lockedPlan) {
        curr.lockedPlan = {
          slotId: curr.options.dateSlots[0]?.id || "",
          exactTime: "19:30",
          venueId: curr.options.venues[0]?.id || "",
          bookerParticipantId: null,
          isBooked: false,
          lastObjection: null,
        };
      }

      curr.lockedPlan.lastObjection = {
        participantId,
        participantName: p ? p.name : "Someone",
        reason: cleanReason,
        timestamp: now,
      };

      return curr;
    });

    await db.addAuditLog(session.sessionId, {
      id: generateId("ev", 8),
      type: "conflict_flagged",
      actorId: participantId,
      details: { reason: cleanReason },
      createdAt: now,
      expiresAt: session.expiresAt,
    });

    return NextResponse.json({ session: updated });
  } catch (err: any) {
    console.error("Error flagging conflict:", err);
    return NextResponse.json({ error: err.message || "Failed to flag conflict" }, { status: 500 });
  }
}
