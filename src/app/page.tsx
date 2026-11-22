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
  Copy,
  Check,
  Plus,
  X,
  Edit2,
  Ban,
  Utensils,
  ChevronRight,
  KeyRound,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { ConstraintItem, DateSlotOption } from "@/types/session";

// Authentic Atlanta Presets
const PROMPT_PRESETS = [
  {
    emoji: "🥘",
    label: "Dinner in Midtown",
    text: "Dinner next week for 8 of us—Ankit, Raj, Priya, Mike, Sarah, Dan, Maya, Tom. Not Tuesday. Midtown Atlanta, veg & kid-friendly",
    area: "Midtown Atlanta",
    timeWindow: "dinner" as const,
  },
  {
    emoji: "🥞",
    label: "Weekend Brunch",
    text: "Saturday brunch on the Atlanta BeltLine around Inman Park with Sarah, Dan, Chloe & Leo. Patio & kid-friendly",
    area: "BeltLine / Inman Park",
    timeWindow: "brunch" as const,
  },
  {
    emoji: "🍸",
    label: "BeltLine Drinks",
    text: "Friday drinks after work along the BeltLine near Inman Park with the crew. Good cocktails & patio",
    area: "BeltLine / Inman Park",
    timeWindow: "drinks" as const,
  },
  {
    emoji: "🍕",
    label: "West Midtown Dinner",
    text: "Dinner this Thursday in West Midtown near Howell Mill with Dave, Elena, Sam & Priya. Cocktails & gluten-free options",
    area: "West Midtown",
    timeWindow: "dinner" as const,
  },
];

// Interactive Time Window Filters
const TIME_WINDOWS = [
  { id: "dinner", label: "Dinner", time: "6:30 – 8:30 PM", emoji: "🌙" },
  { id: "drinks", label: "Happy Hour", time: "5:00 – 7:00 PM", emoji: "🍸" },
  { id: "lunch", label: "Lunch", time: "12:00 – 2:00 PM", emoji: "☀️" },
  { id: "brunch", label: "Brunch", time: "10:30 AM – 1:00 PM", emoji: "🥞" },
];

// Atlanta Neighborhoods
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
  { id: "c_halal", emoji: "🥩", label: "Halal options", type: "dietary" as const },
];

