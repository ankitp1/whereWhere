"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Share2,
  Copy,
  Check,
  Star,
  ThumbsUp,
  Ban,
  Plus,
  Compass,
  ArrowRight,
  ExternalLink,
  Download,
  Info,
  Sparkles,
  ChevronRight,
  X,
  MessageSquare,
  Shield,
  HelpCircle,
  Flame,
  Utensils,
  RefreshCw,
} from "lucide-react";
import {
  SessionDocument,
  Participant,
  DateSlotOption,
  VenueOption,
} from "@/types/session";
import {
  computeQuorum,
  computeVenueScores,
  VenueScoreResult,
} from "@/lib/server/state-machine";
import { formatTime24to12 } from "@/lib/utils";

interface SessionViewProps {
  slug: string;
}

const AVATAR_COLORS = [
  "from-emerald-500 to-teal-600",
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-red-600",
  "from-cyan-500 to-blue-600",
];

const CUISINE_EMOJIS: Record<string, string> = {
  indian: "🍛",
  italian: "🍝",
  pizza: "🍕",
  plant: "🥗",
  asian: "🥢",
  japanese: "🍣",
  mexican: "🌮",
  burger: "🍔",
  bar: "🍸",
  cafe: "☕",
};

function getVenueEmoji(name: string, tags: string[]): string {
  const combined = (name + " " + tags.join(" ")).toLowerCase();
  for (const [key, emoji] of Object.entries(CUISINE_EMOJIS)) {
    if (combined.includes(key)) return emoji;
  }
  return "🍽️";
}

