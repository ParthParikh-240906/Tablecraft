/**
 * lib/chat-combo.ts — deterministic handling of replies to a pending
 * multi-table combo offer ("Table 1 (4 seats) and Table 2 (4 seats) — fine?").
 *
 * Problem it fixes: typed confirmations ("yes", "Table 1 + Table 2") used to
 * flow through slot extraction, which re-ran autoBook WITHOUT tableIds and
 * looped the offer forever (or corrupted the name slot with table text).
 * These pure helpers classify the reply and match table picks, so the route
 * can book directly with explicit tableIds — no LLM calls needed.
 */

export interface ComboTable {
  id: string;
  label?: string;
  capacity?: number;
}

/** Suffix the server appends to combo-offer replies — reliable offer marker. */
export const COMBO_OFFER_MARKER =
  "Reply with the table option you'd like, or use the booking form on this page.";

const MAX_TABLES = 10;

type LooseTable = { id?: unknown; label?: unknown; capacity?: unknown };

/** Keep only well-formed table refs from a client echo. */
export function sanitizeComboTables(raw: unknown): ComboTable[] {
  if (!Array.isArray(raw)) return [];
  const out: ComboTable[] = [];
  for (const t of raw as LooseTable[]) {
    if (!t || typeof t !== "object" || typeof t.id !== "string" || t.id.length === 0 || t.id.length > 100) continue;
    const row: ComboTable = { id: t.id };
    if (typeof t.label === "string" && t.label.length > 0) row.label = t.label.slice(0, 100);
    if (typeof t.capacity === "number" && Number.isFinite(t.capacity)) row.capacity = t.capacity;
    out.push(row);
    if (out.length >= MAX_TABLES) break;
  }
  return out;
}

/** Latest assistant message text (or "" when none). */
export function lastAssistantText(history: Array<{ role: string; content: string }>): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.role === "assistant" && typeof history[i]?.content === "string") return history[i].content;
  }
  return "";
}

export type ComboVerdict = "affirm" | "deny" | { pick: string[] } | "other";

const DENY_RE = /\b(no|nope|nah|don't|dont|do not|not really|cancel|never mind|neither|rather not|i said no|don't book|dont book)\b/i;
const AFFIRM_RE =
  /\b(yes|yeah|yep|yup|sure|absolutely|definitely|confirm|confirmed|go ahead|please do|do it|book them|book it|sounds good|that works|works for me|perfect|great|will be fine|is fine|ok|okay|deal|proceed)\b/i;
const ONLY_RE = /\b(only|just|instead|single)\b/i;
const TABLE_REF_RE = /tables?\s*#?\s*(\d{1,3})/gi;

/**
 * Classify a reply sent while a combo offer is pending.
 * Precedence: explicit denial → narrowed pick ("table 2 only") →
 * affirmation → table picks → anything else (normal extraction path).
 */
export function classifyComboReply(message: string): ComboVerdict {
  const text = (message ?? "").trim();
  if (!text) return "other";
  const picks = Array.from(text.matchAll(TABLE_REF_RE)).map((m) => m[1]);
  if (DENY_RE.test(text)) return "deny";
  if (picks.length > 0 && ONLY_RE.test(text)) return { pick: picks };
  if (AFFIRM_RE.test(text)) return "affirm";
  if (picks.length > 0) return { pick: picks };
  return "other";
}

/**
 * Match user-picked table numbers against offered tables (by label number).
 * Returns the matched subset, offer-ordered.
 */
export function matchComboTables(picks: string[], tables: ComboTable[]): ComboTable[] {
  if (picks.length === 0 || tables.length === 0) return [];
  const byNumber = new Map<string, ComboTable>();
  tables.forEach((t, idx) => {
    const m = typeof t.label === "string" ? t.label.match(/(\d{1,3})/) : null;
    if (m) byNumber.set(String(parseInt(m[1], 10)), t);
    else byNumber.set(`#${idx + 1}`, t);
  });
  const matched: ComboTable[] = [];
  const seen = new Set<string>();
  for (const p of picks) {
    const key = String(parseInt(p, 10));
    const t = byNumber.get(key);
    if (t && !seen.has(t.id)) {
      seen.add(t.id);
      matched.push(t);
    }
  }
  return matched;
}

/** Human list: "Table 1 and Table 2". */
export function comboLabels(tables: ComboTable[]): string {
  const names = tables.map((t) => t.label ?? "a table");
  if (names.length === 0) return "those tables";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
