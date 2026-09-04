import { NextRequest, NextResponse } from "next/server";

type SlotState = {
  name: string | null;
  party_size: number | null;
  date: string | null;
  time: string | null;
};

const EXTRACTION_PROMPT = `You are a restaurant reservation assistant. Your ONLY job is to extract booking fields from the user's message.

COLLECTION ORDER: name → party_size → date → time.

CURRENT STATE — what has already been collected:
{name_state}

Extract these fields ONLY if the user explicitly stated them:
- name: customer's name (string or null)
- party_size: number of guests, integer 1-20, or null
- date: YYYY-MM-DD format, or null
- time: HH:MM 24-hour format, or null

RULES:
- Extract ONLY explicit values. Never infer.
- "tonight", "tomorrow", "today", "in 3 hours", "dinner" → DO NOT convert. Leave null.
- If the user gives a relative time like "7pm", "7am" → extract as-is. Leave null only for truly ambiguous terms like "tonight", "dinner", "in 3 hours".
- If the user gives a date like "Sept 4" or "4th September 2026", convert to YYYY-MM-DD.
- isComplete is true ONLY when all 4 fields are non-null.
- Return ONLY valid JSON, nothing else:
{"name": null/"string", "party_size": null/number, "date": null/"YYYY-MM-DD", "time": null/"HH:MM", "isComplete": false}`;

const RESPONSE_PROMPT = `You are a friendly restaurant reservation assistant.

CURRENT COLLECTED DETAILS:
{name_state}

CONVERSATION HISTORY:
{history_state}

USER'S LAST MESSAGE: {last_message}

RULES FOR YOUR REPLY:
- Be warm, conversational, and brief (1-2 sentences max).
- Ask for the NEXT missing field in this exact order: name → party size → date → time.
- If the user mentioned a relative date like "today", "tomorrow", "tonight", "in 3 hours", reply: "Could you please give me the exact date? For example: 4th September 2026."
- If the user mentioned a relative time like "dinner", "lunch", "in 3 hours" → reply: "Could you please tell me the exact time? For example: 19:00."
- If the user gave a time like "7pm" or "7am" → accept it and move on. Do NOT ask for clarification.
- If all fields are collected (isComplete=true), reply: "Great! I'll confirm your booking details shortly."
- Do NOT repeat information the user already provided.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OMNI_API_KEY;
  const baseUrl = process.env.OMNI_BASE_URL || "http://localhost:20128/v1";

  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  let body: { message?: string; slots?: SlotState; history?: Array<{ role: string; content: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, slots: currentSlots = { name: null, party_size: null, date: null, time: null }, history = [] } = body ?? {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Build state strings for prompts
  const collected = Object.entries(currentSlots)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n") || "  (none yet)";

  const historyState = history
    .map((m: any) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n") || "  (no previous messages)";

  // ===================================================================
  // Call 1: Extract slots from user message
  // ===================================================================
  const messages1 = [
    { role: "system", content: EXTRACTION_PROMPT.replace("{name_state}", collected) },
    ...history.map((m: any) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  let extracted: SlotState & { isComplete?: boolean };
  try {
    const res1 = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "Chatbot", response_format: { type: "json_object" }, messages: messages1, max_tokens: 200 }),
    });

    if (!res1.ok) {
      const errText = await res1.text();
      console.error("[CHAT BOOKINGS] Extraction call failed:", res1.status, errText);
      return NextResponse.json({ error: `AI service error: ${res1.status}` }, { status: 502 });
    }

    const data1 = await res1.json();
    const content1 = data1.choices?.[0]?.message?.content;
    if (!content1) return NextResponse.json({ error: "AI returned no content" }, { status: 500 });

    const jsonMatch = content1.match(/\{[\s\S]*\}/)?.[0];
    extracted = JSON.parse(jsonMatch ?? "{}");
    console.log("[CHAT BOOKINGS] extracted:", JSON.stringify(extracted));
  } catch (err) {
    console.error("[CHAT BOOKINGS] Extraction failed:", err);
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  // Merge slots
  const updatedSlots: SlotState = {
    name: typeof extracted.name === "string" ? extracted.name : currentSlots.name,
    party_size: typeof extracted.party_size === "number" ? extracted.party_size : currentSlots.party_size,
    date: typeof extracted.date === "string" ? extracted.date : currentSlots.date,
    time: typeof extracted.time === "string" ? extracted.time : currentSlots.time,
  };

  // Validate party_size range
  if (typeof updatedSlots.party_size === "number" && (updatedSlots.party_size < 1 || updatedSlots.party_size > 20)) {
    updatedSlots.party_size = null;
  }

  // Determine completeness
  const isComplete = extracted.isComplete ?? (
    !!updatedSlots.name &&
    typeof updatedSlots.party_size === "number" &&
    !!updatedSlots.date &&
    !!updatedSlots.time
  );

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
      .replace("{last_message}", message)
    },
    { role: "user", content: message },
  ];

  let conversationalReply = "Thanks! Let me confirm your details shortly.";
  try {
    const res2 = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "Chatbot", messages: messages2, max_tokens: 200 }),
    });

    if (res2.ok) {
      const data2 = await res2.json();
      conversationalReply = data2.choices?.[0]?.message?.content?.trim() || conversationalReply;
    } else {
      console.error("[CHAT BOOKINGS] Response call failed:", res2.status);
    }
  } catch (err) {
    console.error("[CHAT BOOKINGS] Response failed:", err);
  }

  return NextResponse.json({
    slots: updatedSlots,
    response: conversationalReply,
    complete: isComplete,
  });
}
