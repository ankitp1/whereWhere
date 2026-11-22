import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { computeQuorum, computeVenueScores } from "@/lib/server/state-machine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const {
      adminToken,
      exactTime = "19:30",
      bookerParticipantId = null,
      slotId = null,
      venueId = null,
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

    // Determine leading slot and venue if not specified
    let targetSlotId = slotId;
    if (!targetSlotId) {
      const quorum = computeQuorum(session);
      targetSlotId = quorum.leadingSlot?.id || session.options.dateSlots[0]?.id;
    }

    let targetVenueId = venueId;
    if (!targetVenueId) {
      const rankedVenues = computeVenueScores(session);
      const topVenue = rankedVenues.find((r) => !r.isDisqualified)?.venue;
      targetVenueId = topVenue?.id || session.options.venues[0]?.id || "";
    }

    const now = Date.now();
    const objectionExpiresAt = new Date(now + 2 * 60 * 60 * 1000).toISOString(); // 2 hours

    const updated = await db.updateSession(session.sessionId, (curr) => {
      curr.status = "objection_window";
      curr.objectionWindowExpiresAt = objectionExpiresAt;
      curr.lockedPlan = {
        slotId: targetSlotId,
        exactTime,
        venueId: targetVenueId,
        bookerParticipantId,
        isBooked: false,
        lastObjection: null,
      };

      // Reset acknowledgedLock on active participants for this lock cycle
      Object.values(curr.participants).forEach((p) => {
        p.acknowledgedLock = false;
        p.objectionUsed = false; // Reset for this cycle
      });

      return curr;
    });

    return NextResponse.json({ session: updated });
  } catch (err: any) {
    console.error("Error starting objection window:", err);
    return NextResponse.json({ error: err.message || "Failed to start objection window" }, { status: 500 });
  }
}
