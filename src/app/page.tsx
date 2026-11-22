"use client";

import React, { useState, useEffect } from "react";
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
  ListOrdered,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ParsedSessionIntent } from "@/lib/server/parser";
import { ConstraintItem, DateSlotOption } from "@/types/session";

// Authentic Atlanta Presets
const PROMPT_PRESETS = [
  {
    emoji: "🥘",
    label: "Midtown Atlanta (8 friends)",
    text: "Dinner next week for 8 of us—Ankit, Raj, Priya, Mike, Sarah, Dan, Maya, Tom. Not Tuesday. Midtown Atlanta, veg & kid-friendly",
    area: "Midtown Atlanta",
    timeWindow: "dinner",
  },
  {
    emoji: "☀️",
    label: "BeltLine / Inman Park Brunch",
    text: "Saturday brunch on the Atlanta BeltLine around Inman Park with Sarah, Dan, Chloe & Leo. Patio & kid-friendly",
    area: "BeltLine / Inman Park",
    timeWindow: "brunch",
  },
  {
    emoji: "🍕",
    label: "Westside / West Midtown",
    text: "Dinner this Thursday in West Midtown near Howell Mill with Dave, Elena, Sam & Priya. Good cocktails & gluten-free options",
    area: "West Midtown",
    timeWindow: "dinner",
  },
  {
    emoji: "🍸",
    label: "Buckhead Happy Hour",
    text: "Friday drinks after work in Buckhead with the team. Good patio & cocktails",
    area: "Buckhead",
    timeWindow: "drinks",
  },
];

// Interactive Time Window Filters
const TIME_WINDOWS = [
  { id: "dinner", label: "Dinner", time: "6:30 – 8:30 PM", icon: Moon, emoji: "🌙" },
  { id: "drinks", label: "Happy Hour", time: "5:00 – 7:00 PM", icon: GlassWater, emoji: "🍸" },
  { id: "lunch", label: "Lunch", time: "12:00 – 2:00 PM", icon: Sun, emoji: "☀️" },
  { id: "brunch", label: "Brunch", time: "10:30 AM – 1:00 PM", icon: Coffee, emoji: "🥞" },
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
  { id: "c_veg", emoji: "🥦", label: "Likely vegetarian-friendly", type: "dietary" as const },
  { id: "c_kid", emoji: "👶", label: "Likely kid-friendly", type: "kid_friendly" as const },
  { id: "c_patio", emoji: "☀️", label: "Outdoor patio", type: "other" as const },
  { id: "c_bar", emoji: "🍸", label: "Full bar / Cocktails", type: "vibe" as const },
  { id: "c_gf", emoji: "🌾", label: "Gluten-free options", type: "dietary" as const },
  { id: "c_quiet", emoji: "🤫", label: "Quiet conversation", type: "vibe" as const },
  { id: "c_halal", emoji: "🥩", label: "Halal options", type: "dietary" as const },
];

// Initial Candidate Dates
const INITIAL_DATES: DateSlotOption[] = [
  { id: "2026-11-25_PM", label: "Wed, Nov 25 • Evening", vetoedBy: null },
  { id: "2026-11-26_PM", label: "Thu, Nov 26 • Evening", vetoedBy: null },
  { id: "2026-11-27_PM", label: "Fri, Nov 27 • Evening", vetoedBy: null },
  { id: "2026-11-28_PM", label: "Sat, Nov 28 • Evening", vetoedBy: null },
  { id: "2026-11-29_PM", label: "Sun, Nov 29 • Evening", vetoedBy: null },
];

