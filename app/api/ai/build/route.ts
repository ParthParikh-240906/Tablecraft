import { NextResponse } from "next/server";
import { callHaikuLow, type HaikuMeta } from "@/lib/ai-models";
import { ingestDemoMenuItems } from "@/lib/demo-menu";
import { requireStaffForOrgId } from "@/lib/api-auth";

const BUILD_SYSTEM = `You are Tablecraft's restaurant website builder (Haiku 5.5, medium effort).
Build ONE complete, self-contained single-page website: <!DOCTYPE html> with inline <style> in <head> and inline <script> at the end of <body>. No markdown fences, no explanations, no JSON — only the raw HTML.

Follow the brief EXACTLY: use the given restaurant name, tagline, vibe, and owner paragraph as-is. When contact phone/email/address or branches/locations are provided in the brief, render them verbatim in the visit section and footer — never invent different phone numbers, emails, addresses, or locations, and never leave placeholder contact text when real values were given. Never invent a different restaurant, cuisine, or location. Never leave TODO comments, lorem ipsum, or fake confirmations — every button, filter, form, and chat step must actually work.

STRUCTURE (single scrolling page, anchor nav, NO separate pages):
Fixed header → hero → story (owner paragraph + 3 stat figures) → menu → statement band → gallery → visit → booking → footer → chatbot.

Top of <script> must declare an EDITABLE DATA block:
const ORG_SLUG = "<slug>"; const API_BOOKINGS = "/api/bookings";
const MENU_ITEMS = [...] (8-10 items: name, price number in AED, category, description — object keys MUST be double-quoted JSON-style, e.g. {"name": "Butter Chicken", "price": 45, "category": "Mains", "description": "..."}, so the console can import them);
const HERO_IMAGE_URL = "" (hero image URL from the brief, or empty when none provided).
const GALLERY_IMAGES = [...] (gallery images only - never reuse the hero image here; 1 image means 1 filled tile plus gradient placeholder tiles, never duplicate the hero to fill gaps).
const CART_SETTINGS = { mode: "pickup", delivery_enabled: false, delivery_fee: 0, min_order: 0 } (mirrors the console cart config; pickup by default).

Wiring rules:
- Network rule: ONLY these API endpoints exist: POST /api/bookings and POST /api/cart/checkout. NEVER fetch /api/booking-actions, /api/menu-manager, /api/design-settings, or any other invented /api/* URL.
- submitBooking(payload) POSTs JSON { orgSlug: ORG_SLUG, ...payload } to /api/bookings. The booking form calls it and shows real success/error status from the fetch result. The chatbot does NOT call it directly — it talks to /api/chat/bookings (see chatbot rule), which returns slots the booking form can reuse.
- submitCartCheckout() POSTs JSON { orgSlug: ORG_SLUG, items: [{id, quantity}], fulfillment, customerName, customerPhone } to /api/cart/checkout and redirects the browser to the returned Stripe Checkout URL. Server-side prices win; never trust client totals.
- Mark MENU_ITEMS, CART_SETTINGS, the submitBooking() and submitCartCheckout() functions, and the chatbot sendChatMessage() stub with a /* CONSOLE HOOK */ comment each, so the connector model (GPT 6.1 Sol) can wire the site to the console and connect the chatbot to Haiku 5.5.

DESIGN (this is the priority — aim for a polished, premium look):
- Typography: load a Google Fonts pairing (preconnect + stylesheet link) — one expressive display serif for headings, one clean sans for body/UI — chosen to match the vibe.
- Palette: a :root set of 8+ named hex variables (background, background-deep, primary, primary-deep, accent, ink, muted, white, radius, shadow) derived from the vibe.
- Header: fixed top, transparent over the hero, transitioning to a blurred background with shadow on scroll (.scrolled). Uppercase letter-spaced nav links with an underline that grows on hover, one pill CTA button, and a slide-in drawer menu under 720px.
- Hero: the model's own creative choice, expressing the vibe — any layout, any CSS-art visual, any subtle animation. No fixed layout is required. The only defaults: simple, interactive, and animated. A vibe word alone (cyberpunk, fiery, coastal) must drive the art direction without further instruction. The hero must always include an image slot driven by a top-of-script HERO_IMAGE_URL const (set it to the Hero image URL from the brief, or empty when none provided - never use a gallery image for the hero): a background layer or <img> element that displays when the URL is non-empty and hides cleanly (pure CSS art shows instead) when empty — so the image can be swapped with a one-line change and never leaves a broken-image icon.
- Scroll-reveal (content must never depend on JS or on an observer firing): all text, headings, cards, stats, captions, and form fields must be fully visible in the base CSS (opacity:1, no clip-path, no transform offsets, no visibility:hidden). Entrance motion is a one-shot CSS keyframe animation using opacity and translateY only, with animation-fill-mode: backwards, started when JS adds the class "in" to a .reveal element (use staggered animation-delay). An element that never receives "in" must simply stay visible. Trigger "in" with a scroll + getBoundingClientRect check (not IntersectionObserver) that also runs on load, on resize, and once immediately at init. Never use clip-path, display:none, max-height:0, or opacity:0 as a resting state. The statement band text, section headings, and gallery captions must not use reveal at all. Skip the animation under prefers-reduced-motion.
- Section pattern: small uppercase kicker + large serif h2 with an accent-colored em phrase.
- Menu: the menu grid container must be EMPTY in the static HTML — every card (including its add-to-cart button / plus-minus stepper markup with data attributes) is rendered from MENU_ITEMS via JS. Never bake dish names, descriptions, or prices into static markup: the console swaps MENU_ITEMS for live DB rows at serve time, and baked-in text would freeze the menu forever (adds/deletes would never appear). When MENU_ITEMS is empty, render one empty-state card ("Menu coming soon"). Filter pills are derived from the categories present in MENU_ITEMS (plus "All"). Card buttons must exist in the JS template (not injected in a second pass), so if any later script fails the menu still renders.
- Cart: a SEPARATE page, never a section on the main page and never drawer-only. Implement an exclusive cart view: opening it hides all main-page sections and shows only the cart page (own URL via hash, e.g. #/cart, with back navigation to the site); closing returns to the exact previous scroll position. The header keeps a top-right cart icon with a live count badge linking to this page. CSS scoping restraint (verify before finishing): the rule that hides main-page sections in cart mode must NOT match the cart page itself (exclude it, e.g. with a :not() selector on the cart page id), and the rule that reveals the cart page must win the cascade (same-or-higher specificity plus !important) — a weaker show-rule loses to an !important hide-rule and the cart opens blank. The cart page contains: line items, qty steppers, remove, subtotal, fulfillment switch (pickup/delivery, default from CART_SETTINGS), delivery fee and min-order enforcement, name + phone fields, and a Pay button calling submitCartCheckout(). Cart persists in localStorage keyed by ORG_SLUG.
- One full-bleed statement band in the primary color with a centered serif line.
- Images: never invent image URLs. Use only the exact URLs given in the brief; any image without a provided URL gets an empty src ("") with a styled gradient placeholder behind it. A fake but plausible-looking URL (imgur, unsplash, picsum guesses) is a failure — it renders as a broken image. This applies to the logo, gallery, hero, and every other image slot. Hero and gallery are strictly separate: the Hero image URL goes ONLY in HERO_IMAGE_URL, Gallery images go ONLY in GALLERY_IMAGES - never reuse one for the other in either direction.
- Gallery: a perfect rectangle with zero empty gaps. Use a 12-column CSS grid with grid-auto-flow: dense; assign every tile an explicit grid-column span so EACH row's spans sum to exactly 12 (e.g. 7+5, 4+4+4, 6+6, 3+3+3+3); give all tiles in the same row equal heights so edges line up. Verify the span arithmetic row by row before finishing. Gradient placeholder tiles where images are missing. Never fill gaps by duplicating the hero image or repeating a gallery image: 1 gallery image means 1 filled tile plus placeholders.
- Visit section: hours/location cards. Render the provided contact phone, contact email, contact address, and branches/locations here (each branch as its own location line/card); when none are provided, use neutral placeholders. Booking: split layout (copy + form card) with per-field error spans, JS-populated party (1-20) and time selects, min date set to today, and a confirmation panel (check icon + booking details + "make another booking" button) replacing the form on success.
- Dark 3-column footer with a dynamic copyright year.
- Chatbot fully working, never a stub (no canned replies beyond the greeting): circular FAB fixed bottom-right with a hover treatment (grow/rotate/lift — model's choice), opening panel with an open animation (scale/fade/slide — model's choice); header with assistant name, subtitle, and close button; message area; 3-dot typing indicator CSS; input row with send button. The panel starts closed (no open class in the initial HTML, nothing auto-opens it). On first open it must already show exactly one static greeting bubble (present in the initial HTML or rendered via addMessage on init) — never an empty message area; this greeting is the only bot text allowed without a backend reply. The panel must render messages through an addMessage(text, who) helper. Conversation state lives in JS: const CHAT_SLOTS = { name: null, party_size: null, date: null, time: null } and const CHAT_HISTORY = [] (capped at the last 10 {role, content} entries). sendChatMessage(text) shows the typing indicator, POSTs JSON { message: text, slots: CHAT_SLOTS, history: CHAT_HISTORY, orgSlug: ORG_SLUG, autoBook: true } to /api/chat/bookings, then hides the indicator, updates CHAT_SLOTS from res.slots, appends {role:"user",content:text} and {role:"assistant",content:res.response} to CHAT_HISTORY (cap 10), and renders res.response via addMessage(res.response, "bot"). The backend collects name first, then party size, date, and time step by step — so the static greeting asks for ONE thing only, the guest name (e.g. "Welcome! What name should I put the reservation under?"), never a multi-field interrogation. The backend books the table automatically when slots complete, so NEVER promise a booking before res.bookingId arrives — only treat the reservation as confirmed when the reply says booked. If res.pendingCombo arrives, render its message plus a Confirm button that POSTs JSON { orgSlug: ORG_SLUG, customerName: CHAT_SLOTS.name, partySize: CHAT_SLOTS.party_size, datetime: <CHAT_SLOTS.date>T<CHAT_SLOTS.time> as ISO, tableIds: res.pendingCombo.tables.map(t => t.id) } to /api/bookings and renders the result. While a combo offer is pending, include pendingTables: res.pendingCombo.tables in every later chat POST so a typed "yes" books the exact offered tables. Also add a restart button in the chat header that clears CHAT_SLOTS, CHAT_HISTORY, and all rendered messages, then re-sends the greeting. Mark it with a /* CONSOLE HOOK: chatbot backend (Haiku 5.5 via /api/chat/bookings) */ comment.
- Mobile nav (verify at 390px before finishing): the hamburger button must render as three clear horizontal lines (no icon-font glyphs that can fall back to odd characters); the drawer must contain a visible × close button in its top corner; the drawer closes on link tap, on × tap, on backdrop tap, and on Escape; drawer links are large tap targets; the drawer never traps the user with no way out.
- View switching can never blank the page: anchor nav links use plain href="#section-id" scrolling wherever possible. Any JS view switch (cart page, booking confirmation) must always leave exactly one view visible — if the target view is missing or a handler throws, fall back to showing the main page. A click that hides everything with nothing shown is a failure.
- Header contrast on every view: header text and icons must be legible at scroll-top AND scrolled, on the main page AND on any solid-background view (cart page, booking confirmations). If the header is transparent over a dark hero with light text, it must switch to its solid blurred-background state whenever the underlying view is light — e.g. force the scrolled appearance while the cart page is open. White-on-cream or dark-on-dark at any scroll position on any view is a failure.
- Freshness rule: never reuse the same hero animation, card hover, or button treatment across generations — invent them fresh for each brief to fit its vibe. Entrance motion must stay within opacity and translateY (see Scroll-reveal above), so the style can vary but the visibility logic cannot.
- Mobile hero (verify at 390px before finishing): at 720px and below the hero stacks copy first — top of the hero, just clearing the fixed header, never bottom-pinned and never a large empty void above the text. The art goes below the copy in normal flow at max 40vh, horizontally centered (center with left/margin or bake the transform into every keyframe, because an animating transform replaces a static one and breaks centering). Text never overlays busy animated art on mobile: art sits below the copy or behind it at reduced opacity.
- Responsive typography (verify at 390px and 768px before finishing): headings, hero copy, and body text must scale with the viewport via clamp() with vw units and/or @media (max-width:720px) and @media (max-width:390px) font-size rules. A 390px-wide viewport must render clearly smaller type than 1280px desktop — identical absolute px sizes across viewports is a failure.
- Mobile content visibility (verify at 390px before finishing): with JavaScript scroll-reveal disabled, every heading, paragraph, stat, card, gallery caption, booking field, statement band line, and footer link must already be visible. A blank or partly hidden section is a failure even if the layout is otherwise correct.`;

