"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  Share2,
  ArrowRight,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  Info,
  Plus,
  X,
  Zap,
  Flame,
  CheckCircle,
  HelpCircle,
  MessageCircle,
  CheckCheck,
  ChevronRight,
  Sliders,
  Compass,
  Sun,
  Moon,
  Coffee,
  GlassWater,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  KeyRound,
  ExternalLink,
} from "lucide-react";
import { ConstraintItem, DateSlotOption } from "@/types/session";

// Authentic Atlanta Presets
const PROMPT_PRESETS = [
  {
    emoji: "🥘",
    label: "Midtown Atlanta (Dinner)",
    text: "Dinner next week for 8 of us—Ankit, Raj, Priya, Mike, Sarah, Dan, Maya, Tom. Not Tuesday. Midtown Atlanta, veg & kid-friendly",
    area: "Midtown Atlanta",
    timeWindow: "dinner" as const,
  },
  {
    emoji: "☀️",
    label: "BeltLine / Inman Park (Brunch)",
    text: "Saturday brunch on the Atlanta BeltLine around Inman Park with Sarah, Dan, Chloe & Leo. Patio & kid-friendly",
    area: "BeltLine / Inman Park",
    timeWindow: "brunch" as const,
  },
  {
    emoji: "🍕",
    label: "West Midtown (Dinner)",
    text: "Dinner this Thursday in West Midtown near Howell Mill with Dave, Elena, Sam & Priya. Good cocktails & gluten-free options",
    area: "West Midtown",
    timeWindow: "dinner" as const,
  },
  {
    emoji: "🍸",
    label: "Buckhead (Happy Hour)",
    text: "Friday drinks after work in Buckhead with the team. Good patio & cocktails",
    area: "Buckhead",
    timeWindow: "drinks" as const,
  },
];

// Interactive Time Window Filters
const TIME_WINDOWS = [
  { id: "dinner", label: "Dinner", time: "6:30 – 8:30 PM", emoji: "🌙" },
  { id: "drinks", label: "Happy Hour", time: "5:00 – 7:00 PM", emoji: "🍸" },
  { id: "lunch", label: "Lunch", time: "12:00 – 2:00 PM", emoji: "☀️" },
  { id: "brunch", label: "Brunch", time: "10:30 AM – 1:00 PM", emoji: "🥞" },
];

// Atlanta Neighborhood Quick Toggles
const ATLANTA_NEIGHBORHOODS = [
  "Midtown Atlanta",
  "BeltLine / Inman Park",
  "West Midtown",
  "Buckhead",
  "Ponce City / O4W",
  "Decatur",
  "Virginia-Highland",
];

// Dietary & Atmosphere Filter Badges
const PRESET_FILTERS = [
  { id: "c_veg", emoji: "🥦", label: "Vegetarian-friendly", type: "dietary" as const },
  { id: "c_kid", emoji: "👶", label: "Kid-friendly", type: "kid_friendly" as const },
  { id: "c_patio", emoji: "☀️", label: "Outdoor patio", type: "other" as const },
  { id: "c_bar", emoji: "🍸", label: "Full bar / Cocktails", type: "vibe" as const },
  { id: "c_gf", emoji: "🌾", label: "Gluten-free options", type: "dietary" as const },
  { id: "c_quiet", emoji: "🤫", label: "Quiet conversation", type: "vibe" as const },
  { id: "c_halal", emoji: "🥩", label: "Halal options", type: "dietary" as const },
];

// Dynamic upcoming dates generator based on today's real date
function generateDynamicDates(timeWindow: string): DateSlotOption[] {
  const now = new Date();
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const windowLabel = TIME_WINDOWS.find((t) => t.id === timeWindow)?.label || "Dinner";

  const slots: DateSlotOption[] = [];
  // Generate 4 candidate dates starting next Thursday / Friday / Saturday / Sunday
  const dayOfWeek = now.getDay();
  const daysUntilNextThu = ((4 - dayOfWeek + 7) % 7) || 7;

  for (let i = 0; i < 4; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + daysUntilNextThu + i);

    const year = d.getFullYear();
    const monthPadded = String(d.getMonth() + 1).padStart(2, "0");
    const datePadded = String(d.getDate()).padStart(2, "0");
    const dateIso = `${year}-${monthPadded}-${datePadded}`;

    slots.push({
      id: `${dateIso}_${timeWindow}`,
      date: dateIso,
      timeWindow: timeWindow as any,
      label: `${daysOfWeek[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} • ${windowLabel}`,
      vetoedBy: null,
    });
  }
  return slots;
}

