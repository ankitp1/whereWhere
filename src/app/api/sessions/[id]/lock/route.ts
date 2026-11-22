import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { generateId } from "@/lib/server/crypto";
import { computeQuorum, computeVenueScores } from "@/lib/server/state-machine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const {
      adminToken,
      slotId = null,
      venueId = null,
      exactTime = null,
      bookerParticipantId = null,
    } = await req.json();

    let session = await db.getSessionBySlug(id);
    if (!session) {
      session = await db.getSession(id);
    }
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isAdmin = await db.verifyAdmin(session.sessionId, adminToken);
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Determine target slot and venue
    let targetSlotId = slotId || session.lockedPlan?.slotId;
    if (!targetSlotId) {
      const quorum = computeQuorum(session);
      targetSlotId = quorum.leadingSlot?.id || session.options.dateSlots[0]?.id || "";
    }

    let targetVenueId = venueId || session.lockedPlan?.venueId;
    if (!targetVenueId) {
      const rankedVenues = computeVenueScores(session);
      const topVenue = rankedVenues.find((r) => !r.isDisqualified)?.venue;
      targetVenueId = topVenue?.id || session.options.venues[0]?.id || "";
    }

    const time = exactTime || session.lockedPlan?.exactTime || "19:30";
    const booker = bookerParticipantId !== undefined ? bookerParticipantId : session.lockedPlan?.bookerParticipantId || null;

    const updated = await db.updateSession(session.sessionId, (curr) => {
      curr.status = "locked";
      curr.objectionWindowExpiresAt = null;
      curr.lockedPlan = {
        slotId: targetSlotId,
        exactTime: time,
        venueId: targetVenueId,
        bookerParticipantId: booker,
        isBooked: curr.lockedPlan?.isBooked || false,
        lastObjection: null,
      };
      return curr;
    });

    await db.addAuditLog(session.sessionId, {
      id: generateId("ev", 8),
      type: "plan_locked",
      details: { targetSlotId, targetVenueId, time, booker },
      createdAt: new Date().toISOString(),
      expiresAt: session.expiresAt,
    });

    return NextResponse.json({ session: updated });
  } catch (err: any) {
    console.error("Error locking session:", err);
    return NextResponse.json({ error: err.message || "Failed to lock session" }, { status: 500 });
  }
}
