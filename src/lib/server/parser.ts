import { ConstraintItem, DateSlotOption, Participant } from "@/types/session";
import { generateId } from "./crypto";

export interface ParsedSessionIntent {
  topic: string;
  expectedHeadcount: number;
  hostName: string;
  participantNames: string[];
  participants: Record<string, Participant>;
  constraints: ConstraintItem[];
  dateSlots: DateSlotOption[];
  detectedTimeWindow: "dinner" | "lunch" | "brunch" | "drinks";
  clarifiers: Array<{
    id: string;
    question: string;
    options: string[];
    selected?: string;
  }>;
}

export async function parseMessyIntent(
  rawInput: string,
  referenceDate?: Date
): Promise<ParsedSessionIntent> {
  const text = rawInput.trim();
  const lower = text.toLowerCase();
  const refDate = referenceDate || new Date();

  // Try using Gemini API if key is available in environment
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const geminiResult = await callGeminiParser(text, refDate, geminiKey);
      if (geminiResult) return geminiResult;
    } catch (err) {
      console.warn("Gemini parser failed, falling back to rule-based parser:", err);
    }
  }

  // Smart Deterministic NLP Parser
  return parseWithRules(text, lower, refDate);
}

function parseWithRules(text: string, lower: string, refDate: Date): ParsedSessionIntent {
  // 1. Detect Time Window
  let detectedTimeWindow: "dinner" | "lunch" | "brunch" | "drinks" = "dinner";
  let windowTitle = "Dinner";
  if (/brunch/i.test(lower)) {
    detectedTimeWindow = "brunch";
    windowTitle = "Brunch";
  } else if (/lunch/i.test(lower)) {
    detectedTimeWindow = "lunch";
    windowTitle = "Lunch";
  } else if (/drinks|happy\s*hour|cocktail/i.test(lower)) {
    detectedTimeWindow = "drinks";
    windowTitle = "Happy Hour";
  }

  // 2. Extract Headcount & Names
  let expectedHeadcount = 8;
  const headcountMatch = lower.match(/(\d+)\s*(?:of us|people|friends|guests|folks)?/);
  if (headcountMatch) {
    expectedHeadcount = parseInt(headcountMatch[1], 10);
  }

  const nameSectionMatch = text.match(/(?:—|-|with|including|for \d+ of us[:\s—-]+)([^.]+?)(?:\.|\n|not|midtown|beltline|buckhead|west|veg|kid|$)/i);
  let rawNames: string[] = [];

  if (nameSectionMatch) {
    const listPart = nameSectionMatch[1].trim();
    rawNames = listPart
      .split(/[,&/]| and /i)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && !/^(us|we|people|them|everyone|all)$/i.test(s));
  }

  if (rawNames.length === 0) {
    const defaultNames = ["Ankit", "Raj", "Priya", "Mike", "Sarah", "Dan", "Maya", "Tom"];
    rawNames = defaultNames.slice(0, Math.max(expectedHeadcount, 4));
  }

  const hostName = rawNames[0] || "You";
  const participants: Record<string, Participant> = {};

  // Fix Item 4: Use random unique IDs so friends with same name never collide!
  rawNames.forEach((name, idx) => {
    const safeId = generateId("p", 6);
    participants[safeId] = {
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

  if (Object.keys(participants).length > 0) {
    expectedHeadcount = Math.max(expectedHeadcount, Object.keys(participants).length);
  }

  // 3. Extract Constraints
  const constraints: ConstraintItem[] = [];
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

  // Dietary constraints (Fix: Clean consumer labels without "Likely" prefix)
  if (/veg(?:an|etarian)?/i.test(lower)) {
    constraints.push({
      id: "c_veg",
      type: "dietary",
      label: "Vegetarian-friendly",
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
      label: "Kid-friendly",
      confirmed: true,
    });
  }

  // Atlanta Neighborhoods
  const neighborhoods = [
    "West Midtown",
    "Midtown Atlanta",
    "Inman Park",
    "Old Fourth Ward",
    "Ponce City Market",
    "Virginia-Highland",
    "Krog Street",
    "BeltLine",
    "Buckhead",
    "Decatur",
    "Westside",
    "Cabbagetown",
    "Midtown",
    "Downtown Atlanta",
  ];
  let matchedArea = "Midtown Atlanta";
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

  // 4. Generate Candidate Date Slots starting from reference date
  const dateSlots: DateSlotOption[] = [];
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Find upcoming Thursday, Friday, Saturday, Sunday
  const candidateOffsets = [3, 4, 5, 6]; // Thu, Fri, Sat, Sun

  // Base day
  const baseDayOfWeek = refDate.getDay();
  const daysUntilNextWed = ((3 - baseDayOfWeek + 7) % 7) || 7;
  const startTarget = new Date(refDate);
  startTarget.setDate(refDate.getDate() + daysUntilNextWed);

  candidateOffsets.forEach((offset, idx) => {
    const candidate = new Date(startTarget);
    candidate.setDate(startTarget.getDate() + idx);
    const dayOfWeekIdx = candidate.getDay();

    if (excludedDays.includes(dayOfWeekIdx)) return;

    const dayName = daysOfWeek[dayOfWeekIdx];
    const monthName = months[candidate.getMonth()];
    const dateNum = candidate.getDate();
    const year = candidate.getFullYear();
    const monthPadded = String(candidate.getMonth() + 1).padStart(2, "0");
    const datePadded = String(dateNum).padStart(2, "0");

    const dateIso = `${year}-${monthPadded}-${datePadded}`;
    // Fix Item 5: Slot ID & Time window reflect the selected window
    const slotId = `${dateIso}_${detectedTimeWindow}`;

    dateSlots.push({
      id: slotId,
      date: dateIso,
      timeWindow: detectedTimeWindow,
      label: `${dayName}, ${monthName} ${dateNum} • ${windowTitle}`,
      vetoedBy: null,
    });
  });

  // 5. Clarifiers
  const clarifiers = [
    {
      id: "time_preference",
      question: `Preferred ${windowTitle.toLowerCase()} time window?`,
      options: ["Early (6:30 PM)", "Prime Time (7:30 PM)", "Late (8:30 PM)"],
      selected: "Prime Time (7:30 PM)",
    },
    {
      id: "noise_vibe",
      question: "Group atmosphere?",
      options: ["Lively & Buzzing", "Quiet / Easy conversation", "Casual pub style"],
      selected: "Quiet / Easy conversation",
    },
  ];

  return {
    topic: `${windowTitle} in ${matchedArea}`,
    expectedHeadcount,
    hostName,
    participantNames: rawNames,
    participants,
    constraints,
    dateSlots,
    detectedTimeWindow,
    clarifiers,
  };
}

async function callGeminiParser(
  text: string,
  refDate: Date,
  apiKey: string
): Promise<ParsedSessionIntent | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const prompt = `You are the backend parser for SyncUp, an Atlanta-focused group coordination app.
Extract structured meetup information from: "${text}".
Reference date is ${refDate.toISOString()}.
Output ONLY a JSON object:
{
  "topic": "string",
  "expectedHeadcount": number,
  "names": ["string"],
  "excludedDays": ["string"],
  "dietary": ["string"],
  "area": "string"
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
  const base = parseWithRules(text, text.toLowerCase(), refDate);
  if (parsed.topic) base.topic = parsed.topic;
  if (parsed.expectedHeadcount) base.expectedHeadcount = parsed.expectedHeadcount;
  return base;
}
