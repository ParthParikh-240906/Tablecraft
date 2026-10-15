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
- Ask EXACTLY ONE question per reply: the NEXT missing field in this exact order: name → party size → date → time. Never ask two things at once, even if several fields are missing.
- When a date just resolved from a relative expression, echo the RESOLVED concrete date so the diner can confirm, e.g. "Got it — tomorrow (Sep 16). What time works for you?". Never scold about date formats when the date slot resolved successfully.
- If the date is still missing, ask for it naturally — the diner may say things like "tomorrow" or "this Friday". Do NOT demand an exact format and do NOT scold about date formats.
- If the user mentioned a vague time like "dinner", "lunch", "in 3 hours" and time is still missing → reply: "Could you please tell me the exact time? For example: 19:00."
- If the user gave a time like "7pm" or "7am" → accept it and move on. Do NOT ask for clarification.
- If all fields are collected (isComplete=true), reply: "Great! I'll confirm your booking details shortly."
- Do NOT repeat information the user already provided.`;

/**
 * Create the booking server-side once chat slots complete (autoBook path).
 * Dedupes on an exact existing confirmed/pending booking so retries and
 * double-submits never create two rows. Returns one of: booked (+id),
 * pendingCombo (multi-table approval needed), or error (graceful message).
 */
async function tryAutoBook(opts: {
  orgSlug: string | null;
  orgId: string | null;
  slots: SlotState;
  origin: string;
}): Promise<
  | { booked: true; bookingId: string }
  | { booked: false; pendingCombo: { message: string; tables: Array<{ id: string; label: string; capacity: number }> } }
  | { booked: false; error: string }
> {
  const { orgSlug, orgId, slots } = opts;
  const local = new Date(`${slots.date}T${slots.time}:00+04:00`);
  const datetime = isNaN(local.getTime()) ? `${slots.date}T${slots.time}` : local.toISOString();
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    // Resolve org id for the dedupe check.
    let resolvedId: string | null = orgId;
    if (!resolvedId && orgSlug) {
      const { data } = await admin.from("organizations").select("id").eq("slug", orgSlug).maybeSingle();
      resolvedId = (data as { id?: string } | null)?.id ?? null;
    }
    if (resolvedId) {
      const { data: existing } = await admin
        .from("bookings")
        .select("id")
        .eq("org_id", resolvedId)
        .eq("customer_name", slots.name)
        .eq("datetime", datetime)
        .in("status", ["confirmed", "pending"])
        .limit(1)
        .maybeSingle();
      if (existing) {
        return { booked: true, bookingId: (existing as { id: string }).id };
      }
    }
    const res = await fetch(`${opts.origin}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(orgSlug ? { orgSlug } : { orgId }),
        customerName: slots.name,
        partySize: slots.party_size,
        datetime,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) {
      return { booked: false, error: (data?.error as string) ?? "booking service error" };
    }
    if (data.needsConfirmation) {
      return {
        booked: false,
        pendingCombo: {
          message: (data.message as string) ?? "We may need to combine tables — is that okay?",
          tables: Array.isArray(data.tables) ? data.tables : [],
        },
      };
    }
    const id = data?.booking?.id ?? data?.id;
    if (typeof id !== "string") return { booked: false, error: "booking service error" };
    return { booked: true, bookingId: id };
  } catch (err) {
    console.error("[CHAT BOOKINGS] tryAutoBook failed:", err);
    return { booked: false, error: "booking service error" };
  }
}

