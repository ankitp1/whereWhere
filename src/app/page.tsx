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
  UtensilsCrossed,
  Info,
  Plus,
  X,
  Zap,
  Flame,
  CheckCircle,
  HelpCircle,
  ArrowDown,
  MessageCircle,
} from "lucide-react";
import { ParsedSessionIntent } from "@/lib/server/parser";
import { ConstraintItem, DateSlotOption } from "@/types/session";

const PROMPT_PRESETS = [
  {
    label: "🍽️ Midtown Dinner (8 friends)",
    text: "Dinner next week for 8 of us—Ankit, Raj, Priya, Mike, Sarah, Dan, Maya, Tom. Not Tuesday. Midtown, veg & kid-friendly",
  },
  {
    label: "🥞 West Village Brunch",
    text: "Sunday brunch in West Village with Sarah, Dan, Chloe & Leo. Outdoor seating, kid-friendly",
  },
  {
    label: "🍸 Friday Happy Hour",
    text: "Drinks this Friday after work with Dave, Elena, Sam & Priya. Flatiron area with good cocktails",
  },
];

const SUGGESTED_FILTERS = [
  { id: "c_sug_veg", type: "dietary" as const, label: "Likely vegetarian-friendly" },
  { id: "c_sug_kid", type: "kid_friendly" as const, label: "Likely kid-friendly" },
  { id: "c_sug_outdoor", type: "other" as const, label: "Outdoor seating" },
  { id: "c_sug_bar", type: "vibe" as const, label: "Full bar / Cocktails" },
  { id: "c_sug_quiet", type: "vibe" as const, label: "Quiet conversation" },
  { id: "c_sug_budget", type: "other" as const, label: "Budget-friendly ($$)" },
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

  // Auto-parse on load
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
    <main className="flex-1 flex flex-col p-4 pb-12">
      {/* Brand Header */}
      <header className="flex items-center justify-between py-2.5 border-b border-slate-100 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center text-white font-black shadow-md shadow-brand-500/20">
            S
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">SyncUp</h1>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Zero-Signup Group Coordination</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
          <span>Zero Passwords</span>
        </div>
      </header>

      {/* SUCCESS MODAL / CARD */}
      {createdUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in py-6">
          <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 mb-4 ring-8 ring-brand-50/50">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Meetup Room Ready!</h2>
          <p className="text-sm text-slate-600 mt-1 max-w-xs">
            Drop this single link into your WhatsApp or iMessage thread. Friends tap their name to vote in 10 seconds.
          </p>

          <div className="w-full mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Shareable Group Link
            </label>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 break-all select-all">
              <span className="truncate flex-1">{createdUrl}</span>
              <button
                onClick={() => copyToClipboard(createdUrl)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 active:scale-95 transition"
                title="Copy link"
              >
                {copied ? <Check className="w-4 h-4 text-brand-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              Your organizer key is saved in this link so you can manage lock-in.
            </p>
          </div>

          <div className="w-full mt-5 space-y-2.5">
            <button
              onClick={shareToChat}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition"
            >
              <Share2 className="w-4 h-4" />
              <span>Share to Group Chat</span>
            </button>

            <button
              onClick={() => router.push(createdUrl.replace(window.location.origin, ""))}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-3 px-4 rounded-xl active:scale-[0.98] transition text-sm"
            >
              <span>Open Meetup Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col space-y-4">
          {/* VALUE PROPOSITION HERO CARD */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-4.5 shadow-lg space-y-3 border border-slate-800">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-2.5 py-0.5 rounded-full w-fit">
              <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
              <span>The Anti-Doodle for Group Chats</span>
            </div>

            <h2 className="text-xl font-black tracking-tight leading-snug text-white">
              Lock in <span className="text-brand-400">When & Where</span> without 50 messages back and forth.
            </h2>

            <p className="text-xs text-slate-300 leading-relaxed">
              WhatsApp polls break when dates and food restrictions overlap. Doodle requires tedious form setups. 
              <strong> SyncUp takes 1 messy sentence</strong>, generates grounded options, and reaches quorum fast.
            </p>

            {/* 3 Value Pillars */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[10px]">
              <div className="flex flex-col items-center text-center p-1.5 bg-white/5 rounded-xl">
                <span className="font-bold text-emerald-400 mb-0.5">10-Sec Setup</span>
                <span className="text-slate-300">Just type 1 sentence</span>
              </div>
              <div className="flex flex-col items-center text-center p-1.5 bg-white/5 rounded-xl">
                <span className="font-bold text-brand-400 mb-0.5">Zero Friction</span>
                <span className="text-slate-300">Friends tap & vote</span>
              </div>
              <div className="flex flex-col items-center text-center p-1.5 bg-white/5 rounded-xl">
                <span className="font-bold text-amber-400 mb-0.5">Anti-Revolt</span>
                <span className="text-slate-300">2h lock window & .ics</span>
              </div>
            </div>
          </div>

          {/* Quick Preset Prompts */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Try a 1-tap template or type below:</span>
            </label>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {PROMPT_PRESETS.map((preset, idx) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setInputText(preset.text);
                    handleParse(preset.text);
                  }}
                  className={`text-[11px] px-3 py-1.5 rounded-xl border shrink-0 font-medium transition ${
                    inputText === preset.text
                      ? "bg-slate-900 border-slate-900 text-white font-semibold"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Input Area */}
          <div className="space-y-1.5">
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={3}
                className="w-full p-3.5 text-xs sm:text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition bg-white resize-none text-slate-900 shadow-sm leading-relaxed"
                placeholder="Type your messy sentence: e.g. Dinner next week for 8 of us—Ankit, Raj, Priya, Mike. Not Tuesday. Midtown, veg & kid-friendly"
              />
              {isParsing && (
                <div className="absolute right-3 bottom-3 flex items-center gap-1.5 text-xs text-brand-600 font-medium bg-brand-50 px-2 py-1 rounded-lg">
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                  <span>Parsing...</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span className="text-[11px] text-slate-400">
                AI extracts dates, names, diets & area
              </span>
              <button
                type="button"
                onClick={() => handleParse(inputText)}
                className="text-brand-600 font-semibold hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg transition text-[11px] flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Re-analyze</span>
              </button>
            </div>
          </div>

          {/* PARSED INTERACTIVE CARD (Clickable candidate dates and filters) */}
          {parsed && (
            <div className="space-y-3.5 bg-slate-50/90 border border-slate-200 rounded-3xl p-3.5 animate-fade-in shadow-xs">
              {/* Friends Named Chip Carousel */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-brand-600" />
                    <span>Crew Named ({Object.keys(parsed.participants).length})</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Tap × to remove</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(parsed.participants).map(([id, p], idx) => (
                    <span
                      key={id}
                      className={`text-xs px-2.5 py-1 rounded-xl font-medium border flex items-center gap-1.5 transition ${
                        idx === 0
                          ? "bg-brand-50 border-brand-200 text-brand-800 font-semibold"
                          : "bg-white border-slate-200 text-slate-700"
                      }`}
                    >
                      <span>{p.name} {idx === 0 && "(You)"}</span>
                      {idx !== 0 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(id)}
                          className="text-slate-400 hover:text-red-500 ml-0.5 font-bold"
                          title="Remove from list"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                  <span className="text-[11px] text-slate-400 self-center italic px-1">
                    + anyone can join
                  </span>
                </div>
              </div>

              {/* CLICKABLE CANDIDATE DATES & CLICKABLE ACTIVE FILTERS */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
                {/* 1. Candidate Dates (Clickable with Visual Feedback) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-brand-600" />
                      <span>Candidate Dates</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddDateModal(true)}
                      className="text-[10px] text-brand-600 hover:text-brand-700 font-bold flex items-center gap-0.5 bg-brand-50 hover:bg-brand-100 px-1.5 py-0.5 rounded-md"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Add</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Tap to include / exclude:
                  </p>

                  <div className="space-y-1.5">
                    {parsed.dateSlots.map((s) => {
                      const isSelected = selectedDateIds.includes(s.id);
                      return (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => toggleDateSlot(s.id)}
                          className={`w-full text-left text-xs px-2.5 py-2 rounded-xl border flex items-center justify-between gap-1 transition active:scale-[0.98] ${
                            isSelected
                              ? "bg-white border-brand-400 text-slate-900 shadow-xs font-semibold ring-1 ring-brand-500/10"
                              : "bg-slate-100 border-slate-200 text-slate-400 line-through"
                          }`}
                        >
                          <span className="truncate">{s.label}</span>
                          {isSelected ? (
                            <span className="w-4 h-4 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3" />
                            </span>
                          ) : (
                            <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                              <Plus className="w-3 h-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Active Filters (Clickable with Visual Feedback) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-brand-600" />
                      <span>Active Filters</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddFilterModal(true)}
                      className="text-[10px] text-brand-600 hover:text-brand-700 font-bold flex items-center gap-0.5 bg-brand-50 hover:bg-brand-100 px-1.5 py-0.5 rounded-md"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Add</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Tap to toggle on / off:
                  </p>

                  <div className="space-y-1.5">
                    {parsed.constraints.map((c) => {
                      const isActive = c.confirmed !== false;
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => toggleConstraint(c.id)}
                          className={`w-full text-left text-xs px-2.5 py-2 rounded-xl border flex items-center justify-between gap-1 transition active:scale-[0.98] ${
                            isActive
                              ? "bg-white border-brand-400 text-slate-900 shadow-xs font-semibold ring-1 ring-brand-500/10"
                              : "bg-slate-100 border-slate-200 text-slate-400 line-through"
                          }`}
                        >
                          <span className="truncate">{c.label}</span>
                          {isActive ? (
                            <span className="w-4 h-4 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3" />
                            </span>
                          ) : (
                            <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                              <Plus className="w-3 h-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Quick Preset Filter Chips */}
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
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
                        className={`text-[11px] px-2.5 py-1 rounded-xl border transition flex items-center gap-1 active:scale-95 ${
                          alreadyActive
                            ? "bg-brand-50 border-brand-300 text-brand-900 font-semibold"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {alreadyActive ? (
                          <Check className="w-3 h-3 text-brand-600" />
                        ) : (
                          <Plus className="w-3 h-3 text-slate-400" />
                        )}
                        <span>{sug.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1-2 Quick Tap Clarifiers */}
              {parsed.clarifiers && parsed.clarifiers.length > 0 && (
                <div className="pt-2 border-t border-slate-200/80 space-y-2">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Quick Clarifiers (Optional)
                  </span>
                  {parsed.clarifiers.map((cl) => (
                    <div key={cl.id} className="space-y-1">
                      <p className="text-xs font-medium text-slate-700">{cl.question}</p>
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
                              className={`text-xs px-2.5 py-1 rounded-xl border transition ${
                                isSelected
                                  ? "bg-slate-900 border-slate-900 text-white font-medium"
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
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
            </div>
          )}

          {/* Create Action Button */}
          <div className="pt-1">
            <button
              onClick={handleCreate}
              disabled={isCreating || !parsed || selectedDateIds.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold py-4 px-4 rounded-2xl shadow-xl shadow-brand-600/25 active:scale-[0.98] transition text-base"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Creating Meetup Room...</span>
                </>
              ) : (
                <>
                  <span>Create Meetup & Get Share Link</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-slate-400 mt-2">
              Ready in 10 seconds • No app download • Zero passwords
            </p>
          </div>
        </div>
      )}

      {/* Add Date Modal */}
      {showAddDateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add Candidate Date</h3>
              <button
                onClick={() => setShowAddDateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
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
              className="w-full p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowAddDateModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomDate}
                disabled={!newDateLabel.trim()}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition"
              >
                Add Date
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Filter Modal */}
      {showAddFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add Preference / Filter</h3>
              <button
                onClick={() => setShowAddFilterModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
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
              className="w-full p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowAddFilterModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddCustomFilter()}
                disabled={!newFilterLabel.trim()}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition"
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