export default function SessionView({ slug }: SessionViewProps) {
  const [session, setSession] = useState<SessionDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Identity and Admin State
  const [currentParticipantId, setCurrentParticipantId] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Friend Flow Stage: "who" (F1) -> "when" (F2) -> "where" (F3) -> "done" (F4)
  const [friendStep, setFriendStep] = useState<"who" | "when" | "where" | "done">("who");

  // Local Vote State
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [topPickVenue, setTopPickVenue] = useState<string | null>(null);
  const [approvedVenues, setApprovedVenues] = useState<string[]>([]);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);

  // Modals
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newJoinName, setNewJoinName] = useState("");
  const [showVetoConfirm, setShowVetoConfirm] = useState<{
    type: "slot" | "venue";
    id: string;
    label: string;
  } | null>(null);
  const [vetoReason, setVetoReason] = useState("");
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictReason, setConflictReason] = useState("");
  const [showCustomVenueModal, setShowCustomVenueModal] = useState(false);
  const [customVenueName, setCustomVenueName] = useState("");
  const [showStartObjectionModal, setShowStartObjectionModal] = useState(false);
  const [objectionTime, setObjectionTime] = useState("19:30");
  const [objectionBooker, setObjectionBooker] = useState<string>("");
  const [objectionMode, setObjectionMode] = useState<"2_hours" | "overnight">("2_hours");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [nudgeModalData, setNudgeModalData] = useState<{
    name: string;
    message: string;
  } | null>(null);

  // Countdown for objection window
  const [timeLeftStr, setTimeLeftStr] = useState<string>("");

  // 1. Fetch Session Data
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${slug}`);
      if (!res.ok) throw new Error("Meetup not found");
      const data = await res.json();
      setSession(data.session);
    } catch (err: any) {
      setError(err.message || "Failed to load meetup");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // Initial load and polling every 4s
  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 4000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  // 2. Read Fragment for Admin Key & Target Participant
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    let targetPFromHash: string | null = null;

    if (hash) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const secret = params.get("admin");
      targetPFromHash = params.get("p");

      if (targetPFromHash) {
        setCurrentParticipantId(targetPFromHash);
        try {
          localStorage.setItem(`syncup_participant_${slug}`, targetPFromHash);
        } catch (e) {}
      }

      if (secret) {
        setAdminToken(secret);
        fetch(`/api/sessions/${slug}/claim-admin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: secret }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.isAdmin) {
              setIsAdmin(true);
              sessionStorage.setItem(`admin_${slug}`, secret);
            }
          })
          .catch((err) => console.error("Admin claim failed:", err));
      }

      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", cleanUrl);
    } else {
      const savedAdmin = sessionStorage.getItem(`admin_${slug}`);
      if (savedAdmin) {
        setAdminToken(savedAdmin);
        setIsAdmin(true);
      }
    }

    if (!targetPFromHash) {
      try {
        const savedP = localStorage.getItem(`syncup_participant_${slug}`);
        if (savedP) {
          setCurrentParticipantId(savedP);
        }
      } catch (e) {}
    }
  }, [slug]);

  // When participant identity is known, set initial friend step
  useEffect(() => {
    if (!currentParticipantId) {
      setFriendStep("who");
    } else if (session && currentParticipantId) {
      const p = session.participants[currentParticipantId];
      if (p) {
        setSelectedSlots(p.availableSlots || []);
        setTopPickVenue(p.topPickVenueId || null);
        setApprovedVenues(p.approvedVenueIds || []);
        if (p.status === "done" && friendStep === "who") {
          setFriendStep("done");
        } else if (friendStep === "who") {
          setFriendStep("when");
        }
      }
    }
  }, [session, currentParticipantId]);

  // Objection Window Countdown
  useEffect(() => {
    if (!session?.objectionWindowExpiresAt || session.status !== "objection_window") {
      setTimeLeftStr("");
      return;
    }

    const updateTimer = () => {
      const expires = new Date(session.objectionWindowExpiresAt!).getTime();
      const now = Date.now();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeftStr("00:00 - Locking in...");
        fetchSession();
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeftStr(
          `${hours > 0 ? hours + "h " : ""}${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`
        );
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [session, fetchSession]);

  // Computed state machine metrics
  const quorum = useMemo(() => {
    if (!session) return null;
    return computeQuorum(session);
  }, [session]);

  const venueScores = useMemo(() => {
    if (!session) return [];
    return computeVenueScores(session);
  }, [session]);

  const currentParticipant =
    currentParticipantId && session?.participants
      ? session.participants[currentParticipantId] || null
      : null;

  const hostParticipant =
    session && session.organizerParticipantId
      ? session.participants[session.organizerParticipantId]
      : null;

  const displayTitle = session ? session.slug.replace(/-[a-z0-9]+$/i, "").replace(/-/g, " ") : "Meetup";

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // 1-Tap Share to Group Chat
  const handleShareUpdate = async (type: "invite" | "quorum" | "objection" | "locked") => {
    if (!session) return;
    const url = window.location.origin + `/s/${session.slug}`;
    let copyText = "";

    const winningSlot = session.options.dateSlots.find(
      (s) => s.id === (session.lockedPlan?.slotId || quorum?.leadingSlot?.id)
    );
    const winningVenue = session.options.venues.find(
      (v) => v.id === (session.lockedPlan?.venueId || venueScores[0]?.venue?.id)
    );

    if (type === "invite") {
      copyText = `Hey crew—vote on dates & spots on WhenWhere (takes 10 sec, no login): ${url}`;
    } else if (type === "quorum") {
      copyText = `🎉 Quorum reached for ${winningSlot?.label || "our meetup"}! Vote on the final spot here: ${url}`;
    } else if (type === "objection") {
      const timeStr = formatTime24to12(session.lockedPlan?.exactTime || "19:30");
      copyText = `⏳ Locking ${winningSlot?.label || "date"} @ ${timeStr} at ${winningVenue?.name || "top spot"} in 2 hours—flag any conflicts now: ${url}`;
    } else if (type === "locked") {
      const timeStr = formatTime24to12(session.lockedPlan?.exactTime || "19:30");
      copyText = `✅ Locked! ${winningSlot?.label || "Date"} @ ${timeStr} at ${winningVenue?.name || "venue"}. Map & calendar invite: ${url}`;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: "WhenWhere",
          text: copyText,
          url,
        });
        return;
      } catch (e) {}
    }
    handleCopy(copyText, "share_banner");
  };

  // F1: Identity selection handler
  const handleSelectIdentity = (pId: string) => {
    setCurrentParticipantId(pId);
    try {
      localStorage.setItem(`syncup_participant_${slug}`, pId);
    } catch (e) {}
    const p = session?.participants[pId];
    if (p && p.status === "done") {
      setFriendStep("done");
    } else {
      setFriendStep("when");
    }
  };

  // Switch identity
  const handleSwitchIdentity = () => {
    setCurrentParticipantId(null);
    setFriendStep("who");
    try {
      localStorage.removeItem(`syncup_participant_${slug}`);
    } catch (e) {}
  };

  // Vote Actions
  const toggleSlotAvailability = (slotId: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    );
  };

  const handleVenueVote = (venueId: string, type: "topPick" | "approved") => {
    if (type === "topPick") {
      if (topPickVenue === venueId) {
        setTopPickVenue(null);
      } else {
        setTopPickVenue(venueId);
        if (!approvedVenues.includes(venueId)) {
          setApprovedVenues((prev) => [...prev, venueId]);
        }
      }
    } else {
      if (approvedVenues.includes(venueId)) {
        setApprovedVenues((prev) => prev.filter((id) => id !== venueId));
        if (topPickVenue === venueId) {
          setTopPickVenue(null);
        }
      } else {
        setApprovedVenues((prev) => [...prev, venueId]);
      }
    }
  };

  // Submit votes and move to F4 (Done)
  const submitVote = async (vetoSlotId?: string, vetoVenueId?: string, reason?: string) => {
    if (!session || !currentParticipantId) return;
    setIsSubmittingVote(true);
    try {
      const res = await fetch(`/api/sessions/${slug}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: currentParticipantId,
          availableSlots: selectedSlots,
          topPickVenueId: topPickVenue,
          approvedVenueIds: approvedVenues,
          vetoSlotId,
          vetoVenueId,
          vetoReason: reason || vetoReason || undefined,
        }),
      });
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        setShowVetoConfirm(null);
        setVetoReason("");
        setFriendStep("done");
        handleCopy("Votes saved!", "save_feedback");
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err: any) {
      alert("Failed to submit vote");
    } finally {
      setIsSubmittingVote(false);
    }
  };

  // Join action for unlisted friend
  const handleJoin = async () => {
    if (!newJoinName.trim() || !session) return;
    try {
      const res = await fetch(`/api/sessions/${slug}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newJoinName.trim() }),
      });
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        setCurrentParticipantId(data.participantId);
        try {
          localStorage.setItem(`syncup_participant_${slug}`, data.participantId);
        } catch (e) {}
        setShowJoinModal(false);
        setNewJoinName("");
        setFriendStep("when");
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      alert("Failed to join");
    }
  };

  // Start Objection Window (Host)
  const handleStartObjection = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/sessions/${slug}/start-objection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminToken,
          exactTime: objectionTime,
          bookerParticipantId: objectionBooker || null,
          windowMode: objectionMode,
        }),
      });
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        setShowStartObjectionModal(false);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      alert("Failed to start objection window");
    }
  };

  // Flag Conflict
  const handleFlagConflict = async () => {
    if (!conflictReason.trim() || !currentParticipantId) return;
    try {
      const res = await fetch(`/api/sessions/${slug}/flag-conflict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: currentParticipantId,
          reason: conflictReason.trim(),
        }),
      });
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        setShowConflictModal(false);
        setConflictReason("");
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      alert("Failed to flag conflict");
    }
  };

  // Force Lock / Finalize Now (Host)
  const handleLockNow = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/sessions/${slug}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminToken }),
      });
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
      }
    } catch (err) {
      alert("Failed to finalize plan");
    }
  };

  // Toggle Booked
  const handleToggleBooked = async () => {
    try {
      const res = await fetch(`/api/sessions/${slug}/toggle-booked`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
      }
    } catch (err) {
      alert("Failed to toggle booked");
    }
  };

  // Drop Out toggle
  const handleToggleDropOut = async () => {
    if (!currentParticipantId) return;
    try {
      const res = await fetch(`/api/sessions/${slug}/toggle-drop-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: currentParticipantId }),
      });
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
      }
    } catch (err) {
      alert("Failed to toggle status");
    }
  };

  // Generate Witty Nudge for an unvoted participant
  const handleNudge = async (targetId: string) => {
    try {
      const res = await fetch(`/api/sessions/${slug}/nudge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetParticipantId: targetId,
          senderParticipantId: currentParticipantId,
        }),
      });
      const data = await res.json();
      if (data.message) {
        setNudgeModalData({
          name: data.targetName,
          message: data.message,
        });
      }
    } catch (err) {
      alert("Failed to create nudge");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-3xl bg-emerald-500/10 flex items-center justify-center mb-3">
          <div className="w-6 h-6 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-bold text-slate-800 tracking-tight">Syncing WhenWhere...</p>
        <p className="text-xs text-slate-400 mt-0.5">Connecting to live group votes</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
        <h2 className="text-lg font-black text-slate-900">Meetup Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">{error || "This link may have expired or is invalid."}</p>
        <button
          onClick={() => (window.location.href = "/")}
          className="mt-5 px-5 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold"
        >
          Create a New Meetup
        </button>
      </div>
    );
  }

  const activeParticipantsList = Object.entries(session.participants).filter(
    ([_, p]) => p.status !== "dropped_out"
  );
  const pendingParticipants = activeParticipantsList.filter(([_, p]) => p.status === "pending");
  const doneParticipants = activeParticipantsList.filter(([_, p]) => p.status === "done");

  const isCollecting = session.status === "collecting";
  const isObjectionWindow = session.status === "objection_window";
  const isLocked = session.status === "locked";

  const leadingSlot = quorum?.leadingSlot;
  const topRankedVenue = venueScores.find((r) => !r.isDisqualified)?.venue;

  // Render F5 (Final Plan) if room is locked
  if (isLocked) {
    const finalSlot = session.options.dateSlots.find((s) => s.id === session.lockedPlan?.slotId);
    const finalVenue = session.options.venues.find((v) => v.id === session.lockedPlan?.venueId);
    const booker = session.lockedPlan?.bookerParticipantId
      ? session.participants[session.lockedPlan.bookerParticipantId]?.name
      : "Anyone in the group";

    return (
      <div className="flex-1 flex flex-col justify-between p-5 min-h-screen animate-fade-in">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] bg-emerald-100 text-emerald-900 font-black px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Plan Confirmed & Locked</span>
            </span>
            <button
              onClick={() => handleShareUpdate("locked")}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-xl"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
            It's On! We're meeting up.
          </h1>

          {/* F5. Final Plan Wallet Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[32px] p-6 shadow-2xl border border-slate-700 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider font-mono text-emerald-400 block mb-1">
                  When
                </span>
                <strong className="text-xl font-black text-white block">
                  {finalSlot?.label.split(" • ")[0] || "Confirmed Date"}
                </strong>
                <span className="text-sm text-slate-300 font-bold">
                  @ {formatTime24to12(session.lockedPlan?.exactTime || "19:30")}
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-2xl">
                {finalVenue ? getVenueEmoji(finalVenue.name, finalVenue.inferredTags) : "🍽️"}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700/80">
              <span className="text-xs uppercase tracking-wider font-mono text-emerald-400 block mb-1">
                Where
              </span>
              <strong className="text-lg font-black text-white block">
                {finalVenue?.name || "Confirmed Spot"}
              </strong>
              {finalVenue?.address && (
                <p className="text-xs text-slate-400 mt-0.5">{finalVenue.address}</p>
              )}

              {finalVenue?.mapsUrl && (
                <a
                  href={finalVenue.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:underline"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Open in Google Maps →</span>
                </a>
              )}
            </div>

            {/* Table booking status */}
            <div className="pt-4 border-t border-slate-700/80 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Table Booking</span>
                <strong className="text-slate-200 font-bold">
                  Owner: {booker}
                </strong>
              </div>
              <button
                onClick={handleToggleBooked}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 ${
                  session.lockedPlan?.isBooked
                    ? "bg-emerald-500 text-white shadow-xs"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {session.lockedPlan?.isBooked ? "Table Booked ✓" : "Mark as Booked"}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-6 space-y-2.5">
          <a
            href={`/api/sessions/${slug}/ics`}
            download
            className="w-full py-4 px-5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Add to Calendar (.ics)</span>
          </a>

          <button
            onClick={() => handleShareUpdate("locked")}
            className="w-full py-3.5 px-5 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition"
          >
            <Share2 className="w-4 h-4 text-emerald-700" />
            <span>Share Plan to WhatsApp / iMessage</span>
          </button>

          {currentParticipant && (
            <div className="text-center pt-1">
              <button
                onClick={handleToggleDropOut}
                className="text-[11px] text-slate-400 hover:text-red-500 transition font-medium underline"
              >
                {currentParticipant.status === "dropped_out" ? "You dropped out (Rejoin)" : "I can't make it anymore"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========================================================
  // O4. ORGANIZER DASHBOARD (WHEN HOST OPENS THE ROOM)
  // ========================================================
  if (isAdmin) {
    return (
      <div className="flex-1 flex flex-col justify-between p-5 min-h-screen animate-fade-in space-y-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] bg-amber-50 text-amber-900 font-black px-2.5 py-1 rounded-full border border-amber-300 flex items-center gap-1">
              <Shield className="w-3 h-3 text-amber-700" />
              <span>Organizer Dashboard</span>
            </span>
            <button
              onClick={() => handleShareUpdate(isObjectionWindow ? "objection" : "invite")}
              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight capitalize">
              {displayTitle}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Host: {hostParticipant?.name || "You"} · Quorum: {quorum?.requiredVotes} votes needed
            </p>
          </div>

          {/* Progress Bar (X of Y replied) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <strong className="text-slate-900 font-bold">
                {doneParticipants.length} of {activeParticipantsList.length} replied
              </strong>
              <span className={`font-black ${quorum?.quorumHit ? "text-emerald-600" : "text-amber-600"}`}>
                {quorum?.quorumHit ? "Quorum Reached ✓" : `Need ${quorum?.requiredVotes} to lock`}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (doneParticipants.length / (quorum?.requiredVotes || 1)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Objection window active banner */}
          {isObjectionWindow && (
            <div className="bg-amber-500 text-white rounded-2xl p-4 shadow-md space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black flex items-center gap-1.5 text-sm">
                  <Clock className="w-4 h-4" />
                  Objection Window: {timeLeftStr}
                </span>
              </div>
              <p className="text-[11px] text-amber-100">
                Locking automatically when countdown expires.
              </p>
            </div>
          )}

          {/* Conflict flagged alert */}
          {session.lockedPlan?.lastObjection && (
            <div className="bg-red-50 border border-red-300 rounded-2xl p-3.5 text-xs text-red-950 space-y-1">
              <span className="font-bold flex items-center gap-1 text-red-900">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Conflict by {session.lockedPlan.lastObjection.participantName}
              </span>
              <p className="italic text-red-800">"{session.lockedPlan.lastObjection.reason}"</p>
            </div>
          )}

          {/* LEADING PLAN CARD */}
          <div className="bg-white border-2 border-slate-900 rounded-[28px] p-4 shadow-sm space-y-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">
              Leading Plan
            </span>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <strong className="text-base font-black text-slate-900">
                  {leadingSlot?.label.split(" • ")[0] || "Dates in progress"}
                </strong>
                <span className="text-xs font-bold text-slate-500">
                  {leadingSlot ? `${quorum?.slotVoteCounts[leadingSlot.id] || 0} can go` : ""}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Top spot: {topRankedVenue ? `${topRankedVenue.name} (★ ${topRankedVenue.rating || 4.5})` : "Grounded spots auto-loading"}
              </p>
            </div>
          </div>

          {/* WAITING ON CREW */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Waiting on:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {pendingParticipants.map(([id, p]) => (
                <button
                  key={id}
                  onClick={() => handleNudge(id)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shadow-2xs"
                >
                  <span>{p.name}</span>
                  <span className="text-[10px] text-amber-600">Nudge</span>
                </button>
              ))}
              {pendingParticipants.length === 0 && (
                <span className="text-xs text-emerald-700 font-bold">Everyone has replied! 🎉</span>
              )}
            </div>
          </div>
        </div>

        {/* Host Bottom Action */}
        <div className="pt-6 space-y-2">
          {isObjectionWindow ? (
            <button
              onClick={handleLockNow}
              className="w-full py-4 px-5 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-2xl shadow-xl transition"
            >
              Finalize & Lock Now →
            </button>
          ) : (
            <button
              onClick={() => setShowStartObjectionModal(true)}
              className="w-full py-4 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition flex items-center justify-center gap-2"
            >
              <span>Set Time & Lock Plan →</span>
            </button>
          )}

          <button
            onClick={() => setFriendStep("who")}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-bold py-1"
          >
            Switch to Friend Voting View
          </button>
        </div>

        {/* Start Objection Modal */}
        {showStartObjectionModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  Configure Lock-In
                </h3>
                <button
                  onClick={() => setShowStartObjectionModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Lock Window Duration
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setObjectionMode("2_hours")}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center ${
                        objectionMode === "2_hours"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      <span>⚡ 2 Hours</span>
                      <span className="text-[10px] font-normal text-slate-500">Daytime speed</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setObjectionMode("overnight")}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center ${
                        objectionMode === "overnight"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      <span>🌙 Overnight</span>
                      <span className="text-[10px] font-normal text-slate-500">Locks tomorrow 10 AM</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Exact Start Time
                  </label>
                  <input
                    type="time"
                    value={objectionTime}
                    onChange={(e) => setObjectionTime(e.target.value)}
                    className="w-full p-3 text-sm rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Who's Booking?
                  </label>
                  <select
                    value={objectionBooker}
                    onChange={(e) => setObjectionBooker(e.target.value)}
                    className="w-full p-3 text-sm rounded-xl border border-slate-200 bg-white font-semibold text-xs"
                  >
                    <option value="">Anyone can book</option>
                    {Object.entries(session.participants).map(([id, p]) => (
                      <option key={id} value={id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowStartObjectionModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartObjection}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md"
                >
                  Start Window
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========================================================
  // F1. WHO ARE YOU? (FULL-SCREEN GRID OF NAME BUTTONS)
  // ========================================================
  if (friendStep === "who" || !currentParticipantId) {
    return (
      <div className="flex-1 flex flex-col justify-between p-5 min-h-screen animate-fade-in space-y-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-base font-black text-slate-900">WhenWhere</span>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 font-black px-2 py-0.5 rounded-full border border-emerald-200">
              No Signup
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-emerald-600 block mb-0.5">
              {hostParticipant?.name || "The organizer"} invited you to {displayTitle}
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
              Hi! Which one are you?
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Tap your name to cast your votes in 10 seconds. No password needed.
            </p>
          </div>

          {/* Full-screen grid of large name buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-2">
            {Object.entries(session.participants).map(([id, p], idx) => {
              const hasVoted = p.status === "done";
              const gradient = AVATAR_COLORS[idx % AVATAR_COLORS.length];

              return (
                <button
                  key={id}
                  onClick={() => handleSelectIdentity(id)}
                  className="p-4 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-900 rounded-3xl flex flex-col items-center gap-2 shadow-xs transition active:scale-95 text-center group"
                >
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${gradient} text-white font-black text-base flex items-center justify-center shadow-xs`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <strong className="text-sm font-black text-slate-900 block group-hover:text-emerald-700">
                      {p.name}
                    </strong>
                    <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                      {hasVoted ? "Already voted ✓" : "Tap to vote"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Not listed link at bottom */}
        <div className="pt-6 text-center">
          <button
            onClick={() => setShowJoinModal(true)}
            className="text-xs font-bold text-slate-500 hover:text-emerald-700 underline py-2"
          >
            I'm not listed (+ Add my name)
          </button>
        </div>

        {/* Join Modal for unlisted friend */}
        {showJoinModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">Add Your Name</h3>
                <button onClick={() => setShowJoinModal(false)} className="p-1.5 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                type="text"
                value={newJoinName}
                onChange={(e) => setNewJoinName(e.target.value)}
                placeholder="e.g. Alex"
                autoFocus
                className="w-full p-3.5 text-sm rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoin}
                  disabled={!newJoinName.trim()}
                  className="flex-1 py-3 bg-emerald-600 disabled:opacity-40 text-white font-bold rounded-xl text-xs"
                >
                  Join & Vote
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========================================================
  // F2. WHICH DAYS WORK? (STEP 1 OF 2)
  // ========================================================
  if (friendStep === "when") {
    return (
      <div className="flex-1 flex flex-col justify-between p-5 min-h-screen animate-fade-in space-y-4">
        <div className="space-y-4">
          {/* Progress & Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-emerald-600 font-bold">●○○ Step 1 of 2</span>
              <button
                onClick={handleSwitchIdentity}
                className="text-[11px] text-slate-400 hover:text-slate-700 underline font-medium"
              >
                Not {currentParticipant?.name || "you"}? Switch
              </button>
            </div>
            <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-1/3 rounded-full" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
              Hi {currentParticipant?.name || "friend"}! Which days work?
            </h1>
            <p className="text-xs text-slate-500 mt-1 capitalize">
              {displayTitle} · Tap the days you're free:
            </p>
          </div>

          {/* Real date cards with counts */}
          <div className="space-y-2">
            {session.options.dateSlots.map((slot) => {
              const isSelected = selectedSlots.includes(slot.id);
              const isVetoed = !!slot.vetoedBy;
              const voteCount = quorum?.slotVoteCounts[slot.id] || 0;

              return (
                <div
                  key={slot.id}
                  className={`border-2 rounded-2xl p-4 flex items-center justify-between gap-3 transition ${
                    isVetoed
                      ? "bg-slate-100/70 border-slate-200 opacity-60"
                      : isSelected
                      ? "bg-emerald-50/70 border-emerald-500 shadow-xs ring-1 ring-emerald-500/20"
                      : "bg-white border-slate-200/90 hover:border-slate-400 shadow-xs"
                  }`}
                >
                  <div
                    onClick={() => !isVetoed && toggleSlotAvailability(slot.id)}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <strong className={`text-sm font-black ${isVetoed ? "line-through text-slate-400" : "text-slate-900"}`}>
                        {slot.label.split(" • ")[0]}
                      </strong>
                    </div>
                    <span className="text-xs text-slate-500 font-medium block mt-0.5">
                      {voteCount} {voteCount === 1 ? "person can go" : "people can go"}
                    </span>
                  </div>

                  {!isVetoed && (
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Veto link */}
                      {!currentParticipant?.vetoUsed && (
                        <button
                          type="button"
                          onClick={() =>
                            setShowVetoConfirm({
                              type: "slot",
                              id: slot.id,
                              label: slot.label,
                            })
                          }
                          className="text-[10px] text-slate-400 hover:text-red-500 font-medium underline"
                          title="Veto date"
                        >
                          Veto
                        </button>
                      )}

                      {/* Tactile Toggle Button */}
                      <button
                        type="button"
                        onClick={() => toggleSlotAvailability(slot.id)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition active:scale-95 ${
                          isSelected
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                            : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        }`}
                      >
                        {isSelected ? <Check className="w-5 h-5 stroke-[3]" /> : <Plus className="w-5 h-5" />}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Action */}
        <div className="pt-6 space-y-2">
          <button
            onClick={() => setFriendStep("where")}
            className="w-full py-4 px-5 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-2xl shadow-xl transition flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <span>Next: Pick Spots →</span>
          </button>
          <button
            onClick={() => {
              setSelectedSlots([]);
              submitVote();
            }}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-700 font-bold py-1"
          >
            None of these work for me
          </button>
        </div>
      </div>
    );
  }

  // ========================================================
  // F3. WHERE SHOULD WE GO? (STEP 2 OF 2)
  // ========================================================
  if (friendStep === "where") {
    return (
      <div className="flex-1 flex flex-col justify-between p-5 min-h-screen animate-fade-in space-y-4">
        <div className="space-y-4">
          {/* Progress & Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-emerald-600 font-bold">●●○ Step 2 of 2</span>
              <button
                onClick={() => setFriendStep("when")}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-bold"
              >
                ← Back to dates
              </button>
            </div>
            <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-2/3 rounded-full" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
              Where should we go?
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Tap ★ for your Top Pick, and 👍 for any others that work.
            </p>
          </div>

          {/* Restaurant Cards */}
          <div className="space-y-3">
            {venueScores.map(({ venue, isDisqualified }) => {
              const isTop = topPickVenue === venue.id;
              const isApproved = approvedVenues.includes(venue.id);
              const emoji = getVenueEmoji(venue.name, venue.inferredTags);

              return (
                <div
                  key={venue.id}
                  className={`border-2 rounded-[24px] p-4 transition ${
                    isDisqualified
                      ? "bg-slate-100/70 border-slate-200 opacity-50"
                      : isTop
                      ? "bg-amber-50/80 border-amber-400 shadow-sm ring-2 ring-amber-400/20"
                      : isApproved
                      ? "bg-emerald-50/60 border-emerald-400"
                      : "bg-white border-slate-200/90 shadow-xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className="text-2xl">{emoji}</span>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className={`text-sm font-black ${isDisqualified ? "line-through text-slate-400" : "text-slate-900"}`}>
                            {venue.name}
                          </strong>
                          {venue.rating && (
                            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md">
                              ★ {venue.rating}
                            </span>
                          )}
                        </div>
                        {venue.address && (
                          <p className="text-xs text-slate-500 mt-0.5">{venue.address}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dietary Tags */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {venue.inferredTags.map((tag) => (
                      <span key={tag} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg font-bold">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {isDisqualified && (
                    <div className="mt-2 text-xs text-red-600 font-bold">
                      {venue.disqualifiedReason}
                    </div>
                  )}

                  {/* Voting Actions */}
                  {!isDisqualified && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      {!currentParticipant?.vetoUsed ? (
                        <button
                          type="button"
                          onClick={() =>
                            setShowVetoConfirm({
                              type: "venue",
                              id: venue.id,
                              label: venue.name,
                            })
                          }
                          className="text-[11px] text-slate-400 hover:text-red-500 font-medium underline"
                        >
                          Veto spot
                        </button>
                      ) : (
                        <span />
                      )}

                      <div className="flex items-center gap-2">
                        {/* Works for me button */}
                        <button
                          type="button"
                          onClick={() => handleVenueVote(venue.id, "approved")}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition ${
                            isApproved && !isTop
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>Works</span>
                        </button>

                        {/* Top Pick button */}
                        <button
                          type="button"
                          onClick={() => handleVenueVote(venue.id, "topPick")}
                          className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 transition ${
                            isTop
                              ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
                              : "bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100"
                          }`}
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>Top Pick</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Save Action */}
        <div className="pt-6 space-y-2">
          <button
            onClick={() => submitVote()}
            disabled={isSubmittingVote}
            className="w-full py-4 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {isSubmittingVote ? (
              <span>Saving your votes...</span>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Save My Votes ✓</span>
              </>
            )}
          </button>
          <button
            onClick={() => setFriendStep("when")}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-bold py-1"
          >
            ← Back to dates
          </button>
        </div>
      </div>
    );
  }

  // ========================================================
  // F4. DONE (EVERY FRIEND BECOMES A NUDGER)
  // ========================================================
  return (
    <div className="flex-1 flex flex-col justify-between p-5 min-h-screen animate-fade-in space-y-4">
      <div className="space-y-5">
        {/* Progress & Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-emerald-600 font-black">●●● Step Complete</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
              Votes Recorded ✓
            </span>
          </div>
          <div className="w-full bg-emerald-500 h-1.5 rounded-full" />
        </div>

        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
            ✓ You're in, {currentParticipant?.name || "friend"}!
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Here's where the group is heading right now:
          </p>
        </div>

        {/* Live Convergence Card */}
        <div className="bg-white border-2 border-slate-900 rounded-[28px] p-5 shadow-sm space-y-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block mb-0.5">
              Current Leader
            </span>
            <strong className="text-lg font-black text-slate-900 block">
              {leadingSlot?.label.split(" • ")[0] || "Dates in progress"}
            </strong>
            <span className="text-xs text-slate-500 font-medium">
              {leadingSlot ? `${quorum?.slotVoteCounts[leadingSlot.id] || 0} of ${activeParticipantsList.length} can make it` : ""}
            </span>
          </div>

          <p className="text-xs text-slate-600 pt-2 border-t border-slate-100 font-medium">
            Top restaurant: <strong>{topRankedVenue?.name || "Grounded spots"}</strong>
          </p>
        </div>

        {/* Distributed Nudges Card */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-[24px] p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-slate-900">Waiting on {pendingParticipants.length} friends</span>
            <span className="text-slate-400 text-[11px]">Help the crew lock it in</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {pendingParticipants.map(([id, p]) => (
              <button
                key={id}
                onClick={() => handleNudge(id)}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-slate-900 text-xs font-bold text-slate-800 transition flex items-center gap-1.5 shadow-2xs active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                <span>Nudge {p.name}</span>
              </button>
            ))}
            {pendingParticipants.length === 0 && (
              <span className="text-xs text-emerald-700 font-bold">100% of the crew has voted! 🎉</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="pt-6 space-y-2 text-center">
        <button
          onClick={() => handleShareUpdate("invite")}
          className="w-full py-4 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Share2 className="w-4 h-4" />
          <span>Share Update to Group Chat</span>
        </button>

        <button
          onClick={() => setFriendStep("when")}
          className="text-xs font-bold text-slate-500 hover:text-slate-900 underline py-1"
        >
          Change my answers
        </button>
      </div>

      {/* Veto Confirmation Modal */}
      {showVetoConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-xs">
              <Ban className="w-7 h-7" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">Spend Your 1 Veto Token?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                You have <strong>1 shared Veto Token</strong> across the entire session.
                Vetoing <strong>"{showVetoConfirm.label}"</strong> will remove it permanently for everyone.
              </p>
            </div>

            {/* Quick Reason Chips */}
            <div className="space-y-1.5 pt-1 text-left">
              <label className="text-[11px] font-bold text-slate-700 block">
                Why veto? (Helps the group understand):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Dietary / Allergy",
                  "Parking nightmare",
                  "Too loud / chaotic",
                  "Been there recently",
                  "Schedule crunch",
                ].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setVetoReason(r)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                      vetoReason === r
                        ? "bg-red-600 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Or short custom reason..."
                value={vetoReason}
                onChange={(e) => setVetoReason(e.target.value)}
                maxLength={60}
                className="w-full p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  setShowVetoConfirm(null);
                  setVetoReason("");
                }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Keep Token
              </button>
              <button
                onClick={() => {
                  if (showVetoConfirm.type === "slot") {
                    submitVote(showVetoConfirm.id, undefined, vetoReason);
                  } else {
                    submitVote(undefined, showVetoConfirm.id, vetoReason);
                  }
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md shadow-red-600/20"
              >
                Yes, Veto It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nudge Copy Modal */}
      {nudgeModalData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                Nudge {nudgeModalData.name}
              </h3>
              <button onClick={() => setNudgeModalData(null)} className="p-1.5 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-800 leading-relaxed font-sans select-all shadow-inner">
              {nudgeModalData.message}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(nudgeModalData.message);
                setCopiedText("nudge_copy");
                setTimeout(() => setNudgeModalData(null), 1200);
              }}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25"
            >
              {copiedText === "nudge_copy" ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Nudge to Clipboard</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