const INITIAL_NAMES = ["Ankit", "Raj", "Priya", "Mike", "Sarah", "Dan", "Maya", "Tom"];

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
  const [inputText, setInputText] = useState(PROMPT_PRESETS[0].text);
  const [isParsing, setIsParsing] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Synchronous state so all sections are immediately visible & interactive
  const [candidateDates, setCandidateDates] = useState<DateSlotOption[]>(INITIAL_DATES);
  const [selectedDateIds, setSelectedDateIds] = useState<string[]>(["2026-11-25_PM", "2026-11-26_PM", "2026-11-27_PM", "2026-11-28_PM"]);
  const [activeTimeWindow, setActiveTimeWindow] = useState<string>("dinner");
  const [selectedArea, setSelectedArea] = useState<string>("Midtown Atlanta");

  const [activeConstraints, setActiveConstraints] = useState<ConstraintItem[]>([
    { id: "c_ex_tue", type: "excluded_day", label: "Not Tuesday", confirmed: true },
    { id: "c_veg", type: "dietary", label: "Likely vegetarian-friendly", confirmed: true },
    { id: "c_kid", type: "kid_friendly", label: "Likely kid-friendly", confirmed: true },
    { id: "c_area", type: "area", label: "Midtown Atlanta", confirmed: true },
  ]);

  const [participants, setParticipants] = useState<Record<string, any>>(() => {
    const map: Record<string, any> = {};
    INITIAL_NAMES.forEach((name, idx) => {
      const id = `p_${name.toLowerCase()}`;
      map[id] = {
        name,
        status: idx === 0 ? "done" : "pending",
        isClaimed: idx === 0,
        vetoUsed: false,
        objectionUsed: false,
        acknowledgedLock: false,
        availableSlots: [],
        topPickVenueId: null,
        approvedVenueIds: [],
      };
    });
    return map;
  });

  const [headcount, setHeadcount] = useState<number>(8);
  const [isCreating, setIsCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Modals
  const [showAddDateModal, setShowAddDateModal] = useState(false);
  const [newDateLabel, setNewDateLabel] = useState("");
  const [showAddFilterModal, setShowAddFilterModal] = useState(false);
  const [newFilterLabel, setNewFilterLabel] = useState("");

  const handleParse = async (textToParse: string) => {
    if (!textToParse.trim()) return;
    setIsParsing(true);
    try {
      const res = await fetch("/api/sessions/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToParse }),
      });
      const data = await res.json();
      if (data.parsed) {
        const p = data.parsed;
        if (p.dateSlots && p.dateSlots.length > 0) {
          setCandidateDates(p.dateSlots);
          setSelectedDateIds(p.dateSlots.map((s: any) => s.id));
        }
        if (p.constraints && p.constraints.length > 0) {
          setActiveConstraints(p.constraints);
          const areaC = p.constraints.find((c: any) => c.type === "area");
          if (areaC) setSelectedArea(areaC.label);
        }
        if (p.participants && Object.keys(p.participants).length > 0) {
          setParticipants(p.participants);
          setHeadcount(Object.keys(p.participants).length);
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

  const handleTimeWindowChange = (twId: string) => {
    setActiveTimeWindow(twId);
    const tw = TIME_WINDOWS.find((t) => t.id === twId);
    if (!tw) return;

    setCandidateDates((prev) =>
      prev.map((slot) => {
        const parts = slot.label.split(" • ");
        const datePart = parts[0] || slot.label;
        return {
          ...slot,
          label: `${datePart} • ${tw.label}`,
        };
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

  const handleAddCustomDate = () => {
    if (!newDateLabel.trim()) return;
    const cleanLabel = newDateLabel.trim();
    const newId = `custom_slot_${Date.now()}`;
    const newSlot: DateSlotOption = {
      id: newId,
      label: cleanLabel,
      vetoedBy: null,
    };
    setCandidateDates((prev) => [...prev, newSlot]);
    setSelectedDateIds((prev) => [...prev, newId]);
    setNewDateLabel("");
    setShowAddDateModal(false);
  };

  const handleAddCustomFilter = () => {
    if (!newFilterLabel.trim()) return;
    toggleConstraintByLabel(newFilterLabel.trim());
    setNewFilterLabel("");
    setShowAddFilterModal(false);
  };

  const handleRemoveParticipant = (pId: string) => {
    setParticipants((prev) => {
      const updated = { ...prev };
      delete updated[pId];
      setHeadcount(Math.max(Object.keys(updated).length, 1));
      return updated;
    });
  };

  const handleCreate = async () => {
    const activeDateSlots = candidateDates.filter((s) => selectedDateIds.includes(s.id));
    if (activeDateSlots.length === 0) {
      alert("Please keep at least one candidate date selected.");
      return;
    }

    const confirmedConstraints = activeConstraints.filter((c) => c.confirmed);

    setIsCreating(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: `Meetup in ${selectedArea}`,
          expectedHeadcount: headcount,
          participants,
          constraints: confirmedConstraints,
          dateSlots: activeDateSlots,
          timeZone: "America/New_York",
        }),
      });
      const data = await res.json();
      if (data.shareUrl) {
        const fullShareUrl = window.location.origin + data.shareUrl;
        setCreatedUrl(fullShareUrl);
      }
    } catch (err) {
      console.error("Create session error:", err);
      alert("Failed to create meetup session. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareToChat = async () => {
    if (!createdUrl) return;
    const shareText = `Hey! Locking in dinner with the crew in ${selectedArea}. Tap your name to mark availability (10 sec, no signup):\n${createdUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "SyncUp Meetup",
          text: shareText,
          url: createdUrl,
        });
        return;
      } catch (e) {
        // Fallback
      }
    }
    copyToClipboard(shareText);
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

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 shadow-xs text-[11px] font-black text-emerald-900 tracking-tight">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>NO APP • NO SIGNUP</span>
        </div>
      </header>

      {/* SUCCESS / CREATED ROOM CARD */}
      {createdUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in py-8 px-2">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white mb-4 shadow-xl shadow-emerald-500/30 ring-8 ring-emerald-50">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Meetup Room Live!</h2>
          <p className="text-xs text-slate-600 mt-1.5 max-w-xs leading-relaxed">
            Drop this single link into your WhatsApp or iMessage thread. Friends tap their name to vote in 10 seconds.
          </p>

          <div className="w-full mt-6 bg-white border border-slate-200/80 rounded-2xl p-4 text-left shadow-sm">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Shareable Group Link
            </label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800 break-all select-all">
              <span className="truncate flex-1">{createdUrl}</span>
              <button
                onClick={() => copyToClipboard(createdUrl)}
                className="p-1.5 bg-white hover:bg-slate-100 rounded-lg text-slate-600 shadow-xs border border-slate-200 active:scale-95 transition"
                title="Copy link"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              Your host admin key is saved in this link.
            </p>
          </div>

          <div className="w-full mt-6 space-y-2.5">
            <button
              onClick={shareToChat}
              className="w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-4 rounded-2xl shadow-xl shadow-emerald-600/30 active:scale-[0.98] transition text-sm"
            >
              <Share2 className="w-4 h-4" />
              <span>Share to Group Chat</span>
            </button>

            <button
              onClick={() => router.push(createdUrl.replace(window.location.origin, ""))}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-800 font-bold py-3.5 px-4 rounded-2xl border border-slate-200 shadow-xs active:scale-[0.98] transition text-xs"
            >
              <span>Open Meetup Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>
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

          {/* INTERACTIVE 30-SECOND WALKTHROUGH ACCORDION */}
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
                    <span className="text-emerald-800 text-[11px]">Type or tap your dates, time window (Dinner/Lunch), and neighborhood.</span>
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

          {/* ============================================================== */}
          {/* STEP 1 WALKTHROUGH CARD: THE PROMPT & 1-TAP TEMPLATES */}
          {/* ============================================================== */}
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
                placeholder="Type your messy sentence: e.g. Dinner next week for 8 of us—Ankit, Raj, Priya, Mike. Not Tuesday. Midtown Atlanta, veg & kid-friendly"
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

          {/* ============================================================== */}
          {/* STEP 2 WALKTHROUGH CARD: CANDIDATE DATES & TIME FILTERS */}
          {/* ============================================================== */}
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
                <span>+ Custom Date</span>
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
                      onClick={() => handleTimeWindowChange(tw.id)}
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

          {/* ============================================================== */}
          {/* STEP 3 WALKTHROUGH CARD: ATLANTA NEIGHBORHOOD & PREFERENCES */}
          {/* ============================================================== */}
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
                <span>+ Custom</span>
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

            {/* Dietary & Vibe Filter Badges */}
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

          {/* ============================================================== */}
          {/* STEP 4 WALKTHROUGH CARD: FRIENDS INCLUDED */}
          {/* ============================================================== */}
          <section className="bg-white border border-slate-200/90 rounded-[28px] p-4.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                  4
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Step 4: Confirm Friends ({Object.keys(participants).length} chips)
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Friends simply tap their name chip to vote (zero passwords)
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(participants).map(([id, p], idx) => {
                const gradient = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                return (
                  <div
                    key={id}
                    className={`text-xs pl-2 pr-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition ${
                      idx === 0
                        ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold shadow-xs"
                        : "bg-slate-50 border-slate-200/80 text-slate-800"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-lg bg-gradient-to-tr ${gradient} text-white font-black text-[10px] flex items-center justify-center shrink-0`}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate max-w-[100px] font-bold">
                      {p.name} {idx === 0 && "(Host)"}
                    </span>
                    {idx !== 0 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(id)}
                        className="text-slate-400 hover:text-red-500 font-black ml-0.5 text-sm"
                        title="Remove"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
              <span className="text-[11px] text-slate-400 self-center italic px-1">
                + anyone can join via link
              </span>
            </div>
          </section>

          {/* LARGE TACTILE ACTION BUTTON */}
          <section className="pt-1">
            <button
              onClick={handleCreate}
              disabled={isCreating || selectedDateIds.length === 0}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-black py-4 px-5 rounded-2xl shadow-xl shadow-emerald-600/30 active:scale-[0.98] transition text-base tracking-tight"
            >
              {isCreating ? (
                <>
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Generating Poll Room...</span>
                </>
              ) : (
                <>
                  <span>Create Meetup & Get WhatsApp Link</span>
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

      {/* Add Date Modal */}
      {showAddDateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Add Candidate Date</h3>
              <button
                onClick={() => setShowAddDateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Type the date and time window:
            </p>

            <input
              type="text"
              value={newDateLabel}
              onChange={(e) => setNewDateLabel(e.target.value)}
              placeholder="e.g. Sun, Nov 29 • Evening"
              autoFocus
              className="w-full p-3.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowAddDateModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomDate}
                disabled={!newDateLabel.trim()}
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
              placeholder="e.g. Rooftop or Halal friendly"
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
