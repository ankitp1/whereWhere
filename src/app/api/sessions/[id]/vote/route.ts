import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { computeQuorum } from "@/lib/server/state-machine";
import { findGroundedVenues } from "@/lib/server/places";
import { generateId } from "@/lib/server/crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      participantId,
      availableSlots = [],
      topPickVenueId = null,
      approvedVenueIds = [],
      vetoSlotId = null,
      vetoVenueId = null,
      vetoReason = null,
    } = body;

    let session = await db.getSessionBySlug(id);
    if (!session) {
      session = await db.getSession(id);
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status === "objection_window" || session.status === "locked") {
      return NextResponse.json(
        { error: `Voting is closed during ${session.status}` },
        { status: 400 }
      );
    }

    const participant = session.participants[participantId];
    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    // Check veto usage: 1 shared token per participant across session
    let willUseVeto = false;
    if (vetoSlotId || vetoVenueId) {
      if (participant.vetoUsed) {
        return NextResponse.json(
          { error: "You have already spent your 1 Veto Token for this session." },
          { status: 400 }
        );
      }
      willUseVeto = true;
    }

    const updated = await db.updateSession(session.sessionId, (curr) => {
      const p = curr.participants[participantId];
      if (!p) return curr;

      p.availableSlots = availableSlots;
      p.topPickVenueId = topPickVenueId;
      p.approvedVenueIds = approvedVenueIds;
      p.status = "done";
      p.isClaimed = true;

      // Apply veto if requested
      if (willUseVeto) {
        p.vetoUsed = true;
        const reasonSuffix = vetoReason && typeof vetoReason === "string" && vetoReason.trim()
          ? ` (${vetoReason.trim()})`
          : "";

        if (vetoSlotId) {
          const slot = curr.options.dateSlots.find((s) => s.id === vetoSlotId);
          if (slot) {
            slot.vetoedBy = `${p.name}${reasonSuffix}`;
          }
        }
        if (vetoVenueId) {
          const venue = curr.options.venues.find((v) => v.id === vetoVenueId);
          if (venue) {
            venue.disqualifiedReason = `Vetoed by ${p.name}${reasonSuffix}`;
          }
        }
      }

      return curr;
    });

    // Check if quorum was hit and venues need to be generated
    const quorum = computeQuorum(updated);
    if (quorum.quorumHit && updated.options.venues.length === 0) {
      const areaConstraint = updated.constraints.find((c) => c.type === "area");
      const areaName = areaConstraint ? areaConstraint.label : "Midtown";
      const venues = await findGroundedVenues(areaName, updated.constraints);

      await db.updateSession(updated.sessionId, (curr) => {
        curr.options.venues = venues;
        return curr;
      });

      await db.addAuditLog(updated.sessionId, {
        id: generateId("ev", 8),
        type: "vote_submitted",
        actorId: participantId,
        details: { quorumHit: true, venuesCount: venues.length },
        createdAt: new Date().toISOString(),
        expiresAt: updated.expiresAt,
      });
    }

    const finalSession = (await db.getSession(session.sessionId)) || updated;
    return NextResponse.json({ session: finalSession });
  } catch (err: any) {
    console.error("Error submitting vote:", err);
    return NextResponse.json({ error: err.message || "Failed to submit vote" }, { status: 500 });
  }
}
