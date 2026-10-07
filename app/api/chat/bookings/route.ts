import { NextRequest, NextResponse } from "next/server";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";

type SlotState = {
  name: string | null;
  party_size: number | null;
  date: string | null;
  time: string | null;
};

/**
 * Normalize time strings to HH:MM 24-hour format.
 * Handles: "10pm" → "22:00", "7am" → "07:00", "14:00" → "14:00", "2pm" → "14:00"
 */
function normalizeTime(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  // Already in HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(":").map(Number);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  // AM/PM format: "10pm", "7am", "12pm"
  const match = trimmed.match(/^(\d{1,2})(?:\s*(am|pm))$/);
  if (match) {
    let hour = parseInt(match[1], 10);
    const period = match[2];
    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:00`;
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Dubai-tz date helpers (tz-aware via Intl, no hardcoded offset).
// ---------------------------------------------------------------------------
function formatYMD(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Today's date (YYYY-MM-DD) in Asia/Dubai. */
function getDubaiYMD(date: Date = new Date()): string {
  // en-CA yields YYYY-MM-DD; timeZone makes it tz-aware (no offset hack).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatYMD(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

const EXTRACTION_PROMPT = `You are a restaurant reservation assistant for {org_name}.

Today in Dubai (Asia/Dubai) is {today}. Tomorrow is {tomorrow}.

CURRENT COLLECTED DETAILS:
{name_state}

Extract these fields ONLY if the user stated them (explicitly or via a resolvable relative date):
- name: customer's name (string or null)
- party_size: number of guests, integer 1-20, or null
- date: YYYY-MM-DD format, or null
- time: HH:MM 24-hour format, or null

RULES:
- You already know the restaurant is "{org_name}" — do NOT ask about it.
- Extract ONLY stated values. Never invent details.
- Resolve RELATIVE dates to YYYY-MM-DD using today ({today}, Asia/Dubai) as the anchor:
  - "today" / "tonight" → {today}
  - "tomorrow" → {tomorrow}
  - "day after tomorrow" → today + 2 days
  - weekday names ("Friday", "this Friday", "on Monday") → the next upcoming that weekday on or after today (Dubai tz)
  - "this weekend" → the upcoming Saturday; "next week" / "next weekend" → best-effort upcoming Friday/Saturday; "next [weekday]" → that weekday of the following week
  - "in N days/weeks" → today + N days/weeks where clear
  - If no usable date info, leave date null.
- "in 3 hours" is NOT a date — leave date null for that.
- If the user gives a time like "7pm", "7am", "10pm", "2am" → extract it and convert to 24-hour format immediately (e.g. "10pm" → "22:00", "7am" → "07:00", "12pm" → "12:00", "12am" → "00:00"). "10pm" is a valid input, convert it to "22:00".
- If the user gives a date like "Sept 4" or "4th September 2026", convert to YYYY-MM-DD.
- Vague times like "dinner" or "lunch" are NOT valid times — leave time null.
- isComplete is true ONLY when all 4 fields are non-null.
- Return ONLY valid JSON, nothing else:
{"name": null/"string", "party_size": null/number, "date": null/"YYYY-MM-DD", "time": null/"HH:MM", "isComplete": false}`;

const RESPONSE_PROMPT = `You are a friendly reservation assistant for {org_name}.

Today in Dubai (Asia/Dubai) is {today}.

CURRENT COLLECTED DETAILS:
{name_state}

CONVERSATION HISTORY:
{history_state}

USER'S LAST MESSAGE: {last_message}

RULES FOR YOUR REPLY:
- You already know the restaurant is "{org_name}" — never ask which restaurant.
- Be warm, conversational, and brief (1-2 sentences max).
- Ask for the NEXT missing field in this exact order: name → party size → date → time.
- When a date just resolved from a relative expression, echo the RESOLVED concrete date so the diner can confirm, e.g. "Got it — tomorrow (Sep 16). What time works for you?". Never scold about date formats when the date slot resolved successfully.
- If the date is still missing, ask for it naturally — the diner may say things like "tomorrow" or "this Friday". Do NOT demand an exact format and do NOT scold about date formats.
- If the user mentioned a vague time like "dinner", "lunch", "in 3 hours" and time is still missing → reply: "Could you please tell me the exact time? For example: 19:00."
- If the user gave a time like "7pm" or "7am" → accept it and move on. Do NOT ask for clarification.
- If all fields are collected (isComplete=true), reply: "Great! I'll confirm your booking details shortly."
- Do NOT repeat information the user already provided.`;

export async function POST(request: NextRequest) {
  const rl = rateLimit(`chat-bookings:${getClientIp(request)}`, 15, 60_000);
  if (!rl.allowed) return rateLimitedResponse(rl.resetMs);

  try {
  const apiKey = process.env.AGNES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  let body: { message?: string; slots?: SlotState; history?: Array<{ role: string; content: string }>; orgName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, slots: currentSlots = { name: null, party_size: null, date: null, time: null }, history = [], orgName } = body ?? {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (message.length > 500) {
    return NextResponse.json({ error: "message must be under 500 characters" }, { status: 400 });
  }
  if (!Array.isArray(history) || history.length > 10) {
    return NextResponse.json({ error: "history must have at most 10 items" }, { status: 400 });
  }
  for (const m of history) {
    if (typeof (m as { content?: unknown }).content !== "string" || ((m as { content?: unknown }).content as string).length > 1000) {
      return NextResponse.json({ error: "Invalid history item" }, { status: 400 });
    }
    if ((m as { role?: unknown }).role !== "user" && (m as { role?: unknown }).role !== "assistant") {
      return NextResponse.json({ error: "Invalid history item" }, { status: 400 });
    }
  }
  const safeHistory = history.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content.slice(0, 1000) }));
  const safeOrgName = typeof orgName === "string" ? orgName.slice(0, 100) : undefined;

  // Build state strings for prompts
  const collected = Object.entries(currentSlots)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n") || "  (none yet)";

  const historyState = safeHistory
    .map((m: any) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content ?? m.text}`.slice(0, 1100))
    .join("\n") || "  (no previous messages)";

  // Dubai-tz anchor dates (tz-aware, no hardcoded offset).
  const dubaiToday = getDubaiYMD(new Date());
  const dubaiTomorrow = addDaysYMD(dubaiToday, 1);

  // ===================================================================
  // Call 1: Extract slots from user message
  // ===================================================================
  const messages1 = [
    { role: "system", content: EXTRACTION_PROMPT.replace("{name_state}", collected).replaceAll("{org_name}", safeOrgName ?? "this restaurant").replaceAll("{today}", dubaiToday).replaceAll("{tomorrow}", dubaiTomorrow) },
    ...safeHistory.map((m: any) => ({ role: m.role, content: m.content ?? m.text })),
    { role: "user", content: message.slice(0, 500) },
  ];

  let extracted: SlotState & { isComplete?: boolean };
  try {
    const res1 = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "agnes-2.5-flash", response_format: { type: "json_object" }, messages: messages1, max_tokens: 750 }),
    });

    if (!res1.ok) {
      const errText = await res1.text();
      console.error("[CHAT BOOKINGS] Extraction call failed:", res1.status, errText.slice(0, 500));
      return NextResponse.json({ error: "AI service error. Please try again." }, { status: 502 });
    }

    const data1 = await res1.json();
    const content1 = data1.choices?.[0]?.message?.content;
    if (!content1) return NextResponse.json({ error: "AI returned no content" }, { status: 500 });

    const jsonMatch = content1.match(/\{[\s\S]*\}/)?.[0];
    extracted = JSON.parse(jsonMatch ?? "{}");
    if (process.env.NODE_ENV === "development") {
      console.log("[CHAT BOOKINGS] extracted keys:", Object.keys(extracted ?? {}));
    }
  } catch (err) {
    console.error("[CHAT BOOKINGS] Extraction failed:", err);
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  // Merge slots
  const updatedSlots: SlotState = {
    name: typeof extracted.name === "string" ? extracted.name : currentSlots.name,
    party_size: typeof extracted.party_size === "number" ? extracted.party_size : currentSlots.party_size,
    date: typeof extracted.date === "string" ? extracted.date : currentSlots.date,
    time: typeof extracted.time === "string" ? normalizeTime(extracted.time) : currentSlots.time,
  };

  // Validate party_size range
  if (typeof updatedSlots.party_size === "number" && (updatedSlots.party_size < 1 || updatedSlots.party_size > 20)) {
    updatedSlots.party_size = null;
  }

  // Deterministic fallback: resolve simple relative dates when the LLM
  // leaves date null. Checked in this order so "day after tomorrow"
  // (which contains "tomorrow") wins. Dubai-tz anchored.
  if (!updatedSlots.date) {
    if (/day after tomorrow/i.test(message)) {
      updatedSlots.date = addDaysYMD(dubaiToday, 2);
    } else if (/\btomorrow\b/i.test(message)) {
      updatedSlots.date = dubaiTomorrow;
    } else if (/\b(today|tonight)\b/i.test(message)) {
      updatedSlots.date = dubaiToday;
    }
  }

  // Reject past dates (Dubai tz). String comparison is valid for YYYY-MM-DD.
  if (typeof updatedSlots.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(updatedSlots.date) && updatedSlots.date < dubaiToday) {
    updatedSlots.date = null;
  }

  // Determine completeness (a past-nulled or missing slot forces false,
  // even if the model claimed isComplete=true).
  const allPresent =
    !!updatedSlots.name &&
    typeof updatedSlots.party_size === "number" &&
    !!updatedSlots.date &&
    !!updatedSlots.time;
  const isComplete = allPresent && (extracted.isComplete ?? true);

  // ===================================================================
  // Call 2: Generate conversational response
  // ===================================================================
  const updatedCollected = Object.entries(updatedSlots)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n") || "  (none yet)";

  const messages2 = [
    { role: "system", content: RESPONSE_PROMPT
      .replace("{name_state}", updatedCollected)
      .replace("{history_state}", historyState)
      .replace("{last_message}", message.slice(0, 500))
      .replaceAll("{org_name}", safeOrgName ?? "this restaurant")
      .replaceAll("{today}", dubaiToday)
    },
    { role: "user", content: message.slice(0, 500) },
  ];

  let conversationalReply = "Thanks! Let me confirm your details shortly.";
  try {
    const res2 = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "agnes-2.5-flash", messages: messages2, max_tokens: 500 }),
    });

    if (res2.ok) {
      const data2 = await res2.json();
      const reply = data2.choices?.[0]?.message?.content?.trim();
      if (reply) {
        conversationalReply = reply;
      } else {
        console.warn("[CHAT BOOKINGS] Agnes returned empty content — thinking may have consumed all tokens");
      }
    } else {
      const errText = await res2.text();
      console.error("[CHAT BOOKINGS] Response call failed:", res2.status, errText);
    }
  } catch (err) {
    console.error("[CHAT BOOKINGS] Response failed:", err);
  }

  return NextResponse.json({
    slots: updatedSlots,
    response: conversationalReply.slice(0, 1000),
    complete: isComplete,
  });
  } catch (err) {
    console.error("[CHAT BOOKINGS] unhandled:", err);
    return NextResponse.json({ error: "Could not process the message. Please try again." }, { status: 500 });
  }
}
