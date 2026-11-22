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
} from "lucide-react";
import { ParsedSessionIntent } from "@/lib/server/parser";
import { ConstraintItem, DateSlotOption } from "@/types/session";

const PROMPT_PRESETS = [
  {
    emoji: "🥘",
    label: "Midtown Atlanta (8 friends)",
    text: "Dinner next week for 8 of us—Ankit, Raj, Priya, Mike, Sarah, Dan, Maya, Tom. Not Tuesday. Midtown Atlanta, veg & kid-friendly",
  },
  {
    emoji: "☀️",
    label: "BeltLine / Inman Park Brunch",
    text: "Saturday brunch on the Atlanta BeltLine around Inman Park with Sarah, Dan, Chloe & Leo. Patio & kid-friendly",
  },
  {
    emoji: "🍕",
    label: "Westside / West Midtown",
    text: "Dinner this Thursday in West Midtown near Howell Mill with Dave, Elena, Sam & Priya. Good cocktails & gluten-free options",
  },
  {
    emoji: "🍸",
    label: "Buckhead Happy Hour",
    text: "Friday drinks after work in Buckhead with the team. Good patio & cocktails",
  },
];

const SUGGESTED_FILTERS = [
  { emoji: "🥦", label: "Likely vegetarian-friendly" },
  { emoji: "👶", label: "Likely kid-friendly" },
  { emoji: "☀️", label: "Outdoor seating" },
  { emoji: "🍸", label: "Full bar / Cocktails" },
  { emoji: "🤫", label: "Quiet conversation" },
  { emoji: "💵", label: "Budget-friendly ($$)" },
];

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
  const [parsed, setParsed] = useState<ParsedSessionIntent | null>(null);
  const [selectedDateIds, setSelectedDateIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [clarifierAnswers, setClarifierAnswers] = useState<Record<string, string>>({});

  // Modals
  const [showAddDateModal, setShowAddDateModal] = useState(false);
  const [newDateLabel, setNewDateLabel] = useState("");
  const [showAddFilterModal, setShowAddFilterModal] = useState(false);
  const [newFilterLabel, setNewFilterLabel] = useState("");

  // Parse on load with initial preset
  useEffect(() => {
    handleParse(PROMPT_PRESETS[0].text);
  }, []);

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
        setParsed(data.parsed);
        setSelectedDateIds(data.parsed.dateSlots?.map((s: any) => s.id) || []);
        const initialAnswers: Record<string, string> = {};
        data.parsed.clarifiers?.forEach((c: any) => {
          if (c.selected) initialAnswers[c.id] = c.selected;
        });
        setClarifierAnswers(initialAnswers);
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

  const toggleConstraint = (constraintId: string) => {
    if (!parsed) return;
    setParsed({
      ...parsed,
      constraints: parsed.constraints.map((c) =>
        c.id === constraintId ? { ...c, confirmed: !c.confirmed } : c
      ),
    });
  };

  const handleAddCustomDate = () => {
    if (!newDateLabel.trim() || !parsed) return;
    const cleanLabel = newDateLabel.trim();
    const newId = `custom_slot_${Date.now()}`;
    const newSlot: DateSlotOption = {
      id: newId,
      label: cleanLabel,
      vetoedBy: null,
    };
    setParsed({
      ...parsed,
      dateSlots: [...parsed.dateSlots, newSlot],
    });
    setSelectedDateIds((prev) => [...prev, newId]);
    setNewDateLabel("");
    setShowAddDateModal(false);
  };

  const handleAddCustomFilter = (labelToAdd?: string) => {
    const label = (labelToAdd || newFilterLabel).trim();
    if (!label || !parsed) return;

    const exists = parsed.constraints.find(
      (c) => c.label.toLowerCase() === label.toLowerCase()
    );
    if (exists) {
      setParsed({
        ...parsed,
        constraints: parsed.constraints.map((c) =>
          c.label.toLowerCase() === label.toLowerCase() ? { ...c, confirmed: true } : c
        ),
      });
    } else {
      const newConstraint: ConstraintItem = {
        id: `c_custom_${Date.now()}`,
        type: "other",
        label,
        confirmed: true,
      };
      setParsed({
        ...parsed,
        constraints: [...parsed.constraints, newConstraint],
      });
    }
    setNewFilterLabel("");
    setShowAddFilterModal(false);
  };

  const handleRemoveParticipant = (pId: string) => {
    if (!parsed) return;
    const updated = { ...parsed.participants };
    delete updated[pId];
    setParsed({
      ...parsed,
      participants: updated,
      expectedHeadcount: Math.max(Object.keys(updated).length, 1),
    });
  };

  const handleCreate = async () => {
    if (!parsed) return;

    const activeDateSlots = parsed.dateSlots.filter((s) => selectedDateIds.includes(s.id));
    if (activeDateSlots.length === 0) {
      alert("Please select at least one candidate date for the meetup.");
      return;
    }

    const activeConstraints = parsed.constraints.filter((c) => c.confirmed);

    setIsCreating(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: parsed.topic,
          expectedHeadcount: parsed.expectedHeadcount,
          participants: parsed.participants,
          constraints: activeConstraints,
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
    const shareText = `Hey! Locking in ${parsed?.topic || "dinner"} with the crew. Tap your name to mark availability (10 sec, no signup):\n${createdUrl}`;

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
      {/* Sleek App Bar */}
      <header className="flex items-center justify-between pb-3.5 mb-2 border-b border-slate-200/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center text-white font-black shadow-md shadow-emerald-500/25">
            <span className="text-base tracking-tighter">S</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">SyncUp</h1>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">v1.3</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Zero-Signup Group Coordination</p>
          </div>
        </div>

        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200/80 shadow-xs text-xs font-semibold text-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Zero Passwords</span>
        </div>
      </header>

      {/* SUCCESS / CREATED ROOM MODAL */}
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
              Your organizer key is embedded in this link.
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
            {/* Background subtle mesh glow */}
            <div className="absolute -top-16 -right-16 w-44 h-44 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none" />

            <div className="relative z-10 space-y-3">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 rounded-full shadow-xs">
                <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                <span>The Anti-Doodle for Group Chats</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight text-white">
                Lock in <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-green-200">When & Where</span> without the 50-message debate.
              </h2>

              <p className="text-xs text-slate-300 leading-relaxed">
                WhatsApp polls break when availability, food diets, and neighborhoods overlap. Doodle takes 20 form fields. 
                SyncUp takes <strong>1 messy sentence</strong> and gets everyone aligned in 10 seconds.
              </p>

              {/* Instant Before vs After Comparison Strip */}
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

          {/* QUICK PRESET PILLS */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Try a 1-tap example:
              </label>
            </div>
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
                    }}
                    className={`text-xs px-3 py-2 rounded-2xl border shrink-0 font-medium transition flex items-center gap-1.5 active:scale-95 ${
                      isActive
                        ? "bg-slate-900 border-slate-900 text-white font-bold shadow-md shadow-slate-900/10"
                        : "bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 shadow-xs"
                    }`}
                  >
                    <span>{preset.emoji}</span>
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* MAGIC PROMPT TEXTAREA */}
          <section className="space-y-1.5">
            <div className="relative group">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={3}
                className="w-full p-4 text-xs sm:text-sm rounded-2xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white resize-none text-slate-900 shadow-sm leading-relaxed"
                placeholder="Type your messy sentence: e.g. Dinner next week for 8 of us—Ankit, Raj, Priya, Mike. Not Tuesday. Midtown Atlanta, veg & kid-friendly"
              />
              {isParsing && (
                <div className="absolute right-3.5 bottom-3.5 flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/60 shadow-xs">
                  <div className="w-3 h-3 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                  <span>Extracting plan...</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span className="text-[11px] text-slate-400">
                AI extracts friends, constraints & grounded dates
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

          {/* INTERACTIVE PARSED SUMMARY (Clickable candidate dates and filters) */}
          {parsed && (
            <section className="space-y-4 bg-white border border-slate-200/80 rounded-[28px] p-4.5 shadow-sm animate-fade-in">
              {/* Friends Named Chip Carousel */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Crew Named ({Object.keys(parsed.participants).length})</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Tap × to remove</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {Object.entries(parsed.participants).map(([id, p], idx) => {
                    const gradient = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                    return (
                      <div
                        key={id}
                        className={`text-xs pl-1.5 pr-2.5 py-1 rounded-xl border flex items-center gap-1.5 transition ${
                          idx === 0
                            ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold shadow-xs"
                            : "bg-slate-50 border-slate-200/80 text-slate-800"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-lg bg-gradient-to-tr ${gradient} text-white font-black text-[10px] flex items-center justify-center shrink-0`}>
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate max-w-[100px]">{p.name} {idx === 0 && "(You)"}</span>
                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(id)}
                            className="text-slate-400 hover:text-red-500 font-bold ml-0.5 text-sm"
                            title="Remove from list"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <span className="text-[11px] text-slate-400 self-center italic px-1">
                    + anyone can join
                  </span>
                </div>
              </div>

              {/* CLICKABLE CANDIDATE DATES & CLICKABLE ACTIVE FILTERS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-slate-100">
                {/* 1. Candidate Dates (Clickable with Visual Feedback) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Candidate Dates</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddDateModal(true)}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200/60"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Tap to toggle dates included in poll:
                  </p>

                  <div className="space-y-1.5">
                    {parsed.dateSlots.map((s) => {
                      const isSelected = selectedDateIds.includes(s.id);
                      // Extract day and month if available
                      const parts = s.label.split(" • ");
                      const dateTitle = parts[0] || s.label;
                      const timeWindow = parts[1] || "Evening";

                      return (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => toggleDateSlot(s.id)}
                          className={`w-full text-left p-2.5 rounded-2xl border flex items-center justify-between gap-2 transition active:scale-[0.98] ${
                            isSelected
                              ? "bg-white border-emerald-500/80 text-slate-900 shadow-xs font-semibold ring-1 ring-emerald-500/20"
                              : "bg-slate-100/60 border-slate-200 text-slate-400 line-through opacity-70"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-xl flex flex-col items-center justify-center text-[10px] font-black shrink-0 ${
                              isSelected ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-500"
                            }`}>
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-900 block truncate">{dateTitle}</span>
                              <span className="text-[10px] text-slate-500 font-medium">{timeWindow}</span>
                            </div>
                          </div>

                          {isSelected ? (
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                              <Plus className="w-3 h-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Active Filters (Clickable with Visual Feedback) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Active Filters</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddFilterModal(true)}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200/60"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Tap to toggle constraints on / off:
                  </p>

                  <div className="space-y-1.5">
                    {parsed.constraints.map((c) => {
                      const isActive = c.confirmed !== false;
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => toggleConstraint(c.id)}
                          className={`w-full text-left p-2.5 rounded-2xl border flex items-center justify-between gap-2 transition active:scale-[0.98] ${
                            isActive
                              ? "bg-white border-emerald-500/80 text-slate-900 shadow-xs font-semibold ring-1 ring-emerald-500/20"
                              : "bg-slate-100/60 border-slate-200 text-slate-400 line-through opacity-70"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {c.type === "dietary" ? "🥗" : c.type === "excluded_day" ? "🚫" : c.type === "area" ? "📍" : "✨"}
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">{c.label}</span>
                          </div>

                          {isActive ? (
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                              <Plus className="w-3 h-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 1-Tap Suggested Filter Strip */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  1-Tap Filter Suggestions
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_FILTERS.map((sug) => {
                    const alreadyActive = parsed.constraints.some(
                      (c) => c.label.toLowerCase() === sug.label.toLowerCase() && c.confirmed !== false
                    );
                    return (
                      <button
                        key={sug.label}
                        type="button"
                        onClick={() => handleAddCustomFilter(sug.label)}
                        className={`text-xs px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 active:scale-95 ${
                          alreadyActive
                            ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold shadow-xs"
                            : "bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span>{sug.emoji}</span>
                        <span>{sug.label}</span>
                        {alreadyActive ? (
                          <Check className="w-3 h-3 text-emerald-600 ml-0.5" />
                        ) : (
                          <Plus className="w-3 h-3 text-slate-400 ml-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1-2 Quick Tap Clarifiers */}
              {parsed.clarifiers && parsed.clarifiers.length > 0 && (
                <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Quick Clarifiers (Optional)
                  </span>
                  {parsed.clarifiers.map((cl) => (
                    <div key={cl.id} className="space-y-1">
                      <p className="text-xs font-semibold text-slate-800">{cl.question}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cl.options.map((opt) => {
                          const isSelected = clarifierAnswers[cl.id] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() =>
                                setClarifierAnswers((prev) => ({
                                  ...prev,
                                  [cl.id]: opt,
                                }))
                              }
                              className={`text-xs px-3 py-1.5 rounded-xl border transition active:scale-95 ${
                                isSelected
                                  ? "bg-slate-900 border-slate-900 text-white font-bold shadow-sm"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* LARGE TACTILE ACTION BUTTON */}
          <section className="pt-1">
            <button
              onClick={handleCreate}
              disabled={isCreating || !parsed || selectedDateIds.length === 0}
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
              className="w-full p-3.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
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
              placeholder="e.g. Rooftop or Gluten-free friendly"
              autoFocus
              className="w-full p-3.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowAddFilterModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddCustomFilter()}
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