/**
 * POST /api/ai/build
 * Body: { orgId, name, tagline, orgSlug, vibe, paragraph?, logoUrl?, heroUrl?, imageUrls?[],
 *   branches?[], contactPhone?, contactEmail?, contactAddress? }
 * Uses Haiku 5.5 medium effort. Staff-gated when orgId provided.
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
    // Initial build counts toward the per-OWNER edit quota (free 3 / pro 30 / max 100).
    const { getOwnerForOrg, getOwnerPlanContext, checkOwnerQuota, ownerQuotaExceededResponse } = await import("@/lib/owner-quotas");
    const { ownerId, ownerEmail } = await getOwnerForOrg(orgId);
    const ownerKey = ownerId ?? `org-fallback:${orgId}`;
    const plan = ownerId ? (await getOwnerPlanContext(ownerId)).plan : "free" as const;
    const emailFinal = ownerEmail ?? (ownerId ? (await getOwnerPlanContext(ownerId)).email : null);
    const q = await checkOwnerQuota({ ownerId: ownerKey, plan, category: "edit", ownerEmail: emailFinal });
    if (!q.allowed) return ownerQuotaExceededResponse(q.used, q.limit, "edit");
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
  let paragraph = typeof body.paragraph === "string" ? body.paragraph.slice(0, 2000) : "";
  let logoUrl = typeof body.logoUrl === "string" ? body.logoUrl : "";
  let imageUrls = Array.isArray(body.imageUrls)
    ? (body.imageUrls as unknown[]).filter((u): u is string => typeof u === "string").slice(0, 10)
    : [];
  let heroUrl = typeof body.heroUrl === "string" ? body.heroUrl : (typeof (body as { heroImageUrl?: unknown }).heroImageUrl === "string" ? (body as { heroImageUrl: string }).heroImageUrl : "");
  let branches = Array.isArray(body.branches)
    ? (body.branches as unknown[]).filter((b): b is string => typeof b === "string" && b.trim().length > 0).map((b) => b.trim().slice(0, 100)).slice(0, 20)
    : [];
  let contactPhone = typeof body.contactPhone === "string" ? body.contactPhone.trim().slice(0, 30) : "";
  let contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim().slice(0, 255) : "";
  let contactAddress = typeof body.contactAddress === "string" ? body.contactAddress.trim().slice(0, 500) : "";

  // Anything the user attached at signup (logo / photos / contact / branches)
  // lives on the org row — pull it in when the caller did not pass it directly.
  if (orgId && (!logoUrl || !heroUrl || imageUrls.length === 0 || branches.length === 0 || !contactPhone || !contactEmail || !contactAddress)) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { data: org } = await createAdminClient()
        .from("organizations")
        .select("logo_url, background_image_url, restaurant_photos, branches, contact_phone, contact_email, contact_address")
        .eq("id", orgId)
        .maybeSingle();
      if (!logoUrl && typeof org?.logo_url === "string") logoUrl = org.logo_url;
      if (!heroUrl && typeof (org as { background_image_url?: unknown })?.background_image_url === "string") heroUrl = (org as { background_image_url: string }).background_image_url;
      if (imageUrls.length === 0 && Array.isArray(org?.restaurant_photos)) {
        imageUrls = org.restaurant_photos.filter((u): u is string => typeof u === "string").slice(0, 10);
      }
      if (branches.length === 0 && Array.isArray((org as { branches?: unknown })?.branches)) {
        branches = ((org as { branches: unknown[] }).branches as unknown[])
          .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
          .map((b) => b.trim().slice(0, 100))
          .slice(0, 20);
      }
      if (!contactPhone && typeof (org as { contact_phone?: unknown })?.contact_phone === "string") {
        contactPhone = ((org as { contact_phone: string }).contact_phone ?? "").slice(0, 30);
      }
      if (!contactEmail && typeof (org as { contact_email?: unknown })?.contact_email === "string") {
        contactEmail = ((org as { contact_email: string }).contact_email ?? "").slice(0, 255);
      }
      if (!contactAddress && typeof (org as { contact_address?: unknown })?.contact_address === "string") {
        contactAddress = ((org as { contact_address: string }).contact_address ?? "").slice(0, 500);
      }
    } catch {
      // Uploads are optional — build continues with placeholders.
    }
  }

  // Owner paragraph is optional: when missing, Haiku drafts one from name+vibe
  // so the build prompt always has story copy to use.
  if (!paragraph.trim()) {
    try {
      const drafted = await callHaikuLow(
        `Write a 3-4 sentence warm, inviting owner paragraph for a restaurant named "${name}" (${tagline || "no tagline"}) with this vibe: ${vibe}. No intro fluff like "Welcome to...". Return only the paragraph, no quotes.`,
        { maxTokens: 500 },
      );
      paragraph = drafted.trim().slice(0, 2000);
    } catch {
      paragraph = "";
    }
  }

  const prompt = [
    `Restaurant name: ${name}`,
    `Tagline: ${tagline || "(generate one)"}`,
    `orgSlug: ${orgSlug} (single-page site served at /${orgSlug}; declare ORG_SLUG and POST bookings to /api/bookings with it)`,
    `Vibe/aesthetic (REQUIRED, apply first — palette, hero animation, and tone must all express it): ${vibe}`,
    paragraph ? `Owner paragraph (must use): ${paragraph}` : `Owner paragraph: none`,
    logoUrl ? `Logo URL (must use): ${logoUrl}` : `Logo: none provided, use placeholder`,
    heroUrl ? `Hero image (must use ONLY for HERO_IMAGE_URL, never in gallery): ${heroUrl}` : `Hero image: none provided, leave HERO_IMAGE_URL empty`,
    imageUrls.length > 0 ? `Gallery images (must use ONLY for GALLERY_IMAGES, never reuse the hero image - even a single gallery image fills just one tile, rest stay placeholders): ${imageUrls.join(", ")}` : `Gallery images: none provided, use placeholders`,
    contactPhone ? `Contact phone (must show in visit + footer): ${contactPhone}` : `Contact phone: none provided`,
    contactEmail ? `Contact email (must show in visit + footer): ${contactEmail}` : `Contact email: none provided`,
    contactAddress ? `Contact address (must show in visit + footer): ${contactAddress}` : `Contact address: none provided`,
    branches.length > 0 ? `Branches/locations (must list each in visit section): ${branches.join(" | ")}` : `Branches: none provided (single location)`,
    `Emit the complete HTML file following the hard rules.`,
  ].join("\n");

  try {
    let buildMeta: HaikuMeta = {};
    const text = await callHaikuLow(prompt, { system: BUILD_SYSTEM, maxTokens: 100000, effort: "medium", onMeta: (m) => { buildMeta = m; } });
    // Strip markdown fences if the model adds them; otherwise keep raw HTML.
    const html = text
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim()
      .slice(0, 100000);
    console.log(
      `[AI BUILD] html chars: ${html.length} ` +
        `output_tokens: ${buildMeta.outputTokens ?? "?"} ` +
        `input_tokens: ${buildMeta.inputTokens ?? "?"} ` +
        `stop: ${buildMeta.stopReason ?? "?"}`,
    );
    // Persist: the built HTML IS the site. Merge into design_settings so the
    // public page + console preview serve it (no-op when orgId absent, e.g. tests).
    let connected = false;
    let finalHtml = html;
    if (orgId && html.length > 0) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const readSettings = async () => {
        const { data: orgRow } = await admin
          .from("organizations")
          .select("design_settings")
          .eq("id", orgId)
          .maybeSingle();
        return ((orgRow as { design_settings?: unknown } | null)?.design_settings ?? {}) as Record<string, unknown>;
      };
      const saveHtml = async (nextHtml: string) => {
        await admin
          .from("organizations")
          .update({ design_settings: { ...(await readSettings()), built_html: nextHtml } })
          .eq("id", orgId);
      };
      try {
        await saveHtml(html);
      } catch (e) {
        console.error("[AI BUILD] persist failed (returning HTML anyway):", e instanceof Error ? e.message.slice(0, 200) : e);
      }
      // Automatic combine (once, at creation): Haiku 5.5 medium verifies/fixes
      // the console wiring in the built HTML and saves it back. Non-fatal —
      // the raw build stands if this fails. No extra quota (covered by the build).
      try {
        const { verifyAndFixSiteHtml } = await import("@/lib/ai-connect");
        let combineOut = "?";
        const fixed = await verifyAndFixSiteHtml(html, {
          orgSlug,
          name,
          onMeta: (m) => {
            combineOut = String(m.outputTokens ?? "?");
          },
        });
        await saveHtml(fixed);
        finalHtml = fixed;
        connected = true;
        console.log(`[AI COMBINE] auto-connect for ${orgSlug}: ${html.length} → ${fixed.length} chars output_tokens: ${combineOut}`);
      } catch (e) {
        console.error("[AI COMBINE] auto-connect failed (raw build kept):", e instanceof Error ? e.message.slice(0, 300) : e);
      }
      // Demo menu ingest: the build invents MENU_ITEMS (it has no DB access).
      // Parse them out of the final HTML and save to menu_items so the console
      // Menu section shows the same items as the site. SEED-ONLY: runs only
      // when the org has zero menu rows — otherwise a rebuild/reconnect would
      // resurrect items the owner already deleted. Non-fatal.
      try {
        const { count: existingCount } = await admin
          .from("menu_items")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId);
        if ((existingCount ?? 0) === 0) {
          const count = await ingestDemoMenuItems(admin, orgId, finalHtml);
          if (count > 0) console.log(`[AI BUILD] demo menu ingested for ${orgSlug}: ${count} items`);
        }
      } catch (e) {
        console.error("[AI BUILD] demo menu ingest failed:", e instanceof Error ? e.message.slice(0, 200) : e);
      }
    }
    // Final sanity scan: forbidden invented endpoints + unbalanced script tags.
    // Logs loudly (and reports in the response) so bad output is caught here,
    // not discovered later as blank pages and 404s.
    const FORBIDDEN_API_URLS = ["/api/booking-actions", "/api/menu-manager", "/api/design-settings"];
    const warnings: string[] = FORBIDDEN_API_URLS.filter((u) => finalHtml.includes(u)).map(
      (u) => `forbidden endpoint in HTML: ${u}`,
    );
    const openScripts = (finalHtml.match(/<script(?=[\s>])/gi) ?? []).length;
    const closeScripts = (finalHtml.match(/<\/script\s*>/gi) ?? []).length;
    if (openScripts !== closeScripts) warnings.push(`unbalanced script tags: ${openScripts} open vs ${closeScripts} close`);
    if (warnings.length > 0) {
      console.error(`[AI BUILD] output warnings for ${orgSlug}: ${warnings.join(" | ")}`);
    }
    return NextResponse.json({ model: "claude-haiku-5-5", effort: "medium", html: finalHtml, connected, warnings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Build failed";
    const status = msg.includes("CLAUDE_API") ? 500 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
