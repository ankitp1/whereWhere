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
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictReason, setConflictReason] = useState("");
  const [showCustomVenueModal, setShowCustomVenueModal] = useState(false);
  const [customVenueName, setCustomVenueName] = useState("");
  const [showStartObjectionModal, setShowStartObjectionModal] = useState(false);
  const [objectionTime, setObjectionTime] = useState("19:30");
  const [objectionBooker, setObjectionBooker] = useState<string>("");
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
    if (hash) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const secret = params.get("admin");
      const targetP = params.get("p");

      if (targetP) {
        setCurrentParticipantId(targetP);
      }

      if (secret) {
        setAdminToken(secret);
        // Exchange admin token
        fetch(`/api/sessions/${slug}/claim-admin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: secret }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.isAdmin) {
              setIsAdmin(true);
              // Store admin token in sessionStorage
              sessionStorage.setItem(`admin_${slug}`, secret);
            }
          })
          .catch((err) => console.error("Admin claim failed:", err));

        // Clean URL fragment without reload
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, "", cleanUrl);
      }
    } else {
      // Check sessionStorage for saved admin token
      const saved = sessionStorage.getItem(`admin_${slug}`);
      if (saved) {
        setAdminToken(saved);
        setIsAdmin(true);
      }
    }
  }, [slug]);

  // Set default active voter if none selected
  useEffect(() => {
    if (session && !currentParticipantId) {
      const pKeys = Object.keys(session.participants);
      if (pKeys.length > 0) {
        // If admin, default to organizer, else first participant
        const defaultId = isAdmin ? session.organizerParticipantId : pKeys[0];
        setCurrentParticipantId(defaultId);
      }
    }
  }, [session, currentParticipantId, isAdmin]);

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
        // Fallback to clipboard
      }
    }
    handleCopy(copyText, "share_banner");
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

  const submitVote = async (vetoSlotId?: string, vetoVenueId?: string) => {
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
        }),
      });
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        setShowVetoConfirm(null);
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

  // Start 2-Hour Objection Window
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
        <div className="w-10 h-10 rounded-full border-4 border-brand-500 border-t-transparent animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600">Loading Meetup...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Meetup Not Found</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">{error || "This link may have expired or is invalid."}</p>
        <button
          onClick={() => (window.location.href = "/")}
          className="mt-5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
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
    <div className="flex-1 flex flex-col pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-xs">
            S
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none truncate max-w-[190px]">
              {session.slug.replace(/-[a-z0-9]+$/i, "").replace(/-/g, " ")}
            </h1>
            <p className="text-[10px] text-slate-400 capitalize mt-0.5">
              Status: <span className="font-semibold text-slate-700">{session.status.replace("_", " ")}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
              Organizer
            </span>
          )}
          <button
            onClick={() => handleCopy(window.location.href, "header_link")}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition"
            title="Copy link"
          >
            {copiedText === "header_link" ? <Check className="w-4 h-4 text-brand-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Human-in-the-Loop Share Banners (At Key State Transitions) */}
      <div className="px-4 pt-3 space-y-2">
        {/* Quorum Hit Banner */}
        {isCollecting && quorum?.quorumHit && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3 rounded-2xl shadow-md flex items-center justify-between gap-3 animate-fade-in">
            <div className="text-xs">
              <span className="font-bold flex items-center gap-1">
                🎉 Quorum Reached!
              </span>
              <p className="text-[11px] text-emerald-100 mt-0.5">
                {quorum.leadingSlot?.label} has enough votes.
              </p>
            </div>
            <button
              onClick={() => handleShareUpdate("quorum")}
              className="shrink-0 bg-white text-emerald-900 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 active:scale-95 transition shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share to Chat</span>
            </button>
          </div>
        )}

        {/* Objection Window Active Banner */}
        {isObjectionWindow && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3 rounded-2xl shadow-md flex items-center justify-between gap-3 animate-fade-in">
            <div className="text-xs">
              <span className="font-bold flex items-center gap-1">
                ⏳ 2-Hour Objection Window
              </span>
              <p className="text-[11px] text-amber-100 mt-0.5">
                Locking in {timeLeftStr || "2 hours"} unless flagged.
              </p>
            </div>
            <button
              onClick={() => handleShareUpdate("objection")}
              className="shrink-0 bg-white text-orange-900 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 active:scale-95 transition shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share to Chat</span>
            </button>
          </div>
        )}

        {/* Conflict Flagged Banner */}
        {isCollecting && session.lockedPlan?.lastObjection && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-2xl flex items-center justify-between gap-3 animate-fade-in">
            <div className="text-xs">
              <span className="font-bold flex items-center gap-1 text-amber-950">
                ⚠️ Conflict Flagged by {session.lockedPlan.lastObjection.participantName}
              </span>
              <p className="text-[11px] text-amber-800 mt-0.5 italic">
                "{session.lockedPlan.lastObjection.reason}"
              </p>
            </div>
            <button
              onClick={() => handleShareUpdate("conflict")}
              className="shrink-0 bg-amber-800 text-white text-xs font-semibold px-2.5 py-1.5 rounded-xl flex items-center gap-1 active:scale-95 transition"
            >
              <Share2 className="w-3 h-3" />
              <span>Update Chat</span>
            </button>
          </div>
        )}

        {/* Plan Locked Banner */}
        {isLocked && (
          <div className="bg-gradient-to-r from-brand-600 to-emerald-700 text-white p-3.5 rounded-2xl shadow-md flex items-center justify-between gap-3 animate-fade-in">
            <div className="text-xs">
              <span className="font-bold flex items-center gap-1 text-sm">
                ✅ Plan Locked In!
              </span>
              <p className="text-[11px] text-brand-100 mt-0.5">
                All details set. Tap below to share the decision card.
              </p>
            </div>
            <button
              onClick={() => handleShareUpdate("locked")}
              className="shrink-0 bg-white text-brand-900 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 active:scale-95 transition shadow"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share to Chat</span>
            </button>
          </div>
        )}
      </div>

      {/* Participant Identity Switcher */}
      <div className="px-4 mt-3">
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 px-1">
            <span className="font-medium flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Voting as: <strong className="text-slate-900">{currentParticipant?.name || "Select Name"}</strong>
            </span>
            <button
              onClick={() => setShowJoinModal(true)}
              className="text-brand-600 font-semibold hover:underline flex items-center gap-0.5 text-[11px]"
            >
              <Plus className="w-3 h-3" />
              <span>Not on list? Join</span>
            </button>
          </div>

          {/* Horizontal Chip Carousel */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {Object.entries(session.participants).map(([id, p]) => {
              const isSelected = id === currentParticipantId;
              const hasVoted = p.status === "done";
              const isDroppedOut = p.status === "dropped_out";

              return (
                <button
                  key={id}
                  onClick={() => setCurrentParticipantId(id)}
                  className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 shrink-0 transition ${
                    isSelected
                      ? "bg-slate-900 border-slate-900 text-white font-semibold shadow-sm"
                      : isDroppedOut
                      ? "bg-slate-100 text-slate-400 line-through border-slate-200"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span>{p.name}</span>
                  {hasVoted && (
                    <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-brand-400" : "bg-brand-500"}`} />
                  )}
                  {isAdmin && id !== session.organizerParticipantId && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveParticipant(id);
                      }}
                      className="ml-1 text-slate-400 hover:text-red-500"
                      title="Remove user"
                    >
                      ×
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------------- STATE 1: COLLECTING (AVAILABILITY & VENUE VOTING) ---------------- */}
      {isCollecting && (
        <div className="px-4 mt-4 space-y-5">
          {/* Quorum Progress & Explainability Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-brand-600" />
                Quorum Status
              </span>
              <span className="font-bold text-slate-900">
                {doneParticipants.length} / {quorum?.requiredVotes} votes required
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
              <div
                className="bg-brand-500 h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${Math.min(100, (doneParticipants.length / (quorum?.requiredVotes || 1)) * 100)}%`,
                }}
              />
            </div>

            {/* Transparent Explainability Note */}
            <div className="text-[11px] text-slate-500 bg-white border border-slate-200/60 rounded-xl p-2.5 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-brand-600 shrink-0 mt-0.5" />
              <div>
                <strong>Why these choices?</strong> Excluded Tuesday and prioritized {session.constraints.map((c) => c.label).join(", ")}. Date with {quorum?.requiredVotes}+ unvetoed votes will win.
              </div>
            </div>
          </div>

          {/* Section: Date Slots Availability */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Mark When You Are Free</span>
              </h2>
              {currentParticipant?.vetoUsed ? (
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <Ban className="w-3 h-3 text-red-500" />
                  Veto used
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 font-medium">
                  1 shared Veto token
                </span>
              )}
            </div>

            <div className="space-y-2">
              {session.options.dateSlots.map((slot) => {
                const isSelected = selectedSlots.includes(slot.id);
                const isVetoed = !!slot.vetoedBy;
                const voteCount = quorum?.slotVoteCounts[slot.id] || 0;
                const isLeading = quorum?.leadingSlot?.id === slot.id && !isVetoed;

                return (
                  <div
                    key={slot.id}
                    className={`border rounded-2xl p-3 flex items-center justify-between transition ${
                      isVetoed
                        ? "bg-slate-100 border-slate-200 opacity-60"
                        : isSelected
                        ? "bg-brand-50/70 border-brand-300 shadow-sm"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <div
                      onClick={() => !isVetoed && toggleSlotAvailability(slot.id)}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${isVetoed ? "line-through text-slate-500" : "text-slate-900"}`}>
                          {slot.label}
                        </span>
                        {isLeading && (
                          <span className="text-[10px] bg-brand-100 text-brand-800 font-bold px-1.5 py-0.5 rounded-md">
                            Quorum Leader
                          </span>
                        )}
                        {isVetoed && (
                          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-md">
                            Vetoed by {slot.vetoedBy}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 mt-0.5 block">
                        {voteCount} {voteCount === 1 ? "person free" : "people free"}
                      </span>
                    </div>

                    {!isVetoed && (
                      <div className="flex items-center gap-2">
                        {/* Veto Button (if token not spent) */}
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
                            className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition"
                            title="Veto this date (cannot attend)"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}

                        {/* Availability Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleSlotAvailability(slot.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                            isSelected
                              ? "bg-brand-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
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
          </div>

          {/* Section: Grounded Venues & Voting */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>Vote on Restaurants</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowCustomVenueModal(true)}
                className="text-[11px] text-brand-600 font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>+ Suggest a spot</span>
              </button>
            </div>

            {session.options.venues.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-4 text-center">
                <Compass className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">
                  Venues will load automatically when a date hits quorum.
                </p>
                <button
                  onClick={handleFindVenues}
                  className="mt-3 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  Find Venues Now
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {venueScores.map(({ venue, topPickVotes, approvedVotes, totalScore, isDisqualified }) => {
                  const isTop = topPickVenue === venue.id;
                  const isApproved = approvedVenues.includes(venue.id);

                  return (
                    <div
                      key={venue.id}
                      className={`border rounded-2xl p-3.5 transition ${
                        isDisqualified
                          ? "bg-slate-100 border-slate-200 opacity-60"
                          : isTop
                          ? "bg-amber-50/70 border-amber-300 shadow-sm"
                          : isApproved
                          ? "bg-brand-50/50 border-brand-200"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className={`text-sm font-bold ${isDisqualified ? "line-through text-slate-500" : "text-slate-900"}`}>
                              {venue.name}
                            </h3>
                            {venue.rating && (
                              <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                ★ {venue.rating}
                              </span>
                            )}
                            {venue.priceLevel && (
                              <span className="text-[11px] font-medium text-slate-500">
                                {venue.priceLevel}
                              </span>
                            )}
                          </div>
                          {venue.address && (
                            <p className="text-xs text-slate-500 truncate max-w-[220px] mt-0.5">
                              {venue.address}
                            </p>
                          )}
                        </div>

                        {venue.mapsUrl && (
                          <a
                            href={venue.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-slate-100 transition"
                            title="Open in Google Maps"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>

                      {/* Inferred tags (Likely veg-friendly, etc.) */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {venue.inferredTags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Disqualification / Veto message */}
                      {isDisqualified && (
                        <div className="mt-2 text-xs text-red-600 font-medium">
                          {venue.disqualifiedReason}
                        </div>
                      )}

                      {/* Voting Buttons */}
                      {!isDisqualified && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs text-slate-500 font-medium">
                            {totalScore > 0 ? `${totalScore} pts (${topPickVotes} ★, ${approvedVotes} 👍)` : "No votes yet"}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* Veto Button */}
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
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                                title="Veto this venue"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Works for me */}
                            <button
                              type="button"
                              onClick={() => handleVenueVote(venue.id, "approved")}
                              className={`text-xs px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1 transition ${
                                isApproved && !isTop
                                  ? "bg-slate-900 text-white"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span>Works</span>
                            </button>

                            {/* Top Pick (2 pts) */}
                            <button
                              type="button"
                              onClick={() => handleVenueVote(venue.id, "topPick")}
                              className={`text-xs px-2.5 py-1.5 rounded-xl font-semibold flex items-center gap-1 transition ${
                                isTop
                                  ? "bg-amber-500 text-white shadow-sm"
                                  : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
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
                  Venue search powered by Google Maps Platform
                </p>
              </div>
            )}
          </div>

          {/* Submit / Update My Vote Button */}
          <div className="pt-2">
            <button
              onClick={() => submitVote()}
              disabled={isSubmittingVote}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md shadow-brand-600/20 active:scale-[0.98] transition"
            >
              {isSubmittingVote ? (
                <span>Recording vote...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save My Availability & Votes</span>
                </>
              )}
            </button>
          </div>

          {/* Outstanding Participants & 1-Tap Witty Nudge */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Crew Status</span>
              <span className="text-slate-500">
                {doneParticipants.length} voted • {pendingParticipants.length} pending
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {doneParticipants.map(([_, p]) => (
                <span
                  key={p.name}
                  className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1 font-medium"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  {p.name}
                </span>
              ))}

              {pendingParticipants.map(([id, p]) => (
                <button
                  key={id}
                  onClick={() => handleNudge(id)}
                  className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2 py-1 rounded-lg flex items-center gap-1 font-medium transition active:scale-95"
                  title="Click to generate 1-tap nudge message"
                >
                  <MessageSquare className="w-3 h-3 text-amber-600" />
                  <span>Nudge {p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Organizer Lock Controls */}
          {isAdmin && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  Organizer Controls
                </span>
                <span className="text-[11px] text-slate-400">Lock-in Ready</span>
              </div>

              <p className="text-xs text-slate-300">
                Ready to finalize? Start the 2-hour objection window to let friends flag any last-second conflicts before booking.
              </p>

              <button
                onClick={() => setShowStartObjectionModal(true)}
                className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-brand-500/20 active:scale-[0.98] transition"
              >
                <Clock className="w-4 h-4" />
                <span>Set Exact Time & Start 2h Window</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------------- STATE 2: OBJECTION WINDOW ---------------- */}
      {isObjectionWindow && (
        <div className="px-4 mt-4 space-y-4 animate-fade-in">
          {/* Proposal Summary Card */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Locking In: {timeLeftStr}
              </span>
              <span className="text-[11px] bg-amber-200 text-amber-950 font-semibold px-2 py-0.5 rounded-full">
                Objection Window
              </span>
            </div>

            <div className="bg-white border border-amber-200/80 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Calendar className="w-4 h-4 text-brand-600 shrink-0" />
                <span>
                  {session.options.dateSlots.find((s) => s.id === session.lockedPlan?.slotId)?.label || "Date TBD"}
                </span>
                <span className="text-slate-400">•</span>
                <span>{formatTime24to12(session.lockedPlan?.exactTime || "19:30")}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-800 text-xs font-medium">
                <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
                <span>
                  {session.options.venues.find((v) => v.id === session.lockedPlan?.venueId)?.name || "Venue TBD"}
                </span>
              </div>

              {session.lockedPlan?.bookerParticipantId && (
                <div className="text-[11px] text-slate-500">
                  Booking owner: <strong>{session.participants[session.lockedPlan.bookerParticipantId]?.name}</strong>
                </div>
              )}
            </div>

            <p className="text-xs text-amber-900 leading-relaxed">
              If this works for you, tap <strong>"Looks good"</strong>. If all active friends tap it, this locks immediately! Otherwise, it locks automatically in 2 hours.
            </p>
          </div>

          {/* Action Buttons: Looks Good vs Flag Conflict */}
          <div className="space-y-2.5">
            <button
              onClick={handleAcknowledgeLock}
              className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold shadow-md transition ${
                currentParticipant?.acknowledgedLock
                  ? "bg-brand-100 text-brand-800 border border-brand-300"
                  : "bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/20 active:scale-[0.98]"
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{currentParticipant?.acknowledgedLock ? "You tapped Looks Good ✓" : "👍 Looks Good To Me"}</span>
            </button>

            <button
              onClick={() => setShowConflictModal(true)}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 font-semibold py-2.5 px-4 rounded-xl border border-slate-200 transition text-xs"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>⚠️ Flag a Conflict (1-line reason)</span>
            </button>
          </div>

          {/* Acknowledgments list */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Friend Confirmations</span>
              <span className="text-slate-500">
                {activeParticipantsList.filter(([_, p]) => p.acknowledgedLock).length} / {activeParticipantsList.length} ready
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeParticipantsList.map(([_, p]) => (
                <span
                  key={p.name}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 ${
                    p.acknowledgedLock
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  {p.acknowledgedLock ? <Check className="w-3 h-3 text-emerald-600" /> : null}
                  {p.name}
                </span>
              ))}
            </div>
          </div>

          {/* Organizer early finalize */}
          {isAdmin && (
            <div className="pt-2">
              <button
                onClick={handleLockNow}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Organizer Override: Finalize Plan Now</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------------- STATE 3: LOCKED (FINAL DECISION CARD) ---------------- */}
      {isLocked && (
        <div className="px-4 mt-4 space-y-4 animate-fade-in">
          {/* Decision Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-xl space-y-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-brand-500 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" />
                Locked & Confirmed
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {session.timeZone.split("/")[1]?.replace("_", " ") || "Local Time"}
              </span>
            </div>

            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">
                {session.options.venues.find((v) => v.id === session.lockedPlan?.venueId)?.name || "Selected Spot"}
              </h2>
              <p className="text-sm text-brand-300 font-semibold mt-1 flex items-center gap-1.5">
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
                  <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3 flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-300 truncate">
                      <p className="font-semibold text-white truncate">{venue.name}</p>
                      <p className="text-slate-400 truncate text-[11px]">{venue.address || "New York, NY"}</p>
                    </div>
                    {venue.mapsUrl && (
                      <a
                        href={venue.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Map</span>
                      </a>
                    )}
                  </div>
                )
              );
            })()}

            {/* Booked By Status & Toggle */}
            <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Booking Owner:</span>
                <strong className="text-white font-semibold">
                  {session.lockedPlan?.bookerParticipantId
                    ? session.participants[session.lockedPlan.bookerParticipantId]?.name
                    : "Anyone with reservations"}
                </strong>
              </div>

              <button
                onClick={handleToggleBooked}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 text-xs transition ${
                  session.lockedPlan?.isBooked
                    ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{session.lockedPlan?.isBooked ? "Table Booked ✓" : "Mark as Booked"}</span>
              </button>
            </div>
          </div>

          {/* Quick Actions: .ics download and share */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={`/api/sessions/${slug}/ics`}
              download
              className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-3 px-3 rounded-xl transition text-xs"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Download .ics</span>
            </a>

            <button
              onClick={() => handleShareUpdate("locked")}
              className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 px-3 rounded-xl shadow-md shadow-brand-600/20 transition text-xs"
            >
              <Share2 className="w-4 h-4" />
              <span>Share to Chat</span>
            </button>
          </div>

          {/* Post-Lock Dropout Toggle */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-slate-800 block">Can't make it anymore?</span>
              <span className="text-[11px] text-slate-500">Let the group know without breaking the plan</span>
            </div>

            <button
              onClick={handleToggleDropOut}
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                currentParticipant?.status === "dropped_out"
                  ? "bg-red-100 text-red-700 border border-red-200"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              {currentParticipant?.status === "dropped_out" ? "Marked Out" : "Drop Out"}
            </button>
          </div>

          {/* Retention Hook: 1-Tap Google Sign-In Prompt */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 text-center space-y-2">
            <h3 className="text-xs font-bold text-blue-950 flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Plan dinner with this crew again?
            </h3>
            <p className="text-[11px] text-blue-800 leading-relaxed max-w-xs mx-auto">
              Save these friends to your account so you can coordinate your next night out in 1 tap.
            </p>
            <button
              onClick={() => alert("Google Sign-In integration ready for production auth setup!")}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-4 py-2 rounded-xl shadow-sm inline-flex items-center gap-2 transition"
            >
              <span className="font-bold text-red-500">G</span>
              <span>Save Crew with Google</span>
            </button>
          </div>
        </div>
      )}

      {/* ---------------- MODALS & DIALOGS ---------------- */}

      {/* 1. Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Join This Meetup</h3>
              <button
                onClick={() => setShowJoinModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Enter your first name to add your availability and vote with friends. Zero password needed.
            </p>

            <input
              type="text"
              value={newJoinName}
              onChange={(e) => setNewJoinName(e.target.value)}
              placeholder="e.g. Alex"
              autoFocus
              className="w-full p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={!newJoinName.trim()}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition"
              >
                Join Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Veto Confirmation Modal */}
      {showVetoConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto ring-8 ring-red-50/50">
              <Ban className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Use Your Single Veto?</h3>
              <p className="text-xs text-slate-600">
                You have <strong>1 shared Veto Token</strong> across the whole session.
                Vetoing <strong>"{showVetoConfirm.label}"</strong> will completely take it off the table for everyone.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowVetoConfirm(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
              >
                Keep Token
              </button>
              <button
                onClick={() => {
                  if (showVetoConfirm.type === "slot") {
                    submitVote(showVetoConfirm.id, undefined);
                  } else {
                    submitVote(undefined, showVetoConfirm.id);
                  }
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs transition"
              >
                Yes, Veto It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Flag Conflict Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Flag a Conflict
              </h3>
              <button
                onClick={() => setShowConflictModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              If this time or venue genuinely doesn't work for you, tell the group in 1 short line. The session will pause lock-in so options can be adjusted.
            </p>

            <input
              type="text"
              value={conflictReason}
              onChange={(e) => setConflictReason(e.target.value)}
              placeholder="e.g. My late shift starts at 7 PM"
              maxLength={120}
              className="w-full p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowConflictModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleFlagConflict}
                disabled={!conflictReason.trim()}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition"
              >
                Send Conflict
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Suggest Custom Venue Modal */}
      {showCustomVenueModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Suggest a Spot</h3>
              <button
                onClick={() => setShowCustomVenueModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
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
              className="w-full p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowCustomVenueModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomVenue}
                disabled={!customVenueName.trim()}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition"
              >
                Add Spot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Start Objection Window Modal (Organizer) */}
      {showStartObjectionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand-600" />
                Configure Lock-In
              </h3>
              <button
                onClick={() => setShowStartObjectionModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Exact Start Time ({session.timeZone.split("/")[1] || "Local"})
                </label>
                <input
                  type="time"
                  value={objectionTime}
                  onChange={(e) => setObjectionTime(e.target.value)}
                  className="w-full p-2.5 text-sm rounded-xl border border-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Who's Booking? (Optional)
                </label>
                <select
                  value={objectionBooker}
                  onChange={(e) => setObjectionBooker(e.target.value)}
                  className="w-full p-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="">Anyone can book</option>
                  {Object.entries(session.participants).map(([id, p]) => (
                    <option key={id} value={id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                This starts a <strong>2-hour objection window</strong>. Friends will see a 1-tap "Looks good" button. If nobody objects, the plan locks!
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowStartObjectionModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleStartObjection}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-xs transition"
              >
                Start 2h Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Nudge Copy Sheet Modal */}
      {nudgeModalData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-brand-600" />
                Nudge {nudgeModalData.name}
              </h3>
              <button
                onClick={() => setNudgeModalData(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Pre-written witty copy with a personalized voting link. Paste this into your WhatsApp or iMessage thread:
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 leading-relaxed font-sans select-all">
              {nudgeModalData.message}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(nudgeModalData.message);
                  setCopiedText("nudge_copy");
                  setTimeout(() => setNudgeModalData(null), 1200);
                }}
                className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md shadow-brand-600/20"
              >
                {copiedText === "nudge_copy" ? (
                  <>
                    <Check className="w-4 h-4" />
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
