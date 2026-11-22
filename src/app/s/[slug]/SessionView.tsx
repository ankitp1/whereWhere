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
  Trash2,
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
  CheckCheck,
  Utensils,
  Award,
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

  // Local Vote State (for the current voter)
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [topPickVenue, setTopPickVenue] = useState<string | null>(null);
  const [approvedVenues, setApprovedVenues] = useState<string[]>([]);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);

  // Modals & UI States
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
  const [showIdentityPrompt, setShowIdentityPrompt] = useState(false);
  const [showFirstTimeOrientation, setShowFirstTimeOrientation] = useState(false);
  const [activeVoteStage, setActiveVoteStage] = useState<"when" | "where">("when");
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

  // Initial load and periodic polling (every 4 seconds for multiplayer convergence)
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

    // If not set from URL hash, restore saved identity from localStorage
    if (!targetPFromHash) {
      try {
        const savedP = localStorage.getItem(`syncup_participant_${slug}`);
        if (savedP) {
          setCurrentParticipantId(savedP);
        }
      } catch (e) {}
    }

    // Check if visitor has dismissed first-time orientation
    try {
      const dismissed = localStorage.getItem(`syncup_orientation_dismissed_${slug}`);
      if (!dismissed) {
        setShowFirstTimeOrientation(true);
      }
    } catch (e) {}
  }, [slug]);

  const handleDismissOrientation = () => {
    setShowFirstTimeOrientation(false);
    try {
      localStorage.setItem(`syncup_orientation_dismissed_${slug}`, "true");
    } catch (e) {}
  };

  // If host is signed in and no participant is selected, default to host identity
  useEffect(() => {
    if (session && isAdmin && !currentParticipantId && session.organizerParticipantId) {
      setCurrentParticipantId(session.organizerParticipantId);
      try {
        localStorage.setItem(`syncup_participant_${slug}`, session.organizerParticipantId);
      } catch (e) {}
    }
  }, [session, isAdmin, currentParticipantId, slug]);

  // Switch identity handler
  const handleSwitchParticipant = () => {
    setCurrentParticipantId(null);
    try {
      localStorage.removeItem(`syncup_participant_${slug}`);
    } catch (e) {}
  };

  // Select identity handler
  const handleSelectParticipant = (pId: string) => {
    setCurrentParticipantId(pId);
    setShowIdentityPrompt(false);
    try {
      localStorage.setItem(`syncup_participant_${slug}`, pId);
    } catch (e) {}
  };

  // Sync active voter's saved votes into local state
  useEffect(() => {
    if (session && currentParticipantId) {
      const p = session.participants[currentParticipantId];
      if (p) {
        setSelectedSlots(p.availableSlots || []);
        setTopPickVenue(p.topPickVenueId || null);
        setApprovedVenues(p.approvedVenueIds || []);
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

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // 1-Tap Share to Group Chat
  const handleShareUpdate = async (type: "quorum" | "objection" | "conflict" | "locked") => {
    if (!session) return;
    const url = window.location.origin + `/s/${session.slug}`;
    let copyText = "";

    const winningSlot = session.options.dateSlots.find(
      (s) => s.id === (session.lockedPlan?.slotId || quorum?.leadingSlot?.id)
    );
    const winningVenue = session.options.venues.find(
      (v) => v.id === (session.lockedPlan?.venueId || venueScores[0]?.venue?.id)
    );

    if (type === "quorum") {
      copyText = `🎉 Quorum reached for ${winningSlot?.label || "our meetup"}! Vote on the final spot here: ${url}`;
    } else if (type === "objection") {
      const timeStr = formatTime24to12(session.lockedPlan?.exactTime || "19:30");
      copyText = `⏳ Locking ${winningSlot?.label || "date"} @ ${timeStr} at ${winningVenue?.name || "our top pick"} in 2 hours—flag any conflicts now: ${url}`;
    } else if (type === "conflict") {
      const obj = session.lockedPlan?.lastObjection;
      copyText = `⚠️ ${obj?.participantName || "Someone"} flagged a conflict: "${obj?.reason || "schedule change"}". Tap to check updated options: ${url}`;
    } else if (type === "locked") {
      const timeStr = formatTime24to12(session.lockedPlan?.exactTime || "19:30");
      copyText = `✅ Locked! ${winningSlot?.label || "Date"} @ ${timeStr} at ${winningVenue?.name || "venue"}. Map & calendar invite: ${url}`;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: "SyncUp Update",
          text: copyText,
          url,
        });
        return;
      } catch (e) {
        // Fallback
      }
    }
    handleCopy(copyText, "share_banner");
  };

  // Vote Actions
  const toggleSlotAvailability = (slotId: string) => {
    if (!currentParticipantId) {
      setShowIdentityPrompt(true);
      return;
    }
    setSelectedSlots((prev) =>
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    );
  };

  const handleVenueVote = (venueId: string, type: "topPick" | "approved") => {
    if (!currentParticipantId) {
      setShowIdentityPrompt(true);
      return;
    }
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

  const submitVote = async (vetoSlotId?: string, vetoVenueId?: string, reason?: string) => {
    if (!session || !currentParticipantId) {
      setShowIdentityPrompt(true);
      return;
    }
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

  // Join action
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
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      alert("Failed to join");
    }
  };

  // Remove participant action (Admin only)
  const handleRemoveParticipant = async (participantId: string) => {
    if (!adminToken || !confirm("Remove this participant from the session?")) return;
    try {
      const res = await fetch(`/api/sessions/${slug}/remove-participant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, adminToken }),
      });
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
      }
    } catch (err) {
      alert("Failed to remove participant");
    }
  };

  // Find venues manually
  const handleFindVenues = async () => {
    try {
      const res = await fetch(`/api/sessions/${slug}/find-venues`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
      }
    } catch (err) {
      alert("Failed to find venues");
    }
  };

  // Add custom venue suggestion
  const handleAddCustomVenue = async () => {
    if (!customVenueName.trim() || !currentParticipantId) return;
    try {
      const res = await fetch(`/api/sessions/${slug}/add-custom-venue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: currentParticipantId,
          name: customVenueName.trim(),
        }),
      });
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        setShowCustomVenueModal(false);
        setCustomVenueName("");
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      alert("Failed to add custom spot");
    }
  };

  // Start Objection Window (2 Hours or Overnight)
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

  // Acknowledge Lock ("Looks good")
  const handleAcknowledgeLock = async () => {
    if (!currentParticipantId) return;
    try {
      const res = await fetch(`/api/sessions/${slug}/acknowledge-lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: currentParticipantId }),
      });
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
      }
    } catch (err) {
      alert("Failed to record response");
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

  // Force Lock / Finalize Now
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

  // Toggle Drop Out
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
        <p className="text-sm font-bold text-slate-800 tracking-tight">Syncing Room...</p>
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

  return (
    <div className="flex-1 flex flex-col pb-safe">
      {/* Sleek Glassmorphic App Bar */}
      <header className="sticky top-0 z-30 glass border-b border-slate-200/70 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center text-white font-black shadow-xs">
            S
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none truncate max-w-[180px]">
              {session.slug.replace(/-[a-z0-9]+$/i, "").replace(/-/g, " ")}
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${isLocked ? "bg-emerald-500" : isObjectionWindow ? "bg-amber-500 animate-pulse" : "bg-emerald-500 animate-pulse"}`} />
              <span className="text-[10px] font-bold text-slate-600 capitalize">
                {isLocked ? "Confirmed" : isObjectionWindow ? "2h Window" : "Live Room"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isAdmin && (
            <span className="text-[10px] bg-amber-50 text-amber-800 font-black px-2 py-1 rounded-xl border border-amber-200/80">
              Host
            </span>
          )}
          <button
            onClick={() => setShowFirstTimeOrientation((prev) => !prev)}
            className="p-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition active:scale-95 flex items-center gap-1 text-[11px] font-bold"
            title="How SyncUp Works"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">How it works</span>
          </button>
          <button
            onClick={() => handleShareUpdate(isLocked ? "locked" : isObjectionWindow ? "objection" : "quorum")}
            className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1"
            title="Share"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* FIRST-TIME VISITOR ORIENTATION CARD */}
      {showFirstTimeOrientation && (
        <section className="px-4 pt-3 animate-fade-in">
          <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 text-white rounded-[26px] p-4.5 shadow-xl border border-emerald-500/25 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <button
              onClick={handleDismissOrientation}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
              title="Dismiss orientation"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-3 relative z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Zero Signup • No Passwords • 10-Sec Decision</span>
              </div>

              <div>
                <h2 className="text-base font-black text-white tracking-tight leading-snug">
                  {session.participants[session.organizerParticipantId]?.name || "The organizer"} started this for{" "}
                  <span className="text-emerald-300 capitalize">
                    {session.slug.replace(/-[a-z0-9]+$/i, "").replace(/-/g, " ")}
                  </span>
                </h2>
                <p className="text-xs text-emerald-100/90 mt-1 leading-relaxed">
                  Instead of 40 back-and-forth messages in WhatsApp debating dates & restaurants,
                  SyncUp locks in the day and spot in 10 seconds.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-start gap-2">
                  <span className="w-5 h-5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <strong className="text-white font-bold block text-[11px]">Tap Your Name</strong>
                    <span className="text-[10px] text-slate-300">No passwords or accounts.</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-start gap-2">
                  <span className="w-5 h-5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <strong className="text-white font-bold block text-[11px]">Mark Free Days</strong>
                    <span className="text-[10px] text-slate-300">Live meter finds the date.</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-start gap-2">
                  <span className="w-5 h-5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <strong className="text-white font-bold block text-[11px]">Pick Spots & Veto</strong>
                    <span className="text-[10px] text-slate-300">1 dealbreaker token each.</span>
                  </div>
                </div>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  onClick={() => {
                    handleDismissOrientation();
                    const el = document.getElementById("avatar-selector");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl transition shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <span>Tap to Pick Your Name & Vote (10s)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* HUMAN-IN-THE-LOOP STATE TRANSITION BANNERS */}
      <div className="px-4 pt-3 space-y-2">
        {/* Quorum Hit Banner */}
        {isCollecting && quorum?.quorumHit && (
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-3.5 rounded-2xl shadow-md flex items-center justify-between gap-3 animate-fade-in">
            <div className="text-xs">
              <span className="font-black flex items-center gap-1 text-sm tracking-tight">
                🎉 Quorum Reached!
              </span>
              <p className="text-[11px] text-emerald-100 mt-0.5">
                {quorum.leadingSlot?.label} has enough votes.
              </p>
            </div>
            <button
              onClick={() => handleShareUpdate("quorum")}
              className="shrink-0 bg-white text-emerald-950 text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1 active:scale-95 transition shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share to Chat</span>
            </button>
          </div>
        )}

        {/* Objection Window Active Banner */}
        {isObjectionWindow && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3.5 rounded-2xl shadow-md flex items-center justify-between gap-3 animate-fade-in">
            <div className="text-xs">
              <span className="font-black flex items-center gap-1.5 text-sm tracking-tight">
                <Clock className="w-4 h-4 text-white" />
                Objection Window: {timeLeftStr}
              </span>
              <p className="text-[11px] text-amber-100 mt-0.5">
                Locking automatically in 2 hours unless someone flags conflict.
              </p>
            </div>
            <button
              onClick={() => handleShareUpdate("objection")}
              className="shrink-0 bg-white text-orange-950 text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1 active:scale-95 transition shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share to Chat</span>
            </button>
          </div>
        )}

        {/* Conflict Flagged Banner */}
        {isCollecting && session.lockedPlan?.lastObjection && (
          <div className="bg-amber-50 border border-amber-300/80 text-amber-950 p-3.5 rounded-2xl flex items-center justify-between gap-3 animate-fade-in shadow-xs">
            <div className="text-xs">
              <span className="font-black flex items-center gap-1.5 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Conflict Flagged by {session.lockedPlan.lastObjection.participantName}
              </span>
              <p className="text-[11px] text-amber-800 mt-0.5 italic">
                "{session.lockedPlan.lastObjection.reason}"
              </p>
            </div>
            <button
              onClick={() => handleShareUpdate("conflict")}
              className="shrink-0 bg-amber-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 active:scale-95 transition"
            >
              <Share2 className="w-3 h-3" />
              <span>Update Chat</span>
            </button>
          </div>
        )}

        {/* Plan Locked Banner */}
        {isLocked && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 rounded-3xl shadow-xl flex items-center justify-between gap-3 animate-fade-in">
            <div className="text-xs">
              <span className="font-black flex items-center gap-1.5 text-base tracking-tight">
                <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                Plan Confirmed & Locked!
              </span>
              <p className="text-[11px] text-emerald-100 mt-0.5">
                Date and spot are locked in. Tap to share card to chat.
              </p>
            </div>
            <button
              onClick={() => handleShareUpdate("locked")}
              className="shrink-0 bg-white text-emerald-950 text-xs font-black px-4 py-2.5 rounded-2xl flex items-center gap-1.5 active:scale-95 transition shadow-md"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Card</span>
            </button>
          </div>
        )}
      </div>

      {/* AVATAR SELECTOR: "WHO ARE YOU?" CAROUSEL */}
      <section id="avatar-selector" className="px-4 mt-3">
        <div className="bg-white border border-slate-200/80 rounded-[24px] p-3.5 shadow-xs">
          {showIdentityPrompt && !currentParticipant && (
            <div className="mb-2.5 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-2 animate-bounce">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Please tap your name below first to cast your votes!</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs mb-2 px-1">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                1
              </span>
              {currentParticipant ? (
                <>
                  <span>Voting as:</span>
                  <strong className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 font-black">
                    {currentParticipant.name}
                  </strong>
                  <button
                    onClick={handleSwitchParticipant}
                    className="text-[11px] text-slate-400 hover:text-slate-700 underline font-semibold ml-0.5"
                  >
                    (Switch)
                  </button>
                </>
              ) : (
                <span className="text-emerald-700 font-black">Who's Voting? Tap Your Name:</span>
              )}
            </span>
            <button
              onClick={() => setShowJoinModal(true)}
              className="text-emerald-700 font-bold hover:underline flex items-center gap-1 text-[11px]"
            >
              <Plus className="w-3 h-3" />
              <span>+ I'm new</span>
            </button>
          </div>

          {/* Avatar bubbles */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {Object.entries(session.participants).map(([id, p], idx) => {
              const isSelected = id === currentParticipantId;
              const hasVoted = p.status === "done";
              const isDroppedOut = p.status === "dropped_out";
              const gradient = AVATAR_COLORS[idx % AVATAR_COLORS.length];

              return (
                <button
                  key={id}
                  onClick={() => handleSelectParticipant(id)}
                  className={`flex flex-col items-center gap-1 shrink-0 p-1.5 rounded-2xl transition active:scale-95 ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-md shadow-slate-900/20 ring-2 ring-emerald-500"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60"
                  }`}
                >
                  <div className="relative">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${gradient} text-white font-black text-xs flex items-center justify-center shadow-xs`}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    {hasVoted && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-white">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-1 truncate max-w-[60px] ${isDroppedOut ? "line-through opacity-50" : ""}`}>
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2-STAGE MICRO-PROGRESSIVE DISCLOSURE TABS */}
      {isCollecting && (
        <section className="px-4 mt-2.5">
          <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center gap-1 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveVoteStage("when")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                activeVoteStage === "when"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>1. When ({selectedSlots.length} free)</span>
              {selectedSlots.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                  ✓
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveVoteStage("where")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                activeVoteStage === "where"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Utensils className="w-3.5 h-3.5 text-amber-600" />
              <span>
                2. Where{" "}
                {topPickVenue
                  ? "(★ Set)"
                  : approvedVenues.length > 0
                  ? `(${approvedVenues.length})`
                  : ""}
              </span>
              {(topPickVenue || approvedVenues.length > 0) && (
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                  ✓
                </span>
              )}
            </button>
          </div>
        </section>
      )}

      {/* ---------------- STATE 1: COLLECTING (2-STAGE MICRO-PROGRESSIVE DISCLOSURE) ---------------- */}
      {isCollecting && (
        <div className="px-4 mt-4 space-y-4">
          {/* ================= STAGE 1: WHEN ARE YOU FREE? ================= */}
          {activeVoteStage === "when" && (
            <div className="space-y-4 animate-fade-in">
              {/* QUORUM STATUS & EXPLAINABILITY */}
              <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[24px] p-4 shadow-lg border border-slate-800">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-emerald-400" />
                    Quorum Meter
                  </span>
                  <span className="text-slate-300 font-bold">
                    {doneParticipants.length} of {quorum?.requiredVotes} votes locked
                  </span>
                </div>

                {/* Glowing progress bar */}
                <div className="w-full bg-slate-700/80 h-2.5 rounded-full overflow-hidden mb-2.5">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500 rounded-full"
                    style={{
                      width: `${Math.min(100, (doneParticipants.length / (quorum?.requiredVotes || 1)) * 100)}%`,
                    }}
                  />
                </div>

                <div className="text-[11px] text-slate-300 bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>How it locks:</strong> Date with {quorum?.requiredVotes}+ unvetoed votes wins. Tuesday was excluded. Grounded spots match {session.constraints.map((c) => c.label).join(", ")}.
                  </div>
                </div>
              </section>

              {/* CANDIDATE DATES LEAF LIST */}
              <section className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Step 1: Mark When You Are Free</span>
                  </h2>
                  {currentParticipant?.vetoUsed ? (
                    <span className="text-[10px] text-red-600 font-bold flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                      <Ban className="w-2.5 h-2.5" />
                      Veto spent
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium">
                      1 Veto Token available
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {session.options.dateSlots.map((slot) => {
                    const isSelected = selectedSlots.includes(slot.id);
                    const isVetoed = !!slot.vetoedBy;
                    const voteCount = quorum?.slotVoteCounts[slot.id] || 0;
                    const isLeading = quorum?.leadingSlot?.id === slot.id && !isVetoed;

                    const parts = slot.label.split(" • ");
                    const dateText = parts[0] || slot.label;
                    const timeText = parts[1] || "Evening";

                    return (
                      <div
                        key={slot.id}
                        className={`border rounded-2xl p-3 flex items-center justify-between gap-2.5 transition ${
                          isVetoed
                            ? "bg-slate-100/70 border-slate-200 opacity-60"
                            : isSelected
                            ? "bg-emerald-50/70 border-emerald-400/80 shadow-xs ring-1 ring-emerald-500/20"
                            : "bg-white border-slate-200/90 shadow-xs"
                        }`}
                      >
                        <div
                          onClick={() => !isVetoed && toggleSlotAvailability(slot.id)}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-black ${isVetoed ? "line-through text-slate-400" : "text-slate-900"}`}>
                              {dateText}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">• {timeText}</span>
                            {isLeading && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Flame className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                                Quorum Leader
                              </span>
                            )}
                            {isVetoed && (
                              <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-md">
                                Vetoed by {slot.vetoedBy}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 font-medium mt-0.5 block">
                            {voteCount} {voteCount === 1 ? "friend free" : "friends free"}
                          </span>
                        </div>

                        {!isVetoed && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Veto Button */}
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
                                className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition active:scale-95"
                                title="Veto date"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}

                            {/* Tactile Toggle Button */}
                            <button
                              type="button"
                              onClick={() => toggleSlotAvailability(slot.id)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition active:scale-95 ${
                                isSelected
                                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Free</span>
                                </>
                              ) : (
                                <span>Can do</span>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* STAGE 1 BOTTOM ACTIONS */}
                <div className="pt-2 space-y-2">
                  {selectedSlots.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveVoteStage("where");
                        window.scrollTo({ top: 120, behavior: "smooth" });
                      }}
                      className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition active:scale-[0.98]"
                    >
                      <span>Next: Pick Where to Go ({session.options.venues.length || "Grounded"} spots)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <p className="text-center text-xs text-slate-500 font-medium py-1">
                      Tap the dates above that work for you to continue.
                    </p>
                  )}

                  {selectedSlots.length > 0 && (
                    <button
                      type="button"
                      onClick={() => submitVote()}
                      disabled={isSubmittingVote}
                      className="w-full text-center text-[11px] text-slate-500 hover:text-slate-800 font-bold py-1 transition"
                    >
                      {isSubmittingVote ? "Saving..." : `Or just save my dates for now (${selectedSlots.length} selected)`}
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ================= STAGE 2: WHERE SHOULD WE GO? ================= */}
          {activeVoteStage === "where" && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-950">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Step 2: Pick Grounded Spots</strong>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                    Give your <strong>★ Top Pick (2 pts)</strong> or approve spots that work. You also have 1 Veto token for dealbreakers.
                  </p>
                </div>
              </div>

              {/* SECTION: GROUNDED RESTAURANTS */}
              <section className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Vote on Restaurants</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowCustomVenueModal(true)}
                    className="text-[11px] text-emerald-700 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Suggest a spot</span>
                  </button>
                </div>

                {session.options.venues.length === 0 ? (
                  <div className="bg-white border border-dashed border-slate-300 rounded-[24px] p-6 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                      <Compass className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Venues Auto-Load at Quorum</h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                      As soon as any date hits quorum, SyncUp queries Google Places for top-rated spots matching your dietary filters.
                    </p>
                    <button
                      onClick={handleFindVenues}
                      className="mt-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition"
                    >
                      Find Venues Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {venueScores.map(({ venue, topPickVotes, approvedVotes, totalScore, isDisqualified }) => {
                      const isTop = topPickVenue === venue.id;
                      const isApproved = approvedVenues.includes(venue.id);
                      const emoji = getVenueEmoji(venue.name, venue.inferredTags);

                      return (
                        <div
                          key={venue.id}
                          className={`border rounded-[24px] p-4 transition ${
                            isDisqualified
                              ? "bg-slate-100/70 border-slate-200 opacity-60"
                              : isTop
                              ? "bg-amber-50/80 border-amber-300 shadow-sm ring-1 ring-amber-400/20"
                              : isApproved
                              ? "bg-emerald-50/60 border-emerald-300"
                              : "bg-white border-slate-200/90 shadow-xs"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-start gap-2.5">
                              <span className="text-2xl mt-0.5">{emoji}</span>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className={`text-sm font-black ${isDisqualified ? "line-through text-slate-400" : "text-slate-900"}`}>
                                    {venue.name}
                                  </h3>
                                  {venue.rating && (
                                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                      ★ {venue.rating}
                                    </span>
                                  )}
                                  {venue.priceLevel && (
                                    <span className="text-[11px] font-semibold text-slate-500">
                                      {venue.priceLevel}
                                    </span>
                                  )}
                                </div>
                                {venue.address && (
                                  <p className="text-xs text-slate-500 truncate max-w-[210px] mt-0.5">
                                    {venue.address}
                                  </p>
                                )}
                              </div>
                            </div>

                            {venue.mapsUrl && (
                              <a
                                href={venue.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100 transition shrink-0"
                                title="Open Google Maps"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>

                          {/* Inferred Tags */}
                          <div className="flex flex-wrap gap-1 mt-2.5">
                            {venue.inferredTags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] bg-slate-100/90 text-slate-700 px-2 py-0.5 rounded-lg font-bold"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          {isDisqualified && (
                            <div className="mt-2 text-xs text-red-600 font-bold">
                              {venue.disqualifiedReason}
                            </div>
                          )}

                          {/* Vote Buttons */}
                          {!isDisqualified && (
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-xs text-slate-600 font-bold">
                                {totalScore > 0 ? `${totalScore} pts (${topPickVotes} ★, ${approvedVotes} 👍)` : "No votes yet"}
                              </span>

                              <div className="flex items-center gap-1.5">
                                {!currentParticipant?.vetoUsed && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowVetoConfirm({
                                        type: "venue",
                                        id: venue.id,
                                        label: venue.name,
                                      })
                                    }
                                    className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition"
                                    title="Veto venue"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Works for me */}
                                <button
                                  type="button"
                                  onClick={() => handleVenueVote(venue.id, "approved")}
                                  className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition active:scale-95 ${
                                    isApproved && !isTop
                                      ? "bg-slate-900 text-white shadow-xs"
                                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                  <span>Works</span>
                                </button>

                                {/* Top Pick */}
                                <button
                                  type="button"
                                  onClick={() => handleVenueVote(venue.id, "topPick")}
                                  className={`text-xs px-3 py-1.5 rounded-xl font-black flex items-center gap-1 transition active:scale-95 ${
                                    isTop
                                      ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
                                      : "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
                                  }`}
                                >
                                  <Star className="w-3 h-3 fill-current" />
                                  <span>Top Pick</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <p className="text-[10px] text-slate-400 text-right pr-1">
                      Powered by Google Maps Platform
                    </p>
                  </div>
                )}

                {/* STAGE 2 BOTTOM ACTIONS */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveVoteStage("when")}
                    className="py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition active:scale-95 shrink-0"
                  >
                    ← Back to Dates
                  </button>

                  <button
                    type="button"
                    onClick={() => submitVote()}
                    disabled={isSubmittingVote}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-3.5 px-4 rounded-2xl shadow-xl shadow-emerald-600/30 active:scale-[0.98] transition text-xs tracking-tight"
                  >
                    {isSubmittingVote ? (
                      <span>Saving votes...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Save All My Votes ({selectedSlots.length} dates • {topPickVenue ? "1 top pick" : "approved"})</span>
                      </>
                    )}
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* NUDGE UNVOTED FRIENDS */}
          <section className="bg-white border border-slate-200/80 rounded-[24px] p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-slate-800 uppercase tracking-wider">Crew Status</span>
              <span className="text-slate-500 font-medium">
                {doneParticipants.length} voted • {pendingParticipants.length} pending
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {doneParticipants.map(([_, p], idx) => (
                <div
                  key={p.name}
                  className="text-xs bg-emerald-50 text-emerald-900 border border-emerald-200/80 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 font-bold"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                  <span>{p.name}</span>
                </div>
              ))}

              {pendingParticipants.map(([id, p]) => (
                <button
                  key={id}
                  onClick={() => handleNudge(id)}
                  className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold transition active:scale-95 shadow-xs"
                  title="Click to copy witty nudge message"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                  <span>Nudge {p.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ORGANIZER CONTROL DECK */}
          {isAdmin && (
            <section className="bg-slate-900 text-white rounded-[28px] p-5 space-y-3 shadow-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Host Control Deck
                </span>
                <span className="text-[11px] text-slate-400 font-mono">Room Admin</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Ready to seal the date? Open the 2-hour objection window to allow friends to flag any last conflicts before you book.
              </p>

              <button
                onClick={() => setShowStartObjectionModal(true)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black py-3.5 px-4 rounded-2xl shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition text-sm"
              >
                <Clock className="w-4 h-4" />
                <span>Set Exact Time & Open 2h Window</span>
              </button>
            </section>
          )}
        </div>
      )}

      {/* ---------------- STATE 2: 2-HOUR OBJECTION WINDOW ---------------- */}
      {isObjectionWindow && (
        <div className="px-4 mt-4 space-y-4 animate-fade-in">
          {/* URGENT PROPOSAL SUMMARY */}
          <section className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white rounded-[28px] p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-amber-100 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-white" />
                Locks In: {timeLeftStr}
              </span>
              <span className="text-[10px] bg-white/20 text-white font-bold px-2.5 py-0.5 rounded-full">
                Objection Window
              </span>
            </div>

            <div className="bg-white text-slate-900 rounded-2xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center gap-2 font-black text-base">
                <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {session.options.dateSlots.find((s) => s.id === session.lockedPlan?.slotId)?.label || "Date TBD"}
                </span>
                <span className="text-slate-400">•</span>
                <span>{formatTime24to12(session.lockedPlan?.exactTime || "19:30")}</span>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {session.options.venues.find((v) => v.id === session.lockedPlan?.venueId)?.name || "Venue TBD"}
                </span>
              </div>

              {session.lockedPlan?.bookerParticipantId && (
                <div className="text-[11px] text-slate-500 font-medium">
                  Booking owner: <strong>{session.participants[session.lockedPlan.bookerParticipantId]?.name}</strong>
                </div>
              )}
            </div>

            <p className="text-xs text-amber-50 leading-relaxed font-medium">
              If this works, tap <strong>"Looks good"</strong>. If 100% of friends confirm, it locks immediately! Otherwise it locks automatically when the timer expires.
            </p>
          </section>

          {/* ACTION BUTTONS */}
          <div className="space-y-2.5">
            <button
              onClick={handleAcknowledgeLock}
              className={`w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-black shadow-lg transition active:scale-[0.98] text-sm ${
                currentParticipant?.acknowledgedLock
                  ? "bg-emerald-100 text-emerald-950 border border-emerald-300"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30"
              }`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{currentParticipant?.acknowledgedLock ? "You tapped Looks Good ✓" : "👍 Looks Good To Me"}</span>
            </button>

            <button
              onClick={() => setShowConflictModal(true)}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 font-bold py-3 px-4 rounded-2xl border border-slate-200 shadow-xs transition text-xs"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>⚠️ Flag a Conflict (1-line reason)</span>
            </button>
          </div>

          {/* CONFIRMATION PROGRESS */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-slate-800 uppercase tracking-wider">Friend Confirmations</span>
              <span className="text-slate-500 font-bold">
                {activeParticipantsList.filter(([_, p]) => p.acknowledgedLock).length} of {activeParticipantsList.length} ready
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeParticipantsList.map(([_, p]) => (
                <div
                  key={p.name}
                  className={`text-xs px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 ${
                    p.acknowledgedLock
                      ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  {p.acknowledgedLock ? <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> : null}
                  <span>{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="pt-2">
              <button
                onClick={handleLockNow}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black transition flex items-center justify-center gap-2"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Host Override: Finalize Plan Now</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------------- STATE 3: LOCKED PLAN DECISION PASS ---------------- */}
      {isLocked && (
        <div className="px-4 mt-4 space-y-4 animate-fade-in">
          {/* DIGITAL BOARDING PASS / WALLET CARD */}
          <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-[32px] p-6 shadow-2xl space-y-5 border border-slate-700/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white px-3 py-1 rounded-full flex items-center gap-1 shadow-xs">
                <Check className="w-3 h-3 stroke-[3]" />
                Confirmed & Locked
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {session.timeZone.split("/")[1]?.replace("_", " ") || "Local Time"}
              </span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                {session.options.venues.find((v) => v.id === session.lockedPlan?.venueId)?.name || "Selected Spot"}
              </h2>
              <p className="text-sm text-emerald-300 font-bold mt-1.5 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {session.options.dateSlots.find((s) => s.id === session.lockedPlan?.slotId)?.label || "Date"}
                {" • "}
                {formatTime24to12(session.lockedPlan?.exactTime || "19:30")}
              </p>
            </div>

            {/* Address & Maps Link */}
            {(() => {
              const venue = session.options.venues.find((v) => v.id === session.lockedPlan?.venueId);
              return (
                venue && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-300 truncate">
                      <p className="font-black text-white truncate">{venue.name}</p>
                      <p className="text-slate-400 truncate text-[11px]">{venue.address || "New York, NY"}</p>
                    </div>
                    {venue.mapsUrl && (
                      <a
                        href={venue.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition active:scale-95 shadow-md"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Maps</span>
                      </a>
                    )}
                  </div>
                )
              );
            })()}

            {/* Table booking status */}
            <div className="pt-3 border-t border-slate-700/80 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Booking Owner</span>
                <strong className="text-white font-black text-sm">
                  {session.lockedPlan?.bookerParticipantId
                    ? session.participants[session.lockedPlan.bookerParticipantId]?.name
                    : "Anyone with reservations"}
                </strong>
              </div>

              <button
                onClick={handleToggleBooked}
                className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 text-xs transition active:scale-95 ${
                  session.lockedPlan?.isBooked
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{session.lockedPlan?.isBooked ? "Table Booked ✓" : "Mark as Booked"}</span>
              </button>
            </div>
          </section>

          {/* QUICK ACTION BUTTONS */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={`/api/sessions/${slug}/ics`}
              download
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-800 font-bold py-3.5 px-3 rounded-2xl border border-slate-200/90 shadow-xs transition text-xs active:scale-95"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Download .ics</span>
            </a>

            <button
              onClick={() => handleShareUpdate("locked")}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-3 rounded-2xl shadow-lg shadow-emerald-600/25 transition text-xs active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>Share to Chat</span>
            </button>
          </div>

          {/* DROP OUT TOGGLE */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between text-xs shadow-xs">
            <div>
              <span className="font-bold text-slate-800 block">Can't make it anymore?</span>
              <span className="text-[11px] text-slate-500">Notify the group without breaking the booking</span>
            </div>

            <button
              onClick={handleToggleDropOut}
              className={`px-3 py-1.5 rounded-xl font-bold transition active:scale-95 ${
                currentParticipant?.status === "dropped_out"
                  ? "bg-red-100 text-red-700 border border-red-300"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {currentParticipant?.status === "dropped_out" ? "Marked Out" : "Drop Out"}
            </button>
          </div>
        </div>
      )}

      {/* ---------------- MODALS ---------------- */}

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Join This Meetup</h3>
              <button
                onClick={() => setShowJoinModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Enter your first name to vote on dates & restaurants. Zero password needed.
            </p>

            <input
              type="text"
              value={newJoinName}
              onChange={(e) => setNewJoinName(e.target.value)}
              placeholder="e.g. Alex"
              autoFocus
              className="w-full p-3.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={!newJoinName.trim()}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition"
              >
                Join Now
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
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
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-red-600/20"
              >
                Yes, Veto It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag Conflict Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Flag a Conflict
              </h3>
              <button
                onClick={() => setShowConflictModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              If this time or venue doesn't work, tell the group in 1 short line. The session will pause lock-in so options can be adjusted.
            </p>

            <input
              type="text"
              value={conflictReason}
              onChange={(e) => setConflictReason(e.target.value)}
              placeholder="e.g. My late shift starts at 7 PM"
              maxLength={120}
              className="w-full p-3.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowConflictModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleFlagConflict}
                disabled={!conflictReason.trim()}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-md shadow-amber-600/20"
              >
                Send Conflict
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggest Custom Venue Modal */}
      {showCustomVenueModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Suggest a Spot</h3>
              <button
                onClick={() => setShowCustomVenueModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Have a favorite restaurant in mind? Type its plain-text name (1 suggestion per person).
            </p>

            <input
              type="text"
              value={customVenueName}
              onChange={(e) => setCustomVenueName(e.target.value)}
              placeholder="e.g. Joe's Shanghai"
              className="w-full p-3.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowCustomVenueModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomVenue}
                disabled={!customVenueName.trim()}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20"
              >
                Add Spot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Objection Window Modal (Organizer) */}
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
              {/* Duration Mode */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Objection Window Duration
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setObjectionMode("2_hours")}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-0.5 ${
                      objectionMode === "2_hours"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>⚡ 2 Hours</span>
                    <span className="text-[10px] font-normal text-slate-500">Daytime momentum</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setObjectionMode("overnight")}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-0.5 ${
                      objectionMode === "overnight"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>🌙 Overnight</span>
                    <span className="text-[10px] font-normal text-slate-500">Locks tomorrow 10 AM</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Exact Start Time ({session.timeZone.split("/")[1] || "Local"})
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
                  Who's Booking? (Optional)
                </label>
                <select
                  value={objectionBooker}
                  onChange={(e) => setObjectionBooker(e.target.value)}
                  className="w-full p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-semibold"
                >
                  <option value="">Anyone can book</option>
                  {Object.entries(session.participants).map(([id, p]) => (
                    <option key={id} value={id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                {objectionMode === "overnight" ? (
                  <>
                    Locks automatically <strong>tomorrow at 10:00 AM</strong>. Friends get a 1-tap "Looks good" button or can flag conflicts before bed/morning.
                  </>
                ) : (
                  <>
                    This triggers a <strong>2-hour countdown</strong>. Friends get a 1-tap "Looks good" button. If 100% confirm or nobody objects, the plan locks!
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowStartObjectionModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleStartObjection}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20"
              >
                {objectionMode === "overnight" ? "Start Overnight Window" : "Start 2h Window"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nudge Copy Sheet Modal */}
      {nudgeModalData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                Nudge {nudgeModalData.name}
              </h3>
              <button
                onClick={() => setNudgeModalData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tailored copy with their personalized voting link. Ready to paste directly into WhatsApp or iMessage:
            </p>

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 text-xs text-slate-800 leading-relaxed font-sans select-all shadow-inner">
              {nudgeModalData.message}
            </div>

            <div className="pt-1">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(nudgeModalData.message);
                  setCopiedText("nudge_copy");
                  setTimeout(() => setNudgeModalData(null), 1200);
                }}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-[0.98]"
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
        </div>
      )}
    </div>
  );
}