export async function POST(request: NextRequest) {  const rl = rateLimit(`chat-bookings:${getClientIp(request)}`, 15, 60_000);
  if (!rl.allowed) return rateLimitedResponse(rl.resetMs);

  // Per-OWNER monthly chatbot quota (free 50 / pro 300 / max 1000) aggregated
  // across all restaurants. Guests pass orgSlug/orgId/orgName; we resolve the
  // owner and consume 1 unit. Missing org → IP brake only (fail-open).
  try {
    const clone = request.clone();
    const probe = await clone.json().catch(() => null) as { orgSlug?: unknown; orgId?: unknown; orgName?: unknown } | null;
    const probeSlug = typeof probe?.orgSlug === "string" ? probe.orgSlug : null;
    const probeId = typeof probe?.orgId === "string" ? probe.orgId : null;
    const probeName = typeof probe?.orgName === "string" ? probe.orgName : null;
    if (probeSlug || probeId || probeName) {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        let orgRow: { id?: string; subscription_plan?: string } | null = null;
        if (probeId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(probeId)) {
          const { data } = await admin.from("organizations").select("id, subscription_plan").eq("id", probeId).maybeSingle();
          orgRow = data as { id?: string; subscription_plan?: string } | null;
        } else if (probeSlug) {
          const { data } = await admin.from("organizations").select("id, subscription_plan").eq("slug", probeSlug).maybeSingle();
          orgRow = data as { id?: string; subscription_plan?: string } | null;
        } else if (probeName) {
          const { data } = await admin.from("organizations").select("id, subscription_plan").ilike("name", probeName.slice(0, 100)).limit(1).maybeSingle();
          orgRow = data as { id?: string; subscription_plan?: string } | null;
        }
        if (orgRow?.id) {
          const { getOwnerForOrg, getOwnerPlanContext, checkOwnerQuota, ownerQuotaExceededResponse } = await import("@/lib/owner-quotas");
          const { ownerId, ownerEmail } = await getOwnerForOrg(orgRow.id);
          if (ownerId) {
            const ctx = await getOwnerPlanContext(ownerId);
            const q = await checkOwnerQuota({ ownerId, plan: ctx.plan, category: "chatbot", ownerEmail: ownerEmail ?? ctx.email });
            if (!q.allowed) return ownerQuotaExceededResponse(q.used, q.limit, "AI chatbot");
          }
        }
      } catch {
        // Fail-open: quota lookup errors never block guest chat (IP brake above applies).
      }
    }
  } catch {
    // Body probe failed — continue to main handler (which validates JSON).
  }

  try {
  const claudeKey = process.env.CLAUDE_API;
  if (!claudeKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  // Haiku 5.5 (low effort) via CLAUDE_API — no fallback.
  async function llmChat(
    messages: Array<{ role: string; content: string }>,
    maxTokens: number,
  ): Promise<string> {
    const { callHaikuLow } = await import("@/lib/ai-models");
    const system = messages.find((m) => m.role === "system")?.content;
    const rest = messages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    const text = await callHaikuLow(rest || "Reply.", {
      ...(system ? { system } : {}),
      maxTokens,
    });
    if (!text?.trim()) throw new Error("Haiku 5.5 returned no content");
    return text.trim();
  }

  let body: {
    message?: string;
    slots?: SlotState;
    history?: Array<{ role: string; content: string }>;
    orgName?: string;
    orgSlug?: string;
    orgId?: string;
    /** Built-site bots send true: create the booking server-side once complete. */
    autoBook?: boolean;
    /** Echo of the last offered combo tables (lets "yes" book exact ids). */
    pendingTables?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, slots: currentSlots = { name: null, party_size: null, date: null, time: null }, history = [], orgName } = body ?? {};
  const orgSlug = typeof body?.orgSlug === "string" ? body.orgSlug : null;
  const orgId = typeof body?.orgId === "string" ? body.orgId : null;

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
  // Combo fast-path: reply to a pending multi-table offer.
  // Typed confirmations ("yes", "Table 1 + Table 2") must book with the
  // offered tableIds — the normal extraction path would re-run autoBook
  // WITHOUT tableIds and loop the offer forever (or corrupt the name slot
  // with table text). Deterministic: no LLM calls on these turns, so a
  // model outage can never break the confirmation step.
  // ===================================================================
  const {
    sanitizeComboTables,
    lastAssistantText,
    classifyComboReply,
    matchComboTables,
    comboLabels,
    COMBO_OFFER_MARKER,
  } = await import("@/lib/chat-combo");
  const echoTables = sanitizeComboTables((body as { pendingTables?: unknown })?.pendingTables);
  const lastBot = lastAssistantText(safeHistory);
  // History marker covers unpatched clients (the offer suffix is appended
  // only to combo replies, so its presence proves an offer is pending).
  const comboOffered = echoTables.length > 0 || lastBot.includes(COMBO_OFFER_MARKER);
  const comboSlotsReady =
    !!currentSlots.name &&
    typeof currentSlots.party_size === "number" &&
    !!currentSlots.date &&
    !!currentSlots.time;

  async function postBookings(payload: Record<string, unknown>): Promise<{ ok: boolean; data: any }> {
    const res = await fetch(`${new URL(request.url).origin}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, data: await res.json().catch(() => null) };
  }
  function comboDateTime(): string {
    const local = new Date(`${currentSlots.date}T${currentSlots.time}:00+04:00`);
    return isNaN(local.getTime()) ? `${currentSlots.date}T${currentSlots.time}` : local.toISOString();
  }
  async function findExistingComboBooking(): Promise<string | null> {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      let resolvedId: string | null = orgId;
      if (!resolvedId && orgSlug) {
        const { data } = await admin.from("organizations").select("id").eq("slug", orgSlug).maybeSingle();
        resolvedId = (data as { id?: string } | null)?.id ?? null;
      }
      if (!resolvedId) return null;
      const { data: existing } = await admin
        .from("bookings")
        .select("id")
        .eq("org_id", resolvedId)
        .eq("customer_name", currentSlots.name)
        .eq("datetime", comboDateTime())
        .in("status", ["confirmed", "pending"])
        .limit(1)
        .maybeSingle();
      return (existing as { id: string } | null)?.id ?? null;
    } catch {
      return null;
    }
  }

  if (comboOffered && comboSlotsReady) {
    const verdict = classifyComboReply(message);
    if (verdict === "deny") {
      return NextResponse.json({
        slots: currentSlots,
        response:
          "No problem — I won't book those tables. Want to try a different time or party size, or use the booking form on this page?",
        complete: true,
        comboCleared: true,
      });
    }
    if (verdict === "affirm" || typeof verdict === "object") {
      // Fresh offer when the client sent none (unpatched) — same slots, so
      // the same combo comes back unless availability changed.
      let tables = echoTables;
      if (tables.length === 0) {
        const fresh = await postBookings({
          ...(orgSlug ? { orgSlug } : { orgId }),
          customerName: currentSlots.name,
          partySize: currentSlots.party_size,
          datetime: comboDateTime(),
        });
        if (fresh.ok && fresh.data?.needsConfirmation && Array.isArray(fresh.data.tables)) {
          tables = sanitizeComboTables(fresh.data.tables);
        }
      }
      const target = verdict === "affirm" ? tables : matchComboTables(verdict.pick, tables);
      if (target.length > 0) {
        const dup = await findExistingComboBooking();
        if (dup) {
          return NextResponse.json({
            slots: currentSlots,
            response: `You're already booked, ${currentSlots.name} — table for ${currentSlots.party_size} on ${currentSlots.date} at ${currentSlots.time}. Show this confirmation at the restaurant.`,
            complete: true,
            bookingId: dup,
            comboCleared: true,
          });
        }
        const booked = await postBookings({
          ...(orgSlug ? { orgSlug } : { orgId }),
          customerName: currentSlots.name,
          partySize: currentSlots.party_size,
          datetime: comboDateTime(),
          tableIds: target.map((t) => t.id),
        });
        const id = booked.data?.booking?.id ?? booked.data?.id;
        if (booked.ok && typeof id === "string") {
          return NextResponse.json({
            slots: currentSlots,
            response:
              `Done, ${currentSlots.name} — I've reserved ${comboLabels(target)} for ${currentSlots.party_size} ` +
              `on ${currentSlots.date} at ${currentSlots.time}. Show this confirmation at the restaurant — we look forward to seeing you.`,
            complete: true,
            bookingId: id,
            comboCleared: true,
          });
        }
        return NextResponse.json({
          slots: currentSlots,
          response:
            `I couldn't lock ${comboLabels(target)} just now (${(booked.data?.error as string) ?? "unavailable"}). ` +
            `Nothing is booked — reply "yes" to try again or use the booking form on this page.`,
          complete: true,
        });
      }
      if (typeof verdict === "object") {
        // Named tables we couldn't match — ask for a clean yes/no instead of
        // running extraction on table text (which corrupts the name slot).
        return NextResponse.json({
          slots: currentSlots,
          response: `Just to confirm — reply "yes" to book ${comboLabels(tables)}, "no" to skip, or tap Confirm above.`,
          complete: true,
        });
      }
      // Affirm with no tables to book: fall through to the normal path.
    }
    // 'other' falls through to normal extraction below.
  }

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
    const haikuText = await llmChat(messages1, 150);
    const jsonMatch = haikuText.match(/\{[\s\S]*\}/)?.[0];
    extracted = JSON.parse(jsonMatch ?? "{}");
    if (process.env.NODE_ENV === "development") {
      console.log("[CHAT BOOKINGS] extracted keys:", Object.keys(extracted ?? {}));
    }
  } catch (err) {
    console.error("[CHAT BOOKINGS] Extraction failed:", err);
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  // Merge slots. Guard: in combo context a table reference ("Table 1 + Table 2")
  // is a pick, never a customer name — it must not overwrite the real name.
  const rawName = typeof extracted.name === "string" ? extracted.name : null;
  const nameIsTableRef = comboOffered && !!rawName && /table\s*#?\s*\d/i.test(rawName);
  const updatedSlots: SlotState = {
    name: !nameIsTableRef && typeof extracted.name === "string" ? extracted.name : currentSlots.name,
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
    conversationalReply = await llmChat(messages2, 150);
  } catch (err) {
    console.error("[CHAT BOOKINGS] Response failed:", err);
  }

  // Auto-book: built-site bots get the booking created server-side the moment
  // slots complete. Defaults ON unless the caller explicitly opts out
  // (the orange console bot sends autoBook:false — it runs its own confirm UI,
  // and server auto-booking there would double-book).
  const autoBook = body?.autoBook !== false;
  let bookingId: string | null = null;
  let pendingCombo: { message: string; tables: Array<{ id: string; label: string; capacity: number }> } | null = null;
  if (isComplete && autoBook && (orgSlug || orgId)) {
    try {
      const bookingResult = await tryAutoBook({
        orgSlug,
        orgId,
        slots: updatedSlots,
        origin: new URL(request.url).origin,
      });
      if (bookingResult.booked) {
        bookingId = bookingResult.bookingId;
        conversationalReply =
          `You're booked, ${updatedSlots.name}! Table for ${updatedSlots.party_size} on ${updatedSlots.date} at ${updatedSlots.time}. ` +
          `Show this confirmation at the restaurant — we look forward to seeing you.`;
      } else if ("pendingCombo" in bookingResult) {
        pendingCombo = bookingResult.pendingCombo;
        conversationalReply =
          `${bookingResult.pendingCombo.message} Reply with the table option you'd like, or use the booking form on this page.`;
      } else {
        conversationalReply =
          `I have your details (${updatedSlots.name}, ${updatedSlots.party_size} on ${updatedSlots.date} at ${updatedSlots.time}), ` +
          `but I couldn't lock a table just now: ${bookingResult.error} Please try the booking form on this page.`;
      }
    } catch (err) {
      console.error("[CHAT BOOKINGS] auto-book failed:", err);
    }
  }

  return NextResponse.json({
    slots: updatedSlots,
    response: conversationalReply.slice(0, 1000),
    complete: isComplete,
    ...(bookingId ? { bookingId } : {}),
    ...(pendingCombo ? { pendingCombo } : {}),
  });
  } catch (err) {
    console.error("[CHAT BOOKINGS] unhandled:", err);
    return NextResponse.json({ error: "Could not process the message. Please try again." }, { status: 500 });
  }
}
