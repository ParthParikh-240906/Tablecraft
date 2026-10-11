import { NextResponse } from "next/server";
import { callHaikuLow } from "@/lib/ai-models";
import { requireStaffForOrgId } from "@/lib/api-auth";

const BUILD_SYSTEM = `You are Tablecraft's restaurant website builder (Haiku 5.5, low effort).
Build ONE complete, self-contained single-page website: <!DOCTYPE html> with inline <style> in <head> and inline <script> at the end of <body>. No markdown fences, no explanations, no JSON — only the raw HTML.

Follow the brief EXACTLY: use the given restaurant name, tagline, vibe, and owner paragraph as-is. Never invent a different restaurant, cuisine, or location. Never leave TODO comments, lorem ipsum, or fake confirmations — every button, filter, form, and chat step must actually work.

STRUCTURE (single scrolling page, anchor nav, NO separate pages):
Fixed header → hero → story (owner paragraph + 3 stat figures) → menu → statement band → gallery → visit → booking → footer → chatbot.

Top of <script> must declare an EDITABLE DATA block:
const ORG_SLUG = "<slug>"; const API_BOOKINGS = "/api/bookings";
const MENU_ITEMS = [...] (8-10 items: name, price number in AED, category, description);
const GALLERY_IMAGES = [...] (4-5 entries: src, caption).

Wiring rules:
- submitBooking(payload) POSTs JSON { orgSlug: ORG_SLUG, ...payload } to /api/bookings. The booking form calls it and shows real success/error status from the fetch result. The chatbot does NOT call it directly — its sendChatMessage() stub is left for the connector model, which will wire Haiku 5.5 to drive bookings through this same function.
- Mark MENU_ITEMS, the submitBooking() function, and the chatbot sendChatMessage() stub with a /* CONSOLE HOOK */ comment each, so the connector model (GPT 6.1 Sol) can wire the site to the console and connect the chatbot to Haiku 5.5.

DESIGN (this is the priority — aim for a polished, premium look):
- Typography: load a Google Fonts pairing (preconnect + stylesheet link) — one expressive display serif for headings, one clean sans for body/UI — chosen to match the vibe.
- Palette: a :root set of 8+ named hex variables (background, background-deep, primary, primary-deep, accent, ink, muted, white, radius, shadow) derived from the vibe.
- Header: fixed top, transparent over the hero, transitioning to a blurred background with shadow on scroll (.scrolled). Uppercase letter-spaced nav links with an underline that grows on hover, one pill CTA button, and a slide-in drawer menu under 720px.
- Hero: the model's own creative choice, expressing the vibe — any layout, any CSS-art visual, any subtle animation. No fixed layout is required. The only defaults: simple, interactive, and animated. A vibe word alone (cyberpunk, fiery, coastal) must drive the art direction without further instruction.
- Scroll-reveal everywhere: .reveal elements fade/slide in via IntersectionObserver with staggered transition-delays.
- Section pattern: small uppercase kicker + large serif h2 with an accent-colored em phrase.
- Menu: filter pills + cards rendered from MENU_ITEMS via JS, with hover and entrance treatments of the model's own choosing — never repeat the same hover effect across generations; invent one that fits the vibe.
- One full-bleed statement band in the primary color with a centered serif line.
- Gallery: 12-column mosaic with varied tile spans and gradient placeholder tiles.
- Visit section: hours/location cards. Booking: split layout (copy + form card) with per-field error spans, JS-populated party (1-20) and time selects, min date set to today, and a confirmation panel (check icon + booking details + "make another booking" button) replacing the form on success.
- Dark 3-column footer with a dynamic copyright year.
- Chatbot look only (no behavior): circular FAB fixed bottom-right with a hover treatment (grow/rotate/lift — model's choice), opening panel with an open animation (scale/fade/slide — model's choice); header with assistant name, subtitle, and close button; message bubbles; 3-dot typing indicator CSS; input row with send button. Do NOT script any conversation flow, canned replies, validation, chips logic, or confirm steps. Instead provide a stub function sendChatMessage(text) marked with a /* CONSOLE HOOK: chatbot backend (Haiku 5.5) */ comment — the connector model will wire it to Haiku 5.5 later. The panel must render messages through an addMessage(text, who) helper the stub can reuse.
- Responsive: collapse to single column under 960px, drawer nav + full-width chat panel under 720px, clamp() fluid type, and prefers-reduced-motion that disables animation.
- Freshness rule: never reuse the same micro-interactions twice — hero animation, scroll-reveal style, card hovers, and button treatments must be invented fresh for each brief to fit its vibe. Repetition across generations is a failure.`;

/**
 * POST /api/ai/build
 * Body: { orgId, name, tagline, orgSlug, vibe, paragraph?, logoUrl?, imageUrls?[] }
 * Uses Haiku 5.5 low effort. Staff-gated when orgId provided.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const orgId = typeof body.orgId === "string" ? body.orgId : null;
  if (orgId) {
    const auth = await requireStaffForOrgId(orgId);
    if ("response" in auth) return auth.response;
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const tagline = typeof body.tagline === "string" ? body.tagline.trim() : "";
  const orgSlug = typeof body.orgSlug === "string" ? body.orgSlug.trim() : "";
  const vibe = typeof body.vibe === "string" ? body.vibe.trim() : "";
  if (!name || !orgSlug || !vibe) {
    return NextResponse.json(
      { error: "name, orgSlug and vibe/aesthetic are required" },
      { status: 400 },
    );
  }
  if (!/^[a-z0-9-]{2,40}$/.test(orgSlug)) {
    return NextResponse.json({ error: "orgSlug must be 2-40 chars: a-z 0-9 -" }, { status: 400 });
  }
  const paragraph = typeof body.paragraph === "string" ? body.paragraph.slice(0, 2000) : "";
  const logoUrl = typeof body.logoUrl === "string" ? body.logoUrl : "";
  const imageUrls = Array.isArray(body.imageUrls)
    ? (body.imageUrls as unknown[]).filter((u): u is string => typeof u === "string").slice(0, 10)
    : [];

  const prompt = [
    `Restaurant name: ${name}`,
    `Tagline: ${tagline || "(generate one)"}`,
    `orgSlug: ${orgSlug} (single-page site served at /${orgSlug}; declare ORG_SLUG and POST bookings to /api/bookings with it)`,
    `Vibe/aesthetic (REQUIRED, apply first — palette, hero animation, and tone must all express it): ${vibe}`,
    paragraph ? `Owner paragraph (must use): ${paragraph}` : `Owner paragraph: none`,
    logoUrl ? `Logo URL (must use): ${logoUrl}` : `Logo: none provided, use placeholder`,
    imageUrls.length > 0 ? `Images (must use): ${imageUrls.join(", ")}` : `Images: none provided, use placeholders`,
    `Emit the complete HTML file following the hard rules.`,
  ].join("\n");

  try {
    const text = await callHaikuLow(prompt, { system: BUILD_SYSTEM, maxTokens: 100000 });
    // Strip markdown fences if the model adds them; otherwise keep raw HTML.
    const html = text
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
    return NextResponse.json({ model: "claude-haiku-5-5", effort: "low", html: html.slice(0, 100000) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Build failed";
    const status = msg.includes("CLAUDE_API") ? 500 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