// Dynamic upcoming dates generator based on today's real date
function generateDynamicDates(timeWindow: string): DateSlotOption[] {
  const now = new Date();
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const windowLabel = TIME_WINDOWS.find((t) => t.id === timeWindow)?.label || "Dinner";

  const slots: DateSlotOption[] = [];
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

export default function CreateSessionPage() {
  const router = useRouter();

  // Wizard state: O1 (input) -> O2 (preview) -> O3 (share)
  const [organizerStep, setOrganizerStep] = useState<"input" | "preview" | "share">("input");
  const [activeEditor, setActiveEditor] = useState<null | "time" | "dates" | "area" | "filters" | "crew">(null);

  const [inputText, setInputText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Core structured state
  const [activeTimeWindow, setActiveTimeWindow] = useState<"dinner" | "lunch" | "brunch" | "drinks">("dinner");
  const [candidateDates, setCandidateDates] = useState<DateSlotOption[]>(() => generateDynamicDates("dinner"));
  const [selectedDateIds, setSelectedDateIds] = useState<string[]>(() =>
    generateDynamicDates("dinner").slice(0, 3).map((s) => s.id)
  );
  const [selectedArea, setSelectedArea] = useState<string>("Midtown Atlanta");
  const [activeConstraints, setActiveConstraints] = useState<ConstraintItem[]>([
    { id: "c_veg", type: "dietary", label: "Vegetarian-friendly", confirmed: true },
    { id: "c_kid", type: "kid_friendly", label: "Kid-friendly", confirmed: true },
    { id: "c_area", type: "area", label: "Midtown Atlanta", confirmed: true },
  ]);
  const [friendsList, setFriendsList] = useState<string[]>([
    "Ankit",
    "Raj",
    "Priya",
    "Mike",
    "Sarah",
    "Dan",
    "Maya",
    "Tom",
  ]);
  const [hostIndex, setHostIndex] = useState<number>(0);
  const [newFriendInput, setNewFriendInput] = useState("");

  const [isCreating, setIsCreating] = useState(false);

  // Separate public share URL from private host recovery link
  const [publicShareUrl, setPublicShareUrl] = useState<string | null>(null);
  const [adminRecoveryUrl, setAdminRecoveryUrl] = useState<string | null>(null);
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);

  // Custom date picker inside modal
  const [customDateValue, setCustomDateValue] = useState("");

  // O1: Parse input sentence and move to O2
  const handleContinueFromInput = async () => {
    if (!inputText.trim()) {
      // Default to Midtown dinner template if empty
      setInputText(PROMPT_PRESETS[0].text);
      await parseAndAdvance(PROMPT_PRESETS[0].text);
      return;
    }
    await parseAndAdvance(inputText);
  };

  const parseAndAdvance = async (textToParse: string) => {
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
      setOrganizerStep("preview");
    } catch (err) {
      console.error("Parse error:", err);
      // Still advance to preview with sensible defaults
      setOrganizerStep("preview");
    } finally {
      setIsParsing(false);
    }
  };

  // O2: Create room and move to O3
  const handleCreate = async () => {
    const activeDateSlots = candidateDates.filter((s) => selectedDateIds.includes(s.id));
    if (activeDateSlots.length === 0) {
      setErrorMessage("Please select at least one candidate date.");
      return;
    }
    if (friendsList.length === 0) {
      setErrorMessage("Please list at least one friend.");
      return;
    }

    const confirmedConstraints = activeConstraints.filter((c) => c.confirmed);
    const currentHostName = friendsList[hostIndex] || friendsList[0] || "You";

    setIsCreating(true);
    setErrorMessage(null);
    try {
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
        setOrganizerStep("share");
      } else {
        throw new Error(data.error || "Failed to create meetup room");
      }
    } catch (err: any) {
      console.error("Create session error:", err);
      setErrorMessage(err.message || "Failed to create meetup. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // Time window handler
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

  const toggleDateSlot = (slotId: string) => {
    setSelectedDateIds((prev) =>
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    );
  };

  const handleAddCustomDate = () => {
    if (!customDateValue) return;
    const parts = customDateValue.split("-");
    if (parts.length !== 3) return;

    const [year, month, day] = parts;
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const windowLabel = TIME_WINDOWS.find((t) => t.id === activeTimeWindow)?.label || "Dinner";

    const slotId = `${customDateValue}_${activeTimeWindow}`;
    const newSlot: DateSlotOption = {
      id: slotId,
      date: customDateValue,
      timeWindow: activeTimeWindow as any,
      label: `${daysOfWeek[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} • ${windowLabel}`,
      vetoedBy: null,
    };

    setCandidateDates((prev) => [...prev, newSlot]);
    setSelectedDateIds((prev) => [...prev, slotId]);
    setCustomDateValue("");
  };

  const toggleConstraintByLabel = (label: string, type: "dietary" | "kid_friendly" | "other" | "vibe" = "other") => {
    setActiveConstraints((prev) => {
      const existing = prev.find((c) => c.label.toLowerCase() === label.toLowerCase());
      if (existing) {
        return prev.map((c) =>
          c.label.toLowerCase() === label.toLowerCase() ? { ...c, confirmed: !c.confirmed } : c
        );
      } else {
        return [...prev, { id: `c_${Date.now()}`, type, label, confirmed: true }];
      }
    });
  };

  const handleAddFriend = () => {
    if (!newFriendInput.trim()) return;
    const clean = newFriendInput.trim();
    if (!friendsList.includes(clean)) {
      setFriendsList((prev) => [...prev, clean]);
    }
    setNewFriendInput("");
  };

  const handleRemoveFriend = (idx: number) => {
    setFriendsList((prev) => prev.filter((_, i) => i !== idx));
    if (hostIndex >= friendsList.length - 1) {
      setHostIndex(0);
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

  const sharePublicToChat = async () => {
    if (!publicShareUrl) return;
    const windowName = TIME_WINDOWS.find((t) => t.id === activeTimeWindow)?.label.toLowerCase() || "meetup";
    const shareMessage = `Hey crew—vote on dates & spots for ${windowName} on WhenWhere (takes 10 sec, no login): ${publicShareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "WhenWhere Meetup",
          text: shareMessage,
          url: publicShareUrl,
        });
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }
    copyText(shareMessage, false);
  };

  // Dates summary text
  const datesSummary = (() => {
    const active = candidateDates.filter((s) => selectedDateIds.includes(s.id));
    if (active.length === 0) return "No dates selected";
    if (active.length === 1) return active[0].label.split(" • ")[0];
    const firstDate = active[0].label.split(" • ")[0];
    const lastDate = active[active.length - 1].label.split(" • ")[0];
    return `${firstDate} – ${lastDate} (${active.length} dates)`;
  })();

  const timeSummary = TIME_WINDOWS.find((t) => t.id === activeTimeWindow);
  const confirmedDietary = activeConstraints.filter((c) => c.confirmed && c.type !== "area").map((c) => c.label);

  return (
    <div className="flex-1 flex flex-col justify-between p-5 min-h-screen">
      {/* Sleek App Header */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center text-white font-black shadow-xs">
            W
          </div>
          <span className="text-base font-black tracking-tight text-slate-900">WhenWhere</span>
        </div>
        <span className="text-[10px] bg-emerald-50 text-emerald-800 font-black px-2.5 py-1 rounded-full border border-emerald-200/80">
          ✦ Zero Signup
        </span>
      </header>

      {/* ERROR TOAST */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-2xl text-xs text-red-900 flex items-center justify-between animate-fade-in shadow-xs">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="p-1 text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* O1. START SCREEN (ONE INPUT)                            */}
      {/* ======================================================== */}
      {organizerStep === "input" && (
        <div className="flex-1 flex flex-col justify-between py-2 animate-fade-in">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Plan with your group in one sentence.
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Type who, when, and where. We'll lock it in without 40 chat messages.
              </p>
            </div>

            {/* The One Input */}
            <div className="bg-white border-2 border-slate-900 rounded-3xl p-4 shadow-md focus-within:ring-4 focus-within:ring-emerald-500/20 transition">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="e.g. Dinner next week for 8 of us—Ankit, Raj, Priya, Mike, Sarah, Dan, Maya, Tom. Not Tuesday. Midtown, veg & kid-friendly"
                rows={4}
                className="w-full text-sm text-slate-900 placeholder:text-slate-400 resize-none font-medium focus:outline-none"
              />
            </div>

            {/* Template Pills that fill the box */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Tap a template to autofill:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PROMPT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setInputText(preset.text);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
                  >
                    <span>{preset.emoji}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Thumb-Reach Action */}
          <div className="pt-6 space-y-2">
            <button
              onClick={handleContinueFromInput}
              disabled={isParsing}
              className="w-full py-4 px-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              {isParsing ? (
                <span>Parsing plan...</span>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-slate-400 font-medium">
              No app · No signup · Free forever
            </p>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* O2. CHECK THIS PLAN (ONE PREVIEW CARD)                   */}
      {/* ======================================================== */}
      {organizerStep === "preview" && (
        <div className="flex-1 flex flex-col justify-between py-2 animate-fade-in">
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 block mb-0.5">
                Ready to review
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Here's what I got
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Tap any line with ✎ to tweak it before creating the link.
              </p>
            </div>

            {/* The One Preview Card */}
            <div className="bg-white border border-slate-200/90 rounded-[28px] p-2 shadow-sm divide-y divide-slate-100">
              {/* Row 1: Time Window */}
              <button
                type="button"
                onClick={() => setActiveEditor("time")}
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50 rounded-2xl transition group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{timeSummary?.emoji || "🍽️"}</span>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Time Window
                    </span>
                    <strong className="text-sm font-bold text-slate-900">
                      {timeSummary?.label} · {timeSummary?.time}
                    </strong>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 group-hover:underline flex items-center gap-1">
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </span>
              </button>

              {/* Row 2: Candidate Dates */}
              <button
                type="button"
                onClick={() => setActiveEditor("dates")}
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50 rounded-2xl transition group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📅</span>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Candidate Dates
                    </span>
                    <strong className="text-sm font-bold text-slate-900">
                      {datesSummary}
                    </strong>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 group-hover:underline flex items-center gap-1">
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </span>
              </button>

              {/* Row 3: Area */}
              <button
                type="button"
                onClick={() => setActiveEditor("area")}
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50 rounded-2xl transition group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📍</span>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Neighborhood
                    </span>
                    <strong className="text-sm font-bold text-slate-900">
                      {selectedArea}
                    </strong>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 group-hover:underline flex items-center gap-1">
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </span>
              </button>

              {/* Row 4: Preferences */}
              <button
                type="button"
                onClick={() => setActiveEditor("filters")}
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50 rounded-2xl transition group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🥦</span>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Dietary & Vibe
                    </span>
                    <strong className="text-sm font-bold text-slate-900 truncate max-w-[200px] block">
                      {confirmedDietary.length > 0 ? confirmedDietary.join(" · ") : "Any spots"}
                    </strong>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 group-hover:underline flex items-center gap-1">
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </span>
              </button>

              {/* Row 5: Crew */}
              <button
                type="button"
                onClick={() => setActiveEditor("crew")}
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50 rounded-2xl transition group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">👥</span>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Crew ({friendsList.length} people)
                    </span>
                    <strong className="text-sm font-bold text-slate-900 truncate max-w-[200px] block">
                      Host: {friendsList[hostIndex] || "You"} ({friendsList.slice(0, 3).join(", ")}...)
                    </strong>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 group-hover:underline flex items-center gap-1">
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </span>
              </button>
            </div>
          </div>

          {/* Bottom Thumb Actions */}
          <div className="pt-6 space-y-2">
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full py-4 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <span>Generating link...</span>
              ) : (
                <>
                  <span>Create link →</span>
                </>
              )}
            </button>
            <button
              onClick={() => setOrganizerStep("input")}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-bold py-1"
            >
              ← Edit sentence
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* O3. SHARE SCREEN                                        */}
      {/* ======================================================== */}
      {organizerStep === "share" && publicShareUrl && (
        <div className="flex-1 flex flex-col justify-between py-2 animate-fade-in space-y-4">
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 block mb-0.5">
                🎉 Room Created!
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Share with your group
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Drop this in WhatsApp or iMessage. Friends vote in 10 sec without signup.
              </p>
            </div>

            {/* Big Green Share Card */}
            <div className="bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white rounded-[28px] p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-200">
                  Public Group Link
                </span>
                <span className="text-[10px] bg-white/20 text-white font-bold px-2 py-0.5 rounded-full">
                  Zero Host Powers
                </span>
              </div>

              {/* Message preview */}
              <div className="bg-white/10 border border-white/20 rounded-2xl p-3 text-xs leading-relaxed text-emerald-50 select-all font-sans">
                Hey crew—vote on dates & spots for {timeSummary?.label.toLowerCase()} in {selectedArea} on WhenWhere (takes 10 sec, no login):
                <div className="font-mono text-[11px] text-white font-bold mt-1 truncate">
                  {publicShareUrl}
                </div>
              </div>

              <button
                onClick={sharePublicToChat}
                className="w-full py-3.5 px-4 bg-white hover:bg-slate-100 text-emerald-950 font-black text-xs rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition"
              >
                {copiedPublic ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-emerald-700" />
                    <span>Send to Group Chat</span>
                  </>
                )}
              </button>
            </div>

            {/* Visually Distinct Slate Host Key Card */}
            {adminRecoveryUrl && (
              <div className="bg-slate-900 text-white rounded-[28px] p-5 shadow-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    Your Private Host Link
                  </span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full">
                    Keep Secret
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Save this link in your Notes or bookmarks. It gives you host controls to set the start time and lock the final plan.
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyText(adminRecoveryUrl, true)}
                    className="flex-1 py-3 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    {copiedAdmin ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Saved!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Save to Notes</span>
                      </>
                    )}
                  </button>

                  <a
                    href={adminRecoveryUrl}
                    className="flex-1 py-3 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <span>Open as Host</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BOTTOM SHEET EDITORS (FOR O2 PREVIEW CARD)              */}
      {/* ======================================================== */}
      {activeEditor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-3xl p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 capitalize">
                Edit {activeEditor}
              </h3>
              <button
                onClick={() => setActiveEditor(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Time Window Editor */}
            {activeEditor === "time" && (
              <div className="grid grid-cols-2 gap-2">
                {TIME_WINDOWS.map((tw) => (
                  <button
                    key={tw.id}
                    type="button"
                    onClick={() => {
                      handleTimeWindowChange(tw.id as any);
                      setActiveEditor(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition ${
                      activeTimeWindow === tw.id
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="text-xl block mb-1">{tw.emoji}</span>
                    <strong className="text-xs font-bold block">{tw.label}</strong>
                    <span className="text-[10px] text-slate-500">{tw.time}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Dates Editor */}
            {activeEditor === "dates" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  {candidateDates.map((slot) => {
                    const isChecked = selectedDateIds.includes(slot.id);
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => toggleDateSlot(slot.id)}
                        className={`w-full p-3 rounded-2xl border flex items-center justify-between text-xs font-bold transition ${
                          isChecked
                            ? "border-emerald-500 bg-emerald-50 text-emerald-950"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span>{slot.label}</span>
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                            isChecked ? "bg-emerald-600 text-white" : "border border-slate-300"
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Date */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <input
                    type="date"
                    value={customDateValue}
                    onChange={(e) => setCustomDateValue(e.target.value)}
                    className="flex-1 p-2.5 text-xs rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomDate}
                    disabled={!customDateValue}
                    className="px-3.5 py-2.5 bg-slate-900 disabled:opacity-40 text-white text-xs font-bold rounded-xl"
                  >
                    + Add Date
                  </button>
                </div>
              </div>
            )}

            {/* Area Editor */}
            {activeEditor === "area" && (
              <div className="space-y-1.5">
                {ATLANTA_NEIGHBORHOODS.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => {
                      setSelectedArea(area);
                      setActiveConstraints((prev) => {
                        const filtered = prev.filter((c) => c.type !== "area");
                        return [...filtered, { id: `c_area_${Date.now()}`, type: "area", label: area, confirmed: true }];
                      });
                      setActiveEditor(null);
                    }}
                    className={`w-full p-3 rounded-2xl border text-left text-xs font-bold transition ${
                      selectedArea === area
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            )}

            {/* Filters Editor */}
            {activeEditor === "filters" && (
              <div className="space-y-1.5">
                {PRESET_FILTERS.map((f) => {
                  const isConfirmed = activeConstraints.some((c) => c.label === f.label && c.confirmed);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleConstraintByLabel(f.label, f.type)}
                      className={`w-full p-3 rounded-2xl border flex items-center justify-between text-xs font-bold transition ${
                        isConfirmed
                          ? "border-emerald-500 bg-emerald-50 text-emerald-950"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{f.emoji}</span>
                        <span>{f.label}</span>
                      </span>
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                          isConfirmed ? "bg-emerald-600 text-white" : "border border-slate-300"
                        }`}
                      >
                        {isConfirmed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Crew Editor */}
            {activeEditor === "crew" && (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-500">
                  Tap a name to make them the host. Tap ✕ to remove.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {friendsList.map((friend, idx) => {
                    const isHost = idx === hostIndex;
                    return (
                      <span
                        key={friend}
                        onClick={() => setHostIndex(idx)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                          isHost
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        <span>{friend}</span>
                        {isHost && <span className="text-[10px] text-amber-300">(Host)</span>}
                        {friendsList.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFriend(idx);
                            }}
                            className="text-slate-400 hover:text-red-500 ml-1"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add friend's name..."
                    value={newFriendInput}
                    onChange={(e) => setNewFriendInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
                    className="flex-1 p-2.5 text-xs rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddFriend}
                    className="px-3.5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl"
                  >
                    + Add
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveEditor(null)}
              className="w-full py-3 bg-slate-900 text-white text-xs font-bold rounded-xl mt-2"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
