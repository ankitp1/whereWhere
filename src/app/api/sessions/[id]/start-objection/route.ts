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
      windowMode = "2_hours",
      customHours = 2,
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
    let objectionExpiresAt: string;

    if (windowMode === "overnight") {
      const target = new Date(now);
      target.setHours(10, 0, 0, 0);
      // Ensure at least 6 hours of overnight buffer
      if (target.getTime() <= now + 6 * 60 * 60 * 1000) {
        target.setDate(target.getDate() + 1);
      }
      objectionExpiresAt = target.toISOString();
    } else if (windowMode === "custom" && customHours && customHours > 0) {
      objectionExpiresAt = new Date(now + customHours * 60 * 60 * 1000).toISOString();
    } else {
      objectionExpiresAt = new Date(now + 2 * 60 * 60 * 1000).toISOString(); // Default 2 hours
    }

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
