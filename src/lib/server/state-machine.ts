import { SessionDocument, VenueOption, DateSlotOption } from "@/types/session";

export interface QuorumStatus {
  activeCount: number;
  requiredVotes: number;
  quorumHit: boolean;
  leadingSlot: DateSlotOption | null;
  slotVoteCounts: Record<string, number>;
}

export function computeQuorum(session: SessionDocument): QuorumStatus {
  const activeParticipants = Object.values(session.participants).filter(
    (p) => p.status !== "dropped_out"
  );
  const activeCount = Math.max(activeParticipants.length, 1);
  const ratio = session.quorumRatio || 0.6;
  const requiredVotes = Math.ceil(activeCount * ratio);

  const slotVoteCounts: Record<string, number> = {};
  session.options.dateSlots.forEach((slot) => {
    slotVoteCounts[slot.id] = 0;
  });

  activeParticipants.forEach((p) => {
    if (p.status === "done" && p.availableSlots) {
      p.availableSlots.forEach((slotId) => {
        if (slotVoteCounts[slotId] !== undefined) {
          slotVoteCounts[slotId]++;
        }
      });
    }
  });

  let quorumHit = false;
  let leadingSlot: DateSlotOption | null = null;
  let maxVotes = -1;

  session.options.dateSlots.forEach((slot) => {
    // If vetoed, it cannot lead
    if (slot.vetoedBy) return;

    const count = slotVoteCounts[slot.id] || 0;
    if (count >= requiredVotes) {
      quorumHit = true;
    }
    if (count > maxVotes) {
      maxVotes = count;
      leadingSlot = slot;
    }
  });

  return {
    activeCount,
    requiredVotes,
    quorumHit,
    leadingSlot,
    slotVoteCounts,
  };
}

export interface VenueScoreResult {
  venue: VenueOption;
  topPickVotes: number;
  approvedVotes: number;
  totalScore: number;
  isDisqualified: boolean;
}

export function computeVenueScores(session: SessionDocument): VenueScoreResult[] {
  const activeParticipants = Object.values(session.participants).filter(
    (p) => p.status !== "dropped_out"
  );

  return session.options.venues.map((venue) => {
    const isDisqualified = !!venue.disqualifiedReason;
    let topPickVotes = 0;
    let approvedVotes = 0;

    if (!isDisqualified) {
      activeParticipants.forEach((p) => {
        if (p.topPickVenueId === venue.id) {
          topPickVotes++;
        } else if (p.approvedVenueIds && p.approvedVenueIds.includes(venue.id)) {
          approvedVotes++;
        }
      });
    }

    const totalScore = isDisqualified ? -1 : topPickVotes * 2 + approvedVotes;

    return {
      venue,
      topPickVotes,
      approvedVotes,
      totalScore,
      isDisqualified,
    };
  }).sort((a, b) => b.totalScore - a.totalScore);
}

export function checkObjectionWindowCompletion(session: SessionDocument): boolean {
  if (session.status !== "objection_window") return false;

  const activeParticipants = Object.values(session.participants).filter(
    (p) => p.status !== "dropped_out"
  );

  if (activeParticipants.length === 0) return true;

  // Check if 100% have acknowledged lock
  const allAcknowledged = activeParticipants.every((p) => p.acknowledgedLock);
  if (allAcknowledged) return true;

  // Check if 2-hour window has expired
  if (session.objectionWindowExpiresAt) {
    const expires = new Date(session.objectionWindowExpiresAt).getTime();
    if (Date.now() >= expires) return true;
  }

  return false;
}
