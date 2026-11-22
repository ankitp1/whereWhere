export type SessionStatus = "clarifying" | "collecting" | "objection_window" | "locked";

export type ParticipantStatus = "pending" | "done" | "dropped_out";

export interface ConstraintItem {
  id: string;
  type: "excluded_day" | "dietary" | "area" | "vibe" | "kid_friendly" | "other";
  label: string;
  confirmed: boolean;
}

export interface Participant {
  name: string;
  status: ParticipantStatus;
  isClaimed: boolean;
  vetoUsed: boolean;
  objectionUsed: boolean;
  acknowledgedLock: boolean;
  availableSlots: string[];
  topPickVenueId: string | null;
  approvedVenueIds: string[];
  customVenueSuggestion?: string | null;
}

export interface DateSlotOption {
  id: string;
  label: string;
  date?: string; // YYYY-MM-DD
  timeWindow?: "dinner" | "lunch" | "brunch" | "drinks" | "custom";
  vetoedBy: string | null; // participantId or null
}

export interface VenueOption {
  id: string;
  placeId: string;
  name: string;
  rating?: number;
  priceLevel?: string;
  address?: string;
  mapsUrl?: string;
  inferredTags: string[];
  disqualifiedReason: string | null;
  suggestedBy?: string | null; // participantId or null
}

export interface LockedPlan {
  slotId: string;
  exactTime: string; // e.g. "19:30"
  venueId: string;
  bookerParticipantId: string | null;
  isBooked: boolean;
  lastObjection: {
    participantId: string;
    participantName: string;
    reason: string;
    timestamp: string;
  } | null;
}

export interface SessionDocument {
  sessionId: string;
  slug: string;
  effortType: "meetup";
  status: SessionStatus;
  timeZone: string;
  createdAt: string;
  expiresAt: string;
  quorumRatio: number; // default 0.6
  expectedHeadcount: number;
  objectionWindowExpiresAt: string | null;
  organizerParticipantId: string;
  constraints: ConstraintItem[];
  participants: Record<string, Participant>;
  options: {
    dateSlots: DateSlotOption[];
    venues: VenueOption[];
  };
  lockedPlan: LockedPlan | null;
}

export interface SessionPrivateMeta {
  adminSecretHash: string;
  organizerUid: string;
  participantOwners: Record<string, string>; // participantId -> clientUid
  removedNames: string[];
  apiUsage: {
    placesCalls: number;
    geminiCalls: number;
  };
  expiresAt: string;
}

export interface AuditLogEvent {
  id: string;
  type:
    | "session_created"
    | "vote_submitted"
    | "veto_used"
    | "participant_joined"
    | "participant_removed"
    | "objection_started"
    | "objection_acknowledged"
    | "conflict_flagged"
    | "plan_locked"
    | "venue_booked_toggled"
    | "drop_out_toggled";
  actorId?: string;
  details: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
}

export interface NudgeRecord {
  id: string;
  targetParticipantId: string;
  senderParticipantId: string;
  createdAt: string;
  expiresAt: string;
}
