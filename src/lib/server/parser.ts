import { ConstraintItem, DateSlotOption, Participant } from "@/types/session";

export interface ParsedSessionIntent {
  topic: string;
  expectedHeadcount: number;
  participants: Record<string, Participant>;
  constraints: ConstraintItem[];
  dateSlots: DateSlotOption[];
  clarifiers: Array<{
    id: string;
    question: string;
    options: string[];
    selected?: string;
  }>;
}

export async function parseMessyIntent(
  rawInput: string,
  referenceDate: Date = new Date("2026-11-21T20:20:00Z")
): Promise<ParsedSessionIntent> {
  const text = rawInput.trim();
  const lower = text.toLowerCase();

  // Try using Gemini API if key is available in environment
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const geminiResult = await callGeminiParser(text, referenceDate, geminiKey);
      if (geminiResult) return geminiResult;
    } catch (err) {
      console.warn("Gemini parser failed, falling back to rule-based parser:", err);
    }
  }

  // Smart Deterministic NLP Parser
  return parseWithRules(text, lower, referenceDate);
}

function parseWithRules(text: string, lower: string, refDate: Date): ParsedSessionIntent {
  // 1. Extract Headcount & Names
  const participants: Record<string, Participant> = {};
  let expectedHeadcount = 8;

  // Look for headcount patterns like "8 of us", "for 8", "10 people"
  const headcountMatch = lower.match(/(\d+)\s*(?:of us|people|friends|guests|folks)?/);
  if (headcountMatch) {
    expectedHeadcount = parseInt(headcountMatch[1], 10);
  }

  // Look for names list: e.g. "Ankit, Raj, Priya, Mike, Sarah, Dan, Maya, Tom" or "with John, Mary & Bob"
  // Look after em-dash "—", hyphen "-", "with", "for X: "
  const nameSectionMatch = text.match(/(?:—|-|with|including|for \d+ of us[:\s—-]+)([^.]+?)(?:\.|\n|not|midtown|veg|kid|$)/i);
  let rawNames: string[] = [];

  if (nameSectionMatch) {
    const listPart = nameSectionMatch[1].trim();
    rawNames = listPart
      .split(/[,&/]| and /i)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && !/^(us|we|people|them|everyone|all)$/i.test(s));
  }

  // Fallback: search common words capitalized or default list if empty
  if (rawNames.length === 0) {
    const defaultNames = ["Ankit", "Raj", "Priya", "Mike", "Sarah", "Dan", "Maya", "Tom"];
    rawNames = defaultNames.slice(0, Math.max(expectedHeadcount, 4));
  }

  rawNames.forEach((name, idx) => {
    const safeId = `p_${name.toLowerCase().replace(/[^a-z0-9]/g, "") || "user" + (idx + 1)}`;
    participants[safeId] = {
      name,
      status: idx === 0 ? "done" : "pending",
      isClaimed: idx === 0, // Organizer is claimed by default
      vetoUsed: false,
      objectionUsed: false,
      acknowledgedLock: false,
      availableSlots: [],
      topPickVenueId: null,
      approvedVenueIds: [],
    };
  });

  if (Object.keys(participants).length > 0) {
    expectedHeadcount = Math.max(expectedHeadcount, Object.keys(participants).length);
  }

  // 2. Extract Constraints
  const constraints: ConstraintItem[] = [];

  // Excluded days: "not tuesday", "no wednesday", "avoid mondays"
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const excludedDays: number[] = [];
  dayNames.forEach((day) => {
    if (new RegExp(`(?:not|no|avoid|except)\\s+${day}`, "i").test(lower)) {
      excludedDays.push(dayMap[day]);
      constraints.push({
        id: `c_ex_${day}`,
        type: "excluded_day",
        label: `Not ${day.charAt(0).toUpperCase() + day.slice(1)}`,
        confirmed: true,
      });
    }
  });

  // Dietary constraints
  if (/veg(?:an|etarian)?/i.test(lower)) {
    constraints.push({
      id: "c_veg",
      type: "dietary",
      label: "Likely vegetarian-friendly",
      confirmed: true,
    });
  }
  if (/halal/i.test(lower)) {
    constraints.push({
      id: "c_halal",
      type: "dietary",
      label: "Halal options",
      confirmed: true,
    });
  }
  if (/kosher/i.test(lower)) {
    constraints.push({
      id: "c_kosher",
      type: "dietary",
      label: "Kosher options",
      confirmed: true,
    });
  }
  if (/gluten[- ]?free|celiac/i.test(lower)) {
    constraints.push({
      id: "c_gf",
      type: "dietary",
      label: "Gluten-free friendly",
      confirmed: true,
    });
  }

  // Kid-friendly
  if (/kid[- ]?friendly|kids|family[- ]?friendly/i.test(lower)) {
    constraints.push({
      id: "c_kid",
      type: "kid_friendly",
      label: "Likely kid-friendly",
      confirmed: true,
    });
  }

  // Neighborhood / Area
  const neighborhoods = [
    "Midtown",
    "Downtown",
    "Uptown",
    "West Village",
    "East Village",
    "Chelsea",
    "SoHo",
    "Williamsburg",
    "DUMBO",
    "Fulton",
    "Financial District",
    "Flatiron",
  ];
  let matchedArea = "Midtown";
  for (const n of neighborhoods) {
    if (new RegExp(`\\b${n}\\b`, "i").test(lower)) {
      matchedArea = n;
      break;
    }
  }
  constraints.push({
    id: "c_area",
    type: "area",
    label: matchedArea,
    confirmed: true,
  });

  // 3. Generate Candidate Date Slots
  // Based on "next week" and reference date (Sat Nov 21, 2026)
  // Next week: Monday Nov 23 - Sunday Nov 29, 2026.
  const dateSlots: DateSlotOption[] = [];
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Find next Monday
  const currentDayOfWeek = refDate.getUTCDay();
  const daysUntilNextMon = ((8 - currentDayOfWeek) % 7) || 7;
  const nextMonday = new Date(refDate);
  nextMonday.setUTCDate(refDate.getUTCDate() + daysUntilNextMon);

  // Default candidates: Wednesday, Thursday, Friday, Saturday of next week
  const candidateOffsets = [2, 3, 4, 5]; // Wed, Thu, Fri, Sat

  candidateOffsets.forEach((offset) => {
    const candidate = new Date(nextMonday);
    candidate.setUTCDate(nextMonday.getUTCDate() + (offset - 1));
    const dayOfWeekIdx = candidate.getUTCDay();

    // Skip if excluded
    if (excludedDays.includes(dayOfWeekIdx)) return;

    const dayName = daysOfWeek[dayOfWeekIdx];
    const monthName = months[candidate.getUTCMonth()];
    const dateNum = candidate.getUTCDate();
    const year = candidate.getUTCFullYear();
    const monthPadded = String(candidate.getUTCMonth() + 1).padStart(2, "0");
    const datePadded = String(dateNum).padStart(2, "0");

    const slotId = `${year}-${monthPadded}-${datePadded}_PM`;
    dateSlots.push({
      id: slotId,
      label: `${dayName}, ${monthName} ${dateNum} • Evening`,
      vetoedBy: null,
    });
  });

  // 4. Quick tap clarifiers (max 1-2)
  const clarifiers = [
    {
      id: "time_preference",
      question: "Preferred dinner time window?",
      options: ["Early Evening (6:30 PM)", "Prime Time (7:30 PM)", "Late Dinner (8:30 PM)"],
      selected: "Prime Time (7:30 PM)",
    },
    {
      id: "noise_vibe",
      question: "Group atmosphere?",
      options: ["Lively & Buzzing", "Quiet / Easy conversation", "Casual pub style"],
      selected: "Quiet / Easy conversation",
    },
  ];

  // Topic
  let topic = "Dinner with Friends";
  if (/dinner/i.test(lower)) topic = `Dinner in ${matchedArea}`;
  else if (/lunch/i.test(lower)) topic = `Lunch in ${matchedArea}`;
  else if (/drinks|happy hour/i.test(lower)) topic = `Drinks in ${matchedArea}`;
  else if (/coffee|brunch/i.test(lower)) topic = `Brunch in ${matchedArea}`;

  return {
    topic,
    expectedHeadcount,
    participants,
    constraints,
    dateSlots,
    clarifiers,
  };
}

async function callGeminiParser(
  text: string,
  refDate: Date,
  apiKey: string
): Promise<ParsedSessionIntent | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const prompt = `You are the backend parser for SyncUp, a zero-signup group coordination app.
Extract structured meetup information from this organizer's prompt: "${text}".
Current reference date is ${refDate.toISOString()}.
Output ONLY a JSON object matching this schema:
{
  "topic": "string",
  "expectedHeadcount": number,
  "names": ["string"],
  "excludedDays": ["string"], // e.g. "Tuesday"
  "dietary": ["string"], // e.g. "Likely vegetarian-friendly"
  "area": "string", // e.g. "Midtown"
  "kidFriendly": boolean
}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) return null;

  const parsed = JSON.parse(rawJson);
  // Convert into ParsedSessionIntent using parseWithRules as base
  const base = parseWithRules(text, text.toLowerCase(), refDate);
  if (parsed.topic) base.topic = parsed.topic;
  if (parsed.expectedHeadcount) base.expectedHeadcount = parsed.expectedHeadcount;
  return base;
}