const AVATAR_COLORS = [
  "from-emerald-500 to-teal-600",
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-red-600",
  "from-cyan-500 to-blue-600",
];

export default function CreateSessionPage() {
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Core state starts clean & dynamic
  const [activeTimeWindow, setActiveTimeWindow] = useState<"dinner" | "lunch" | "brunch" | "drinks">("dinner");
  const [candidateDates, setCandidateDates] = useState<DateSlotOption[]>(() => generateDynamicDates("dinner"));
  const [selectedDateIds, setSelectedDateIds] = useState<string[]>(() => generateDynamicDates("dinner").slice(0, 3).map((s) => s.id));
  const [selectedArea, setSelectedArea] = useState<string>("Midtown Atlanta");

  const [activeConstraints, setActiveConstraints] = useState<ConstraintItem[]>([
    { id: "c_veg", type: "dietary", label: "Vegetarian-friendly", confirmed: true },
    { id: "c_kid", type: "kid_friendly", label: "Kid-friendly", confirmed: true },
    { id: "c_area", type: "area", label: "Midtown Atlanta", confirmed: true },
  ]);

  const [friendsList, setFriendsList] = useState<string[]>(["Ankit", "Raj", "Priya", "Mike", "Sarah", "Dan", "Maya", "Tom"]);
  const [hostIndex, setHostIndex] = useState<number>(0);
  const [newFriendInput, setNewFriendInput] = useState("");

  const [isCreating, setIsCreating] = useState(false);

  // Fix Item 1: Separate public share URL from private host recovery link
  const [publicShareUrl, setPublicShareUrl] = useState<string | null>(null);
  const [adminRecoveryUrl, setAdminRecoveryUrl] = useState<string | null>(null);
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);

  // Custom modals
  const [showAddDateModal, setShowAddDateModal] = useState(false);
  const [customDateValue, setCustomDateValue] = useState("");
  const [customDateTimeWindow, setCustomDateTimeWindow] = useState("dinner");

  const [showAddFilterModal, setShowAddFilterModal] = useState(false);
  const [newFilterLabel, setNewFilterLabel] = useState("");

  const handleParse = async (textToParse: string) => {
    if (!textToParse.trim()) return;
    setIsParsing(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/sessions/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToParse }),
      });
      const data = await res.json();
      if (data.parsed) {
        const p = data.parsed;
        if (p.detectedTimeWindow) {
          setActiveTimeWindow(p.detectedTimeWindow);
        }
        if (p.dateSlots && p.dateSlots.length > 0) {
          setCandidateDates(p.dateSlots);
          setSelectedDateIds(p.dateSlots.map((s: any) => s.id));
        }
        if (p.constraints && p.constraints.length > 0) {
          setActiveConstraints(p.constraints);
          const areaC = p.constraints.find((c: any) => c.type === "area");
          if (areaC) setSelectedArea(areaC.label);
        }
        if (p.participantNames && p.participantNames.length > 0) {
          setFriendsList(p.participantNames);
          setHostIndex(0);
        }
      }
    } catch (err) {
      console.error("Parse error:", err);
    } finally {
      setIsParsing(false);
    }
  };

  const toggleDateSlot = (slotId: string) => {
    setSelectedDateIds((prev) =>
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    );
  };

  const handleTimeWindowChange = (twId: "dinner" | "lunch" | "brunch" | "drinks") => {
    setActiveTimeWindow(twId);
    const windowLabel = TIME_WINDOWS.find((t) => t.id === twId)?.label || "Dinner";

    setCandidateDates((prev) =>
      prev.map((slot) => {
        const dateIso = slot.date || slot.id.split("_")[0];
        const parts = slot.label.split(" • ");
        const dateTitle = parts[0] || slot.label;
        return {
          ...slot,
          id: `${dateIso}_${twId}`,
          timeWindow: twId,
          label: `${dateTitle} • ${windowLabel}`,
        };
      })
    );

    setSelectedDateIds((prev) =>
      prev.map((id) => {
        const dateIso = id.split("_")[0];
        return `${dateIso}_${twId}`;
      })
    );
  };

  const handleAreaSelect = (areaName: string) => {
    setSelectedArea(areaName);
    setActiveConstraints((prev) => {
      const filtered = prev.filter((c) => c.type !== "area");
      return [...filtered, { id: `c_area_${Date.now()}`, type: "area", label: areaName, confirmed: true }];
    });
  };

  const toggleConstraintByLabel = (label: string, emoji?: string, type?: "dietary" | "kid_friendly" | "other" | "vibe") => {
    setActiveConstraints((prev) => {
      const existing = prev.find((c) => c.label.toLowerCase() === label.toLowerCase());
      if (existing) {
        return prev.map((c) =>
          c.label.toLowerCase() === label.toLowerCase() ? { ...c, confirmed: !c.confirmed } : c
        );
      } else {
        return [
          ...prev,
          {
            id: `c_custom_${Date.now()}`,
            type: type || "other",
            label,
            confirmed: true,
          },
        ];
      }
    });
  };

  // Fix Item 6: Use HTML5 Date input to build clean ISO dates
  const handleAddCustomDate = () => {
    if (!customDateValue) return;
    const parts = customDateValue.split("-");
    if (parts.length !== 3) return;

    const [year, month, day] = parts;
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const windowLabel = TIME_WINDOWS.find((t) => t.id === customDateTimeWindow)?.label || "Dinner";

    const slotId = `${customDateValue}_${customDateTimeWindow}`;
    const newSlot: DateSlotOption = {
      id: slotId,
      date: customDateValue,
      timeWindow: customDateTimeWindow as any,
      label: `${daysOfWeek[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} • ${windowLabel}`,
      vetoedBy: null,
    };

    setCandidateDates((prev) => [...prev, newSlot]);
    setSelectedDateIds((prev) => [...prev, slotId]);
    setCustomDateValue("");
    setShowAddDateModal(false);
  };

  const handleAddCustomFilter = () => {
    if (!newFilterLabel.trim()) return;
    toggleConstraintByLabel(newFilterLabel.trim());
    setNewFilterLabel("");
    setShowAddFilterModal(false);
  };

  const handleAddFriend = () => {
    if (!newFriendInput.trim()) return;
    const clean = newFriendInput.trim();
    if (!friendsList.includes(clean)) {
      setFriendsList((prev) => [...prev, clean]);
    }
    setNewFriendInput("");
  };

  const handleRemoveFriend = (idxToRemove: number) => {
    setFriendsList((prev) => prev.filter((_, idx) => idx !== idxToRemove));
    if (hostIndex >= friendsList.length - 1) {
      setHostIndex(0);
    }
  };

  const handleCreate = async () => {
    const activeDateSlots = candidateDates.filter((s) => selectedDateIds.includes(s.id));
    if (activeDateSlots.length === 0) {
      setErrorMessage("Please select at least one candidate date for the meetup.");
      return;
    }
    if (friendsList.length === 0) {
      setErrorMessage("Please list at least one friend or yourself.");
      return;
    }

    const confirmedConstraints = activeConstraints.filter((c) => c.confirmed);
    const currentHostName = friendsList[hostIndex] || friendsList[0] || "You";

    setIsCreating(true);
    setErrorMessage(null);
    try {
      // Fix Item 2: Send clean names and hostName; server constructs participant state
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: `${TIME_WINDOWS.find((t) => t.id === activeTimeWindow)?.label || "Meetup"} in ${selectedArea}`,
          hostName: currentHostName,
          participantNames: friendsList,
          constraints: confirmedConstraints,
          dateSlots: activeDateSlots,
          timeZone: "America/New_York",
        }),
      });
      const data = await res.json();
      if (res.ok && data.publicShareUrl && data.adminRecoveryUrl) {
        setPublicShareUrl(window.location.origin + data.publicShareUrl);
        setAdminRecoveryUrl(window.location.origin + data.adminRecoveryUrl);
      } else {
        throw new Error(data.error || "Failed to create meetup room");
      }
    } catch (err: any) {
      console.error("Create session error:", err);
      setErrorMessage(err.message || "Failed to create meetup session. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const copyText = (text: string, isHostKey = false) => {
    navigator.clipboard.writeText(text);
    if (isHostKey) {
      setCopiedAdmin(true);
      setTimeout(() => setCopiedAdmin(false), 2500);
    } else {
      setCopiedPublic(true);
      setTimeout(() => setCopiedPublic(false), 2500);
    }
  };

  // Fix Item 1: WhatsApp share gets ONLY the clean public link (zero host key)
  const sharePublicToChat = async () => {
    if (!publicShareUrl) return;
    const windowName = TIME_WINDOWS.find((t) => t.id === activeTimeWindow)?.label.toLowerCase() || "meetup";
    const shareText = `Hey! Locking in ${windowName} with the crew in ${selectedArea}. Tap your name to mark availability (10 sec, no signup):\n${publicShareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `SyncUp: ${windowName} in ${selectedArea}`,
          text: shareText,
          url: publicShareUrl,
        });
        return;
      } catch (e) {
        // Fallback to copy
      }
    }
    copyText(shareText);
  };

  return (
    <main className="flex-1 flex flex-col p-4 sm:p-5 pb-safe">
      {/* App Bar */}
      <header className="flex items-center justify-between pb-3.5 mb-2 border-b border-slate-200/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center text-white font-black shadow-md shadow-emerald-500/25">
            <span className="text-base tracking-tighter">S</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">SyncUp</h1>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">Atlanta</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Group Decisions in 10 Seconds</p>
          </div>
        </div>

        {/* Sharper High-Conversion Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 shadow-xs text-[11px] font-black text-emerald-900 tracking-tight">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>NO APP • NO SIGNUP</span>
        </div>
      </header>

      {/* Error Message Toast */}
      {errorMessage && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-2xl flex items-center justify-between gap-2 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700 font-bold">
            ×
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUCCESS SCREEN: SEPARATE PUBLIC SHARE vs PRIVATE HOST RECOVERY */}
      {/* ============================================================== */}
      {publicShareUrl && adminRecoveryUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in py-6 px-1 space-y-4">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-xl shadow-emerald-500/30 ring-8 ring-emerald-50">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Meetup Room Live!</h2>
            <p className="text-xs text-slate-600 mt-1 max-w-xs leading-relaxed">
              Drop the link into your WhatsApp or iMessage thread. Friends tap their name to vote in 10 seconds.
            </p>
          </div>

          {/* 1. PUBLIC GROUP LINK (CLEAN - ZERO HOST KEY) */}
          <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-4 text-left shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>1. Public Link to Share in Chat</span>
              </label>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">Safe for friends</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800 break-all select-all">
              <span className="truncate flex-1">{publicShareUrl}</span>
              <button
                onClick={() => copyText(publicShareUrl, false)}
                className="p-1.5 bg-white hover:bg-slate-100 rounded-lg text-slate-600 shadow-xs border border-slate-200 active:scale-95 transition"
                title="Copy public link"
              >
                {copiedPublic ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={sharePublicToChat}
              className="w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md shadow-emerald-600/25 active:scale-[0.98] transition text-xs"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Clean Link to Group Chat</span>
            </button>
          </div>

          {/* 2. PRIVATE HOST RECOVERY PASS (KEPT SEPARATE WITH WARNING) */}
          <div className="w-full bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-left shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                <span>2. Your Private Host Pass</span>
              </label>
              <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full">Keep for yourself</span>
            </div>

            <p className="text-[11px] text-amber-900 leading-snug">
              This link grants organizer powers (locking in exact time & setting booker). Bookmark it or open room now:
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => copyText(adminRecoveryUrl, true)}
                className="flex-1 py-2.5 bg-white hover:bg-amber-100 text-amber-900 font-bold rounded-xl border border-amber-300 text-xs transition flex items-center justify-center gap-1.5"
              >
                {copiedAdmin ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Host Recovery Link</span>
              </button>

              <button
                onClick={() => router.push(adminRecoveryUrl.replace(window.location.origin, ""))}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>Open as Host</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col space-y-4">
          {/* HIGH-CONVERTING VALUE PROP HERO CARD */}
          <section className="relative overflow-hidden bg-gradient-to-br from-[#111827] via-[#0f172a] to-[#064e3b] text-white rounded-[28px] p-5 shadow-xl border border-slate-800/80">
            <div className="absolute -top-16 -right-16 w-44 h-44 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none" />

            <div className="relative z-10 space-y-3">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-950/90 border border-emerald-500/40 px-3 py-1 rounded-full shadow-xs">
                <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                <span>WHEN + WHERE TOGETHER • NO CHAT DEBATES</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight text-white">
                Lock in <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-green-200">When & Where</span> without the 50-message debate.
              </h2>

              <p className="text-xs text-slate-300 leading-relaxed">
                WhatsApp polls break when schedules, dietary needs, and neighborhoods clash. Doodle takes 20 form fields.
                SyncUp combines dates and Atlanta spots into <strong>one 10-second link</strong>.
              </p>

              {/* Before vs After Strip */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <div className="bg-red-950/40 border border-red-500/20 rounded-xl p-2.5">
                  <span className="font-bold text-red-400 block text-[10px] uppercase">❌ Group Chat Poll</span>
                  <p className="text-slate-300 mt-0.5 text-[11px] leading-tight">
                    "Friday won, but 3 can't eat meat & nobody booked a table 🤯"
                  </p>
                </div>
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5">
                  <span className="font-bold text-emerald-400 block text-[10px] uppercase">✅ With SyncUp</span>
                  <p className="text-slate-200 mt-0.5 text-[11px] leading-tight">
                    Fri @ 7:30 PM at Tabla Midtown • 1-tap Google Map + .ics invite 🎉
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 30-SECOND WALKTHROUGH ACCORDION */}
          <section className="bg-emerald-50/70 border border-emerald-200/70 rounded-2xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setShowHowItWorks(!showHowItWorks)}
              className="w-full px-4 py-3 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">
                  ?
                </div>
                <span className="text-xs font-black text-emerald-950">
                  How SyncUp Works in 3 Simple Steps
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                <span>{showHowItWorks ? "Hide" : "Show Guide"}</span>
                {showHowItWorks ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </button>

            {showHowItWorks && (
              <div className="px-4 pb-3.5 pt-1 space-y-2.5 text-xs text-emerald-950 border-t border-emerald-200/50 animate-fade-in">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">1</span>
                  <div>
                    <strong className="block font-bold">You Pick the Options Below</strong>
                    <span className="text-emerald-800 text-[11px]">Choose dates, time block (Dinner/Brunch), and Atlanta neighborhood.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">2</span>
                  <div>
                    <strong className="block font-bold">Friends Tap & Vote in 10 Seconds</strong>
                    <span className="text-emerald-800 text-[11px]">Drop the link in WhatsApp/iMessage. Friends tap their name to mark free dates & vote on restaurants. No accounts or downloads needed.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">3</span>
                  <div>
                    <strong className="block font-bold">Quorum Locks When + Where</strong>
                    <span className="text-emerald-800 text-[11px]">Once quorum is reached, you start a 2-hour confirmation window and everyone gets a Google Maps link & .ics calendar invite!</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* STEP 1: PROMPT & 1-TAP ATLANTA TEMPLATES */}
          <section className="bg-white border border-slate-200/90 rounded-[28px] p-4.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                  1
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Step 1: Describe Plan or Tap a Template
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Type naturally — SyncUp auto-extracts dates, friends & spots
                  </p>
                </div>
              </div>
            </div>

            {/* 1-Tap Atlanta Presets */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Tap an Atlanta template to start instantly:
              </label>
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
                {PROMPT_PRESETS.map((preset) => {
                  const isActive = inputText === preset.text;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setInputText(preset.text);
                        handleParse(preset.text);
                        handleTimeWindowChange(preset.timeWindow);
                        handleAreaSelect(preset.area);
                      }}
                      className={`text-xs px-3 py-2 rounded-2xl border shrink-0 font-medium transition flex items-center gap-1.5 active:scale-95 ${
                        isActive
                          ? "bg-slate-900 border-slate-900 text-white font-bold shadow-md shadow-slate-900/10"
                          : "bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100 shadow-xs"
                      }`}
                    >
                      <span>{preset.emoji}</span>
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt textarea */}
            <div className="relative group pt-1">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={3}
                className="w-full p-3.5 text-xs sm:text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-slate-50/50 resize-none text-slate-900 shadow-inner leading-relaxed font-medium"
                placeholder="Type your plan: e.g. Dinner next week in Midtown Atlanta with Sarah, Dave, Sam & Priya. Veg & kid-friendly"
              />
              {isParsing && (
                <div className="absolute right-3.5 bottom-3.5 flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/60 shadow-xs">
                  <div className="w-3 h-3 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                  <span>Extracting plan...</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
              <span className="text-[10px] text-slate-400">
                You can customize the candidate dates and filters in Step 2 below ↓
              </span>
              <button
                type="button"
                onClick={() => handleParse(inputText)}
                className="text-emerald-700 font-bold hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-xl transition text-[11px] flex items-center gap-1.5 border border-emerald-200/60 shadow-xs"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Re-analyze</span>
              </button>
            </div>
          </section>

          {/* STEP 2: DATES & TIME BLOCK */}
          <section className="bg-white border border-slate-200/90 rounded-[28px] p-4.5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                  2
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Step 2: Choose Dates & Time Block
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Tap to toggle which options will be voted on
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDateModal(true)}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-xl border border-emerald-200/60 active:scale-95 transition"
              >
                <Plus className="w-3 h-3" />
                <span>Custom Date</span>
              </button>
            </div>

            {/* Time Window Buttons (Dinner / Drinks / Lunch / Brunch) */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                Time Block:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TIME_WINDOWS.map((tw) => {
                  const isSelected = activeTimeWindow === tw.id;
                  return (
                    <button
                      key={tw.id}
                      type="button"
                      onClick={() => handleTimeWindowChange(tw.id as any)}
                      className={`p-2.5 rounded-2xl border text-left transition flex flex-col justify-between active:scale-95 ${
                        isSelected
                          ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10 font-bold"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-sm">{tw.emoji}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-black block leading-none">{tw.label}</span>
                      <span className={`text-[10px] mt-0.5 block ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                        {tw.time}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Candidate Dates List (Interactive Tiles) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                <span>Included Days ({selectedDateIds.length} active in poll):</span>
                <span className="text-emerald-700 lowercase font-medium">tap card to include/exclude</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {candidateDates.map((slot) => {
                  const isSelected = selectedDateIds.includes(slot.id);
                  const parts = slot.label.split(" • ");
                  const dateTitle = parts[0] || slot.label;
                  const timeWindow = parts[1] || "Evening";

                  return (
                    <button
                      type="button"
                      key={slot.id}
                      onClick={() => toggleDateSlot(slot.id)}
                      className={`w-full text-left p-3 rounded-2xl border flex items-center justify-between gap-3 transition active:scale-[0.98] ${
                        isSelected
                          ? "bg-white border-emerald-500 text-slate-900 shadow-xs font-bold ring-2 ring-emerald-500/10"
                          : "bg-slate-100/60 border-slate-200 text-slate-400 line-through opacity-70"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                            isSelected ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-900 block truncate">{dateTitle}</span>
                          <span className="text-[10px] text-slate-500 font-medium">{timeWindow}</span>
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* STEP 3: ATLANTA AREA & DIETARY FILTERS */}
          <section className="bg-white border border-slate-200/90 rounded-[28px] p-4.5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                  3
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Step 3: Atlanta Area & Dietary Filters
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Venues matching these tags will auto-populate at quorum
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFilterModal(true)}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-xl border border-emerald-200/60 active:scale-95 transition"
              >
                <Plus className="w-3 h-3" />
                <span>Custom</span>
              </button>
            </div>

            {/* Atlanta Neighborhood Selection */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                Target Neighborhood:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ATLANTA_NEIGHBORHOODS.map((area) => {
                  const isSelected = selectedArea.toLowerCase() === area.toLowerCase();
                  return (
                    <button
                      key={area}
                      type="button"
                      onClick={() => handleAreaSelect(area)}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition active:scale-95 font-bold ${
                        isSelected
                          ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700"
                      }`}
                    >
                      <span>📍 {area}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dietary & Vibe Filter Badges (Clean consumer names) */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                Dietary & Atmosphere Requirements (Tap to Toggle):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_FILTERS.map((f) => {
                  const isActive = activeConstraints.some(
                    (c) => c.label.toLowerCase() === f.label.toLowerCase() && c.confirmed !== false
                  );

                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleConstraintByLabel(f.label, f.emoji, f.type)}
                      className={`text-xs px-3 py-2 rounded-xl border transition flex items-center gap-1.5 active:scale-95 ${
                        isActive
                          ? "bg-emerald-50 border-emerald-400 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-500/20"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600"
                      }`}
                    >
                      <span>{f.emoji}</span>
                      <span>{f.label}</span>
                      {isActive ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3] ml-0.5" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* STEP 4: FRIENDS & HOST SELECTION */}
          <section className="bg-white border border-slate-200/90 rounded-[28px] p-4.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                  4
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Step 4: Friends & Host ({friendsList.length} people)
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Tap a name to make them the Host. Friends tap their name to vote.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {friendsList.map((name, idx) => {
                const isHost = idx === hostIndex;
                const gradient = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                return (
                  <div
                    key={name + idx}
                    onClick={() => setHostIndex(idx)}
                    className={`text-xs pl-2 pr-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition cursor-pointer active:scale-95 ${
                      isHost
                        ? "bg-emerald-50 border-emerald-400 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-500/20"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-800"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-lg bg-gradient-to-tr ${gradient} text-white font-black text-[10px] flex items-center justify-center shrink-0`}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate max-w-[100px] font-bold">
                      {name} {isHost && "(Host)"}
                    </span>
                    {friendsList.length > 2 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFriend(idx);
                        }}
                        className="text-slate-400 hover:text-red-500 font-black ml-0.5 text-sm"
                        title="Remove friend"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick add friend input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newFriendInput}
                onChange={(e) => setNewFriendInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
                placeholder="Add another friend (e.g. Maya)"
                className="flex-1 p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
              <button
                type="button"
                onClick={handleAddFriend}
                disabled={!newFriendInput.trim()}
                className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition shrink-0"
              >
                + Add
              </button>
            </div>
          </section>

          {/* CREATE BUTTON */}
          <section className="pt-1">
            <button
              onClick={handleCreate}
              disabled={isCreating || selectedDateIds.length === 0 || friendsList.length === 0}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-black py-4 px-5 rounded-2xl shadow-xl shadow-emerald-600/30 active:scale-[0.98] transition text-base tracking-tight"
            >
              {isCreating ? (
                <>
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Generating Poll Room...</span>
                </>
              ) : (
                <>
                  <span>Create Meetup & Get Clean Link</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-slate-500 mt-2 font-medium">
              ⚡ Ready in 10 seconds • No app download • Zero passwords
            </p>
          </section>
        </div>
      )}

      {/* Add Date Modal (Fix Item 6: HTML5 date picker) */}
      {showAddDateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Add Custom Date</h3>
              <button
                onClick={() => setShowAddDateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Pick the specific calendar date and time window:
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Calendar Date:
                </label>
                <input
                  type="date"
                  value={customDateValue}
                  onChange={(e) => setCustomDateValue(e.target.value)}
                  className="w-full p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Time Window:
                </label>
                <select
                  value={customDateTimeWindow}
                  onChange={(e) => setCustomDateTimeWindow(e.target.value)}
                  className="w-full p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold bg-white"
                >
                  <option value="dinner">Dinner (6:30 – 8:30 PM)</option>
                  <option value="drinks">Happy Hour (5:00 – 7:00 PM)</option>
                  <option value="lunch">Lunch (12:00 – 2:00 PM)</option>
                  <option value="brunch">Brunch (10:30 AM – 1:00 PM)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowAddDateModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomDate}
                disabled={!customDateValue}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition"
              >
                Add Date
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Filter Modal */}
      {showAddFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Add Preference / Filter</h3>
              <button
                onClick={() => setShowAddFilterModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Add a dietary, neighborhood, or atmosphere requirement:
            </p>

            <input
              type="text"
              value={newFilterLabel}
              onChange={(e) => setNewFilterLabel(e.target.value)}
              placeholder="e.g. Rooftop or Halal options"
              autoFocus
              className="w-full p-3.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowAddFilterModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomFilter}
                disabled={!newFilterLabel.trim()}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition"
              >
                Add Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
