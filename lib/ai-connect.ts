import { callHaikuLow, type HaikuMeta } from "@/lib/ai-models";

/**
 * lib/ai-connect.ts — automatic post-build connection pass ("combine").
 *
 * Runs ONCE per restaurant, server-side, chained inside POST /api/ai/build.
 * Takes the Haiku-built standalone HTML and verifies/fixes ONLY the console
 * wiring (endpoints, orgSlug, hooks, chatbot) using Haiku 5.5 medium.
 * Design, copy, and styling are untouched. Not staff-invoked: the endpoint
 * below keeps its staff check for manual re-runs, but creation chains this
 * helper directly (no double quota hit — the initial build already consumed
 * one owner edit unit). GPT 6.1 Sol is reserved for edit.
 */

export const COMBINE_MODEL = "claude-haiku-5-5";
export const COMBINE_MAX_OUTPUT_TOKENS = 32000;

export const COMBINE_VERIFY_SYSTEM = `You are Tablecraft's connection model (Haiku 5.5, medium effort).
You receive a complete restaurant website (single self-contained HTML file) plus the org slug.
Verify and fix ONLY the console wiring. Return the COMPLETE corrected HTML file: raw HTML, no markdown fences, no explanations, no JSON.
Checklist — fix violations in place, change nothing else (colors, fonts, layout, copy identical):
- const ORG_SLUG matches the given slug; public URLs keep /<slug> (/{slug}, /{slug}/menu, /{slug}/reserve, /{slug}/cart).
- submitBooking(payload) POSTs JSON { orgSlug: ORG_SLUG, ...payload } to /api/bookings.
- submitCartCheckout() POSTs JSON { orgSlug: ORG_SLUG, items: [{id, quantity}], fulfillment, customerName, customerPhone } to /api/cart/checkout, so guest orders appear in the console Orders/Kitchen queue with fulfillment carried through; CART_SETTINGS mirrors design_settings.cart_config (console is source of truth; default pickup).
- Menu section and Book-a-table buttons use the page's own menu data and booking form — they must NOT fetch any API except /api/bookings and /api/cart/checkout.
- Menu cards render from the MENU_ITEMS const via JS at load — never bake dish names, descriptions, or prices into static markup, and never change the const MENU_ITEMS array declaration shape (the console swaps it for live DB rows at serve time).
- Network rule: ONLY these API endpoints exist: POST /api/bookings and POST /api/cart/checkout. NEVER fetch /api/booking-actions, /api/menu-manager, /api/design-settings, or any other invented /api/* URL. Delete or rewrite any such fetch to the real endpoints above.
- Chatbot: if sendChatMessage is an unwired stub, wire it fully — keep JS slot state { name, party_size, date, time } plus a history array capped at 10 {role, content} entries; POST JSON { message, slots, history, orgSlug: ORG_SLUG, autoBook: true } to /api/chat/bookings (the backend books automatically once slots complete — never promise a booking before res.bookingId arrives); update slots from res.slots, append user + assistant turns to history (cap 10), render res.response through addMessage(text, "bot"), show the typing indicator while awaiting; on res.pendingCombo render its message plus a Confirm button POSTing { orgSlug, customerName, partySize, datetime, tableIds } to /api/bookings. Mark with /* CONSOLE HOOK: chatbot backend (Haiku 5.5 via /api/chat/bookings) */.
- Every /* CONSOLE HOOK */ marker from the input is preserved byte-for-byte.
- Chatbot combo offers: while a pendingCombo offer stands, later chat POSTs echo pendingTables so a typed yes books the exact offered tables; a header restart button clears slots, history, and rendered messages, then re-sends the greeting.
- Never invent image URLs; never add sections, copy, or styling.
- Never leave a dead view: anchor links scroll; any JS section switch keeps one view visible (fall back to the main page on error).
If everything is already correct, return the input HTML unchanged.`;

/**
 * Run the verify-and-fix pass. Returns corrected full HTML.
 * Throws on empty output (caller keeps the original build).
 */
export async function verifyAndFixSiteHtml(
  html: string,
  opts: { orgSlug: string; name: string; onMeta?: (m: HaikuMeta) => void },
): Promise<string> {
  const text = await callHaikuLow(
    [
      `orgSlug: ${opts.orgSlug}`,
      `Restaurant name: ${opts.name}`,
      `HTML to verify and fix:`,
      html.slice(0, 100000),
    ].join("\n"),
    {
      system: COMBINE_VERIFY_SYSTEM,
      maxTokens: COMBINE_MAX_OUTPUT_TOKENS,
      effort: "medium",
      ...(opts.onMeta ? { onMeta: opts.onMeta } : {}),
    },
  );
  const fixed = text
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim()
    .slice(0, 100000);
  if (!fixed) throw new Error("Combine verify-and-fix returned no HTML");
  return fixed;
}
