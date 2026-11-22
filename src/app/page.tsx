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
} from "lucide-react";
import { ParsedSessionIntent } from "@/lib/server/parser";

const EXAMPLE_SENTENCE =
  "Dinner next week for 8 of us—Ankit, Raj, Priya, Mike, Sarah, Dan, Maya, Tom. Not Tuesday. Midtown, veg & kid-friendly";

export default function CreateSessionPage() {
  const router = useRouter();
  const [inputText, setInputText] = useState(EXAMPLE_SENTENCE);
  const [isParsing, setIsParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedSessionIntent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [clarifierAnswers, setClarifierAnswers] = useState<Record<string, string>>({});

  // Auto-parse on load with example
  useEffect(() => {
    handleParse(EXAMPLE_SENTENCE);
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
        // Initialize clarifiers
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

  const handleCreate = async () => {
    if (!parsed) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: parsed.topic,
          expectedHeadcount: parsed.expectedHeadcount,
          participants: parsed.participants,
          constraints: parsed.constraints,
          dateSlots: parsed.dateSlots,
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
        // Fallback to copy
      }
    }
    copyToClipboard(shareText);
  };

  return (
    <main className="flex-1 flex flex-col p-4 pb-12">
      {/* Brand Header */}
      <header className="flex items-center justify-between py-3 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center text-white font-bold shadow-md shadow-brand-500/20">
            S
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">SyncUp</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">10-sec group coordination</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
          <span>Zero Signup</span>
        </div>
      </header>

      {/* Success Modal / Card when Created */}
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
              Your admin key is saved in this link so you can manage lock-in.
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
          {/* Quick intro banner */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-brand-50 border border-emerald-100 rounded-2xl p-3.5">
            <h2 className="text-sm font-semibold text-emerald-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Describe your plan in 1 messy sentence
            </h2>
            <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
              Name your crew, dates, and preferences. SyncUp extracts constraints and generates your instant poll.
            </p>
          </div>

          {/* Text Input */}
          <div className="space-y-1.5">
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                }}
                rows={3}
                className="w-full p-3.5 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition bg-white resize-none text-slate-900 shadow-sm"
                placeholder="e.g. Dinner next week for 8 of us—Ankit, Raj, Priya, Mike. Not Tuesday. Midtown, veg & kid-friendly"
              />
              {isParsing && (
                <div className="absolute right-3 bottom-3 flex items-center gap-1.5 text-xs text-brand-600 font-medium bg-brand-50 px-2 py-1 rounded-lg">
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                  <span>Parsing...</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <button
                type="button"
                onClick={() => {
                  setInputText(EXAMPLE_SENTENCE);
                  handleParse(EXAMPLE_SENTENCE);
                }}
                className="text-brand-600 font-medium hover:underline flex items-center gap-1 text-[11px]"
              >
                Reset to example prompt
              </button>
              <button
                type="button"
                onClick={() => handleParse(inputText)}
                className="text-slate-600 font-medium hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition text-[11px]"
              >
                Re-analyze
              </button>
            </div>
          </div>

          {/* Parsed Previews */}
          {parsed && (
            <div className="space-y-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 animate-fade-in">
              {/* Participants */}
              <div>
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Friends Named ({Object.keys(parsed.participants).length})</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(parsed.participants).map((p, idx) => (
                    <span
                      key={p.name + idx}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${
                        idx === 0
                          ? "bg-brand-50 border-brand-200 text-brand-800 font-semibold"
                          : "bg-white border-slate-200 text-slate-700"
                      }`}
                    >
                      {p.name} {idx === 0 && "(You)"}
                    </span>
                  ))}
                  <span className="text-[11px] text-slate-400 self-center italic px-1">
                    + anyone can join via link
                  </span>
                </div>
              </div>

              {/* Dates & Constraints Grid */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Candidate Dates</span>
                  </label>
                  <div className="space-y-1">
                    {parsed.dateSlots.map((s) => (
                      <div
                        key={s.id}
                        className="text-xs bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-700 truncate"
                      >
                        {s.label}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>Active Filters</span>
                  </label>
                  <div className="space-y-1">
                    {parsed.constraints.map((c) => (
                      <div
                        key={c.id}
                        className="text-xs bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-700 flex items-center justify-between"
                      >
                        <span className="truncate">{c.label}</span>
                        <Check className="w-3 h-3 text-brand-600 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 1-2 Quick Tap Clarifiers */}
              {parsed.clarifiers && parsed.clarifiers.length > 0 && (
                <div className="pt-2 border-t border-slate-200/60 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
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
                              className={`text-xs px-2.5 py-1 rounded-lg border transition ${
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

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={handleCreate}
              disabled={isCreating || !parsed}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3.5 px-4 rounded-2xl shadow-lg shadow-brand-600/25 active:scale-[0.98] transition"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Creating Meetup Room...</span>
                </>
              ) : (
                <>
                  <span>Create Meetup & Get Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-slate-400 mt-2">
              Ready in 10 seconds • No app download • Zero passwords
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
