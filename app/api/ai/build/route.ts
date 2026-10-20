import { NextResponse } from "next/server";
import { callHaikuLow, type HaikuMeta } from "@/lib/ai-models";
import { ingestDemoMenuItems } from "@/lib/demo-menu";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { validateBuiltHtml, validateSiteWiring } from "@/lib/build-validation";

// Shared core: every template uses the same data contract, wiring, image rules, cart,
// chatbot, and verification. Template-specific style is appended below.
const CORE_RULES = `You are Tablecraft's restaurant website builder (Haiku 5.5, medium effort).
Build ONE complete, self-contained single-page website: <!DOCTYPE html>, inline <style> in <head> (Google Fonts via preconnect + stylesheet link), inline <script> at the end of <body>. No markdown fences, no explanations, no JSON, only the raw HTML.

OUTPUT COMPLETENESS AND BUDGET (hard requirement)
- Return ONE complete document. It is invalid unless it ends with </script></body></html> and every opened <script> has a closing </script>.
- Aim for 45,000-55,000 characters total; never exceed 60,000. If you are running long, cut decorative CSS/JS, long comments, and optional interactions. Never cut the closing tags, init(), menu, booking, cart, or chatbot wiring.
- Priority when space is tight: complete document > working controls and data wiring > required sections > optional creative effects.
- Keep comments short (section headers and required CONSOLE HOOK markers only). Reuse shared CSS classes. No large inline SVG illustrations, base64 assets, or huge data blobs; small UI icons are fine.

BRIEF FIDELITY
- Use the given restaurant name, tagline, vibe, and owner paragraph as-is.
- Render the provided contact phone, email, address, and branches verbatim in the visit section and footer. Each branch is its own line or card. Never invent different phone numbers, emails, addresses, or locations, and never leave placeholder contact text when real values were given.
- Never invent a different restaurant, cuisine, or location.
- Never leave TODO comments, lorem ipsum, or fake confirmations. Every button, filter, form, cart step, and chat step must actually work.

STRUCTURE (single scrolling page, anchor nav, NO separate pages)
Fixed header -> hero -> story (owner paragraph + 3 stat figures) -> menu -> statement band -> gallery -> visit -> booking -> footer. The cart is a separate exclusive view (see CART). The chatbot floats above everything.

TOP OF <script>: EDITABLE DATA (declare exactly these names)
const ORG_SLUG = "<slug>"; const API_BOOKINGS = "/api/bookings";
const MENU_ITEMS = [...]; /* CONSOLE HOOK: MENU_ITEMS (console swaps in live DB rows here) */ 8-10 items shaped {"name": "...", "price": 45, "category": "...", "description": "..."}: keys double-quoted JSON-style, price a number in AED.
const HERO_IMAGE_URL = ""; (desktop/tablet hero URL from the brief, or "")
const HERO_IMAGE_URL_MOBILE = ""; (mobile hero URL from the brief, or "")
const GALLERY_IMAGES = [{ "src": "https://...", "caption": "..." }]; (gallery images only; objects, never bare strings; use [] when none)
const CART_SETTINGS = { mode: "pickup", delivery_enabled: false, delivery_fee: 0, min_order: 0 }; /* CONSOLE HOOK: CART_SETTINGS (mirrors the console cart config; pickup by default) */
const CHAT_SLOTS = { name: null, party_size: null, date: null, time: null };
const CHAT_HISTORY = [];

DATA DECLARATIONS
- Declare HERO_IMAGE_URL, HERO_IMAGE_URL_MOBILE, GALLERY_IMAGES, MENU_ITEMS, and CART_SETTINGS as plain literals with exactly these names. The console rewrites these declarations: no backticks, concatenation, or computed values.

NETWORK RULE
- ONLY these endpoints exist: POST /api/bookings, POST /api/cart/checkout, POST /api/chat/bookings. Never fetch /api/booking-actions, /api/menu-manager, /api/design-settings, or any other invented /api/* URL.
- submitBooking(payload) /* CONSOLE HOOK: submitBooking */ POSTs JSON { orgSlug: ORG_SLUG, ...payload } to API_BOOKINGS. The booking form shows real success or error from the fetch result.
- submitCartCheckout() /* CONSOLE HOOK: submitCartCheckout */ POSTs JSON { orgSlug: ORG_SLUG, items: [{id, quantity}], fulfillment, customerName, customerPhone } to /api/cart/checkout and redirects the browser to the returned Stripe Checkout URL. Server-side prices win; never trust client totals.
- sendChatMessage(text) /* CONSOLE HOOK: chatbot backend (Haiku 5.5 via /api/chat/bookings) */ is the chatbot wiring (see CHATBOT).

IMAGE SLOTS (strict, per breakpoint)
- HERO_IMAGE_URL is the desktop and tablet hero (above 720px). Use the Hero image URL from the brief, or "" when none. Never put a gallery image here.
- HERO_IMAGE_URL_MOBILE is the mobile hero (720px and below). Use the Mobile hero image URL from the brief, or "" when none. Never put the desktop hero here and never fall back to it.
- GALLERY_IMAGES holds gallery images only. Never reuse the hero image in the gallery unless the brief explicitly says no gallery images were provided (see the fallback rule below).
- Each breakpoint shows only its own const. Above 720px the hero image layer renders only when HERO_IMAGE_URL is non-empty. At 720px and below (matchMedia("(max-width:720px)") or the CSS @media equivalent) the mobile image layer renders only when HERO_IMAGE_URL_MOBILE is non-empty. When a breakpoint's const is empty, that breakpoint hides its image layer and the pure CSS art shows instead. An empty mobile const does NOT reuse the desktop image, and an empty desktop const does NOT fall back to the mobile image.
- Never invent image URLs (no imgur, unsplash, picsum guesses). Use only the exact URLs from the brief. Any image slot without a URL renders no <img> and shows a styled gradient placeholder instead. This covers the logo (a text wordmark when no logo URL), hero, mobile hero, and every gallery tile.

STATIC FIRST PAINT (hero and gallery must survive JS failure)
- Hero: render the exact desktop URL in a static <img data-tc-hero="desktop" src="<url>" alt="" aria-hidden="true"> and the exact mobile URL in <img data-tc-hero="mobile" src="<url>" ...>. Use CSS @media (max-width:720px) to show only the matching layer. If a URL is empty, omit that <img> and render the CSS-art layer.
- The consts are still required. In init(), call applyHeroArt() to sync the <img> src values from HERO_IMAGE_URL/HERO_IMAGE_URL_MOBILE. Add resize and matchMedia("(max-width:720px)") listeners that call it again.
- Gallery: render the initial tiles as static markup with <img data-tc-gallery="0" src="<url>"> and the caption. Fill missing slots with gradient placeholders. Do not leave the gallery grid empty for JS.
- init() must also call applyGallery() to re-sync the static tiles from GALLERY_IMAGES.
- The same URL appears twice: once in the const (live source for console updates) and once in the static <img> (no-JS first paint). They must match.

BOOT CONTRACT (no dead controls)
- Define exactly one init() function and call it once at the very end of the script, immediately before </script>.
- init() must call the page's own render/apply/setup functions (for example renderFilters(), renderMenu(), renderCart(), applyHeroArt(), applyGallery(), setupBooking(), setupChat(), updateHeader(), revealCheck()).
- Never define an apply/render/setup function and leave it uncalled.
- Attach the delegated [data-nav] click listener, hashchange, drawer, chat, booking, and cart listeners in init(). They must work on first paint.
- If a view switch throws, fall back to showing the main view; never leave both views hidden.

DESIGN BASICS
- Typography: one expressive display serif for headings and one clean sans for body/UI, chosen to match the vibe.
- Palette: a :root set of 8+ named hex variables (background, background-deep, primary, primary-deep, accent, ink, muted, white, radius, shadow) derived from the vibe.
- Section pattern: small uppercase kicker + large serif h2 with an accent-colored em phrase.
- Responsive typography: headings, hero copy, and body text scale with the viewport via clamp() and/or @media (max-width:720px) and (max-width:390px) rules. A 390px viewport must render clearly smaller type than 1280px. Identical absolute px sizes across viewports is a failure.

HEADER
- Fixed top. Transparent over the hero with light text; transitions to a solid blurred background with a shadow once scrolled (.scrolled).
- Forced into the solid state whenever the cart view is open, so the header is legible on the light cart page.
- Logo (or text wordmark), uppercase letter-spaced nav links with a hover underline, one pill CTA "Book a table", and a top-right cart icon with a live count badge that calls navigate("cart").
- Under 720px: a three-line hamburger built from CSS spans (no icon fonts), and a slide-in drawer with a visible x close button in its top corner and large tap targets for links. The drawer closes on link tap, x tap, backdrop tap, and Escape. It never traps the user.
- Header text and icons must be legible at scroll-top and scrolled, on the main page and on every solid view. White-on-cream or dark-on-dark at any scroll position is a failure.

HERO RESPONSIVE LAYOUT (rules shared by every template)
- At 720px and below the copy comes first, starting just below the fixed header. It is never bottom-pinned and never leaves a large empty void above the text.
- At 720px and below the art goes below the copy in normal flow, max 40vh, horizontally centered (use margin auto, or bake the transform into every keyframe, because an animating transform replaces a static one and breaks centering).
- Text never overlays busy animated art on mobile. Art sits below the copy, or behind it at reduced opacity.
- When HERO_IMAGE_URL_MOBILE is non-empty it IS the mobile art layer. When it is empty, the CSS-art layer is the art.

MENU
- The menu grid container is EMPTY in static HTML. Every card (name, price, description, and the add-to-cart stepper with data attributes) is rendered from MENU_ITEMS in JS. Never bake dish names, descriptions, or prices into static markup, because the console swaps MENU_ITEMS for live DB rows at serve time.
- Card buttons exist in the JS template itself (not injected in a second pass), so the menu still renders if a later script fails.
- Empty MENU_ITEMS shows one "Menu coming soon" card.
- Category filter pills come from the categories present in MENU_ITEMS, plus "All".

CART (a separate exclusive view, must navigate correctly every time)
- <section id="cart-view"> is hidden by default. <main id="site"> holds all restaurant sections. Only one is visible at a time.
- ONE navigate(view, targetId) function. view is "main" or "cart". It sets location.hash (#/cart or #/main/<targetId>), sets document.body.dataset.view, shows exactly one view, and restores the saved scroll position when returning to main. Unknown hashes fall back to main. Never leave both views hidden.
- Save window.scrollY right before entering the cart and restore it on leaving.
- ONE delegated click listener on document: element.closest("[data-nav]") -> navigate(data-nav, data-target). This single listener covers "Back to menu", "Back to restaurant", the header logo, and the cart close button. No per-button listeners, no inline onclick, no dependency on elements created later by JS.
- hashchange calls the same navigate() so the browser back button works.
- CSS: body[data-view="cart"] main#site { display:none } and body[data-view="cart"] #cart-view { display:block }. Do not use !important on either rule. The cart page must not match the main-page hide selector, and the show rule must win the cascade over the default hidden state.
- Cart contents: line items, quantity steppers, remove, subtotal, pickup/delivery switch (defaults from CART_SETTINGS), delivery fee and min-order enforcement, name and phone fields, and a Pay button calling submitCartCheckout(). Persist to localStorage keyed by ORG_SLUG.
- If a view switch throws or the target view is missing, fall back to showing the main page. A click that leaves nothing visible is a failure.

SCROLL REVEAL AND NO-JS VISIBILITY
- Content must never depend on JS. All text, headings, cards, stats, captions, form fields, statement band lines, and footer links are fully visible in the base CSS (opacity 1, no clip-path, no transform offset, no visibility hidden, no display none, no max-height 0). With JavaScript disabled, every element is visible.
- Entrance motion is a one-shot CSS keyframe using only opacity and translateY, with animation-fill-mode: backwards, started when JS adds the class "in" to a .reveal element, with staggered animation-delay. Trigger "in" with a getBoundingClientRect check on load, on resize, on scroll, and once at init. Do NOT use IntersectionObserver. An element that never receives "in" stays visible.
- The statement band text, section headings, and gallery captions do not use reveal.
- Skip all entrance and ambient motion under prefers-reduced-motion.

STORY, STATS, STATEMENT BAND
- Story: owner paragraph plus three stat figures. Stats count up once when they enter the viewport. The final value is always rendered in the HTML so no-JS shows the number.
- Statement band: one full-bleed band in the primary color with a centered serif line.

GALLERY
- A perfect rectangle with zero empty gaps. 12-column CSS grid with grid-auto-flow: dense. Every tile has an explicit grid-column span, and each row's spans sum to exactly 12 (e.g. 7+5, 4+4+4, 6+6, 3+3+3+3). Tiles in the same row have equal heights so edges line up. Verify the span arithmetic row by row before finishing.
- GALLERY_IMAGES is an array of objects: [{ "src": "...", "caption": "..." }]. Every tile reads GALLERY_IMAGES[i].src and .caption; never expect a bare string.
- Render a fixed set of 6-10 gallery tiles statically from the brief (enough for every provided gallery image, up to 10). Every tile includes <img data-tc-gallery="<index>" alt=""> (omit src when there is no image) and a visible <figcaption>. Missing images show a gradient placeholder behind the empty img; the console fills src when photos are added. The static tiles are mandatory.
- Gradient placeholder tiles where images are missing. Never fill gaps by repeating a gallery image. If gallery images were provided, never use the hero in the gallery.
- HERO FALLBACK: if no gallery images were provided and a hero URL exists, use the hero as ONE fallback tile (caption e.g. "Our place"). Never duplicate it across tiles. This is the only case where the hero may appear in the gallery.

VISIT AND FOOTER
- Visit: hours, address, and contact, plus each branch as its own location. Use the provided contact data verbatim. When none is provided, use neutral placeholders.
- Footer: dark, 3 columns (brand and tagline, visit and contact details, navigation links), with a dynamic copyright year from new Date().getFullYear(). The footer shows the same contact data as the visit section.

BOOKING
- Split layout: copy on one side, form card on the other. Fields: name, phone, date (min today), time (JS-populated), party size (1-20, JS-populated), notes. Per-field error spans.
- On success, the form is replaced by a confirmation panel (check icon, booking details, "Make another booking" button that restores the form).

CHATBOT (fully working, never a stub)
- Circular FAB fixed bottom-right with a hover treatment. The panel starts closed: no open class in the initial HTML, and nothing auto-opens it. Opening animates in.
- Panel header: assistant name, subtitle, restart button, close button. Then the message area, a 3-dot typing indicator (CSS), and an input row with a send button.
- On first open the panel shows exactly one static greeting: "Welcome! What name should I put the reservation under?" This is the only bot text allowed without a backend reply. The message area is never empty.
- Every message renders through addMessage(text, who).
- Conversation state lives in JS: CHAT_SLOTS and CHAT_HISTORY (capped at the last 10 {role, content} entries).
- sendChatMessage(text) shows the typing indicator, POSTs JSON { message: text, slots: CHAT_SLOTS, history: CHAT_HISTORY, orgSlug: ORG_SLUG, autoBook: true } to /api/chat/bookings, hides the indicator, updates CHAT_SLOTS from res.slots, appends {role:"user",content:text} and {role:"assistant",content:res.response} to CHAT_HISTORY (cap 10), and renders res.response via addMessage(res.response, "bot").
- The backend collects name first, then party size, date, and time, one step at a time. Never promise a booking before res.bookingId arrives. Only say the table is booked when the reply says booked AND res.bookingId exists.
- If res.pendingCombo arrives, show its message plus a Confirm button that POSTs { orgSlug: ORG_SLUG, customerName: CHAT_SLOTS.name, partySize: CHAT_SLOTS.party_size, datetime: ISO built from CHAT_SLOTS.date and CHAT_SLOTS.time, tableIds: res.pendingCombo.tables } to /api/bookings. Send pendingTables: res.pendingCombo.tables in every later chat POST while the offer is pending.
- Restart clears CHAT_SLOTS, CHAT_HISTORY, and the rendered messages, then re-shows the greeting.

FRESHNESS
- Never reuse a hero animation, card hover, button treatment, palette, or chatbot treatment from another generation. Invent fresh choices for each brief that fit its vibe.

VERIFY before finishing (390px, 768px, and 1280px)
- Mobile hero stacking, and the image swap driven by empty vs non-empty consts.
- No-JS visibility of every heading, paragraph, stat, card, caption, form field, and footer link.
- Cart back buttons and hash back navigation. Header contrast on the cart view.
- Chatbot greeting and reply flow. Gallery span sums per row.
- No forbidden endpoints. Every CONSOLE HOOK marker present.`;

const STYLE_PROFESSIONAL = `STYLE GOAL: professional. Calm, confident, editorial. Generous whitespace, one accent color used sparingly, restrained considered motion, never flashy. The look must still be specific to the vibe: derive the palette and type pairing from the vibe, never a default palette.

PAGE PRIORITY: simple, clean, interactive, and animated. Hover treatments stay subtle: the menu card lifts 2px on hover and nothing else on the card changes.

HERO A: TEXT CENTERED (required)
- One centered column: small uppercase kicker (cuisine or city), a large serif h1 with one accent-colored phrase, a one-line subline, then two buttons side by side: "Book a table" (primary, anchors to #booking) and "View menu" (outline, anchors to #menu).
- Background: a static <img data-tc-hero="desktop" src="<heroUrl>"> layer at low opacity behind a soft tinted overlay when set; at 720px and below the static <img data-tc-hero="mobile" src="<mobileHeroUrl>"> layer takes that role when set. JS syncs the same images from the consts in init(); it is not the only path. When a breakpoint's URL is empty, use a restrained CSS-art background (gradient or thin line pattern) that matches the vibe.
- Motion: the kicker, h1, subline, and buttons fade and rise one after another on load (opacity and translateY only). The background drifts very slowly (20-30s) and stops under prefers-reduced-motion.
- Mobile (720px and below): copy stays centered at the top, just below the fixed header. The art sits behind the copy at reduced opacity, or below the copy in normal flow at max 40vh.

MENU: cards show name, price, description, and an add-to-cart stepper (data attributes). Cards lift by 2px on hover.

STORY: two-column text and one framed image or CSS panel.

VISIT: a simple grid of three cards (hours, address, contact) using the provided contact data, each branch on its own line.

BOOKING: keep the split layout simple and calm. The success panel is a quiet check icon, details, and the "Make another booking" button.

CHATBOT: a calm panel that fades and rises open. The FAB hover is a subtle lift.`;

const STYLE_ATTENTION_SEEKING = `STYLE GOAL: attention-seeking and creative. Bold display typography at large scale, strong contrast, kinetic motion, and a clear art direction taken from the vibe. The page should feel like an experience, not a template. It must still be easy to order from and book.

HERO B: TEXT LEFT, IMAGE RIGHT (required)
- Left column: kicker, a very large display headline (clamp-based, can run 3 lines) with one word animated (a slow gradient sweep or a color cycle), then a short subline. Directly under the subline, left-aligned, two buttons: "Book a table" (primary, to #booking) and "View menu" (secondary, to #menu).
- Right column: if HERO_IMAGE_URL is set, put the static <img data-tc-hero="desktop" src="<heroUrl>"> inside the arched or rotated frame that tilts toward the pointer on hover, with a soft glow behind it and a slow floating motion. Do not replace it with a JS-only background. If it is empty, use a CSS-art composition (layered shapes, rings, or a plate-like circle) with the same motion.
- Motion on load: headline lines slide up in sequence (opacity and translateY only), buttons follow, and the image frame scales in from 96% to 100%.
- Mobile (720px and below): text stacks above the image. The image sits in normal flow, max 40vh, horizontally centered, and never overlaps the text. The static <img data-tc-hero="mobile" src="<mobileHeroUrl>"> replaces the right-column image on mobile when set; when empty, the mobile CSS art shows.

CREATIVE INTERACTIONS (choose at most 3-4 that fit the vibe; never repeat the same set across generations)
- These are optional. Completeness and working controls outrank every effect. Drop any effect that would push the document over the output budget.
- Custom cursor follower: a small ring that grows over links and buttons. Disabled on touch devices and under prefers-reduced-motion.
- Magnetic primary buttons that shift slightly toward the pointer.
- A horizontal marquee band of the restaurant name or tagline between sections, looping forever. It is continuous ambient motion, separate from reveal.
- Sticky story section: the text stays pinned (CSS position: sticky) while the image column scrolls. No JS scroll hijacking.
- Menu: filter pills with a sliding indicator; cards tilt in 3D on hover and show a glow that follows the pointer; a quick add-to-cart stepper.
- Stat figures that count up when they enter the viewport.
- Statement band in the primary color with a large centered serif line and a slow drifting background shape.
- Gallery: hover reveals a caption by opacity change only.
- Booking: JS-populated time and party selects, per-field errors, and an animated confirmation panel on success.
- Everything continuous (marquee, drift, float, cursor) stops under prefers-reduced-motion.

MENU: cards render from MENU_ITEMS in JS only, as described above.

CHATBOT: FAB with a hover treatment of your choice (lift, rotate, or pulse ring). The panel opens with a spring-like scale and fade.

HEADER: nav links have an animated underline.`;

const PROMPT_PROFESSIONAL = `${CORE_RULES}\n\n${STYLE_PROFESSIONAL}`;
const PROMPT_ATTENTION_SEEKING = `${CORE_RULES}\n\n${STYLE_ATTENTION_SEEKING}`;

const BUILD_PROMPTS: Record<"professional" | "attention-seeking", string> = {
  professional: PROMPT_PROFESSIONAL,
  "attention-seeking": PROMPT_ATTENTION_SEEKING,
};

/** Strip accidental markdown fences and enforce a generous hard cap. */
function cleanModelHtml(text: string): string {
  return text
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim()
    .slice(0, 200000);
}

/**
 * POST /api/ai/build
 * Body: { orgId, name, tagline, orgSlug, vibe, templates: "professional" | "attention-seeking", paragraph?, logoUrl?,
 *   heroUrl?, heroMobileUrl?, imageUrls?[], branches?[], contactPhone?, contactEmail?, contactAddress? }
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
  const templates = typeof body.templates === "string" ? body.templates.trim() : "";
  if (templates !== "professional" && templates !== "attention-seeking") {
    return NextResponse.json({ error: "templates must be professional or attention-seeking" }, { status: 400 });
  }
  let paragraph = typeof body.paragraph === "string" ? body.paragraph.slice(0, 2000) : "";
  let logoUrl = typeof body.logoUrl === "string" ? body.logoUrl : "";
  let imageUrls = Array.isArray(body.imageUrls)
    ? (body.imageUrls as unknown[]).filter((u): u is string => typeof u === "string").slice(0, 10)
    : [];
  let heroUrl = typeof body.heroUrl === "string" ? body.heroUrl : (typeof (body as { heroImageUrl?: unknown }).heroImageUrl === "string" ? (body as { heroImageUrl: string }).heroImageUrl : "");
  let heroMobileUrl = typeof body.heroMobileUrl === "string" ? body.heroMobileUrl : "";
  let branches = Array.isArray(body.branches)
    ? (body.branches as unknown[]).filter((b): b is string => typeof b === "string" && b.trim().length > 0).map((b) => b.trim().slice(0, 100)).slice(0, 20)
    : [];
  let contactPhone = typeof body.contactPhone === "string" ? body.contactPhone.trim().slice(0, 30) : "";
  let contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim().slice(0, 255) : "";
  let contactAddress = typeof body.contactAddress === "string" ? body.contactAddress.trim().slice(0, 500) : "";

  // Anything the user attached at signup (logo / photos / contact / branches)
  // lives on the org row — pull it in when the caller did not pass it directly.
  if (orgId && (!logoUrl || !heroUrl || !heroMobileUrl || imageUrls.length === 0 || branches.length === 0 || !contactPhone || !contactEmail || !contactAddress)) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { data: org } = await createAdminClient()
        .from("organizations")
        .select("logo_url, background_image_url, mobile_background_image_url, restaurant_photos, branches, contact_phone, contact_email, contact_address")
        .eq("id", orgId)
        .maybeSingle();
      if (!logoUrl && typeof org?.logo_url === "string") logoUrl = org.logo_url;
      if (!heroUrl && typeof (org as { background_image_url?: unknown })?.background_image_url === "string") heroUrl = (org as { background_image_url: string }).background_image_url;
      if (!heroMobileUrl && typeof (org as { mobile_background_image_url?: unknown })?.mobile_background_image_url === "string") heroMobileUrl = (org as { mobile_background_image_url: string }).mobile_background_image_url;
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
        { maxTokens: 500, disableThinking: true },
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
    heroUrl ? `Hero image (use the exact URL in BOTH const HERO_IMAGE_URL and the static <img data-tc-hero="desktop" src="...">; never in the gallery): ${heroUrl}` : `Hero image: none provided, leave HERO_IMAGE_URL empty and omit the desktop static image`,
    heroMobileUrl ? `Mobile hero image (use the exact URL in BOTH const HERO_IMAGE_URL_MOBILE and the static <img data-tc-hero="mobile" src="...">; mobile-only at 720px and below, never in the gallery and never as the desktop hero): ${heroMobileUrl}` : `Mobile hero image: none provided, leave HERO_IMAGE_URL_MOBILE empty so mobile shows the pure CSS-art hero (do not reuse the desktop image on mobile)`,
    imageUrls.length > 0 ? `Gallery images (use ONLY for GALLERY_IMAGES as {src, caption} objects and the static data-tc-gallery tiles; never reuse the hero image - even a single gallery image fills just one tile, rest stay placeholders): ${imageUrls.join(", ")}` : heroUrl ? `Gallery images: none provided. Use the hero image as ONE fallback gallery tile only (never duplicate it).` : `Gallery images: none provided, use placeholders`,
    contactPhone ? `Contact phone (must show in visit + footer): ${contactPhone}` : `Contact phone: none provided`,
    contactEmail ? `Contact email (must show in visit + footer): ${contactEmail}` : `Contact email: none provided`,
    contactAddress ? `Contact address (must show in visit + footer): ${contactAddress}` : `Contact address: none provided`,
    branches.length > 0 ? `Branches/locations (must list each in visit section): ${branches.join(" | ")}` : `Branches: none provided (single location)`,
    `Emit the complete HTML file following the hard rules.`,
  ].join("\n");

  try {
    const galleryUrlsForBuild =
      imageUrls.length > 0 ? imageUrls : heroUrl ? [heroUrl] : [];
    const validationOpts = {
      heroUrl,
      heroMobileUrl,
      galleryUrls: galleryUrlsForBuild,
      requireBootCall: true,
      requireMobileHeroConst: true,
      requireGalleryObjects: galleryUrlsForBuild.length > 0,
      orgSlug,
    };

    let buildMeta: HaikuMeta = {};
    const buildOpts = {
      system: BUILD_PROMPTS[templates],
      // Align with the real long-form output budget. The old 100k request was
      // above the model's practical cap; thinking is disabled below so the
      // whole budget goes to HTML.
      maxTokens: 64000,
      effort: "medium" as const,
      // Thinking tokens count toward max_tokens. A 60k-char page needs the
      // whole output budget; extended thinking was silently eating it.
      disableThinking: true,
      onMeta: (m: HaikuMeta) => {
        buildMeta = m;
      },
    };

    const text = await callHaikuLow(prompt, buildOpts);
    let html = cleanModelHtml(text);
    const warnings: string[] = [];
    let repaired = false;

    let check = validateBuiltHtml(html, validationOpts);
    if (!check.ok || buildMeta.stopReason === "max_tokens") {
      console.warn(
        `[AI BUILD] first pass invalid for ${orgSlug}: stop=${buildMeta.stopReason ?? "?"} chars=${html.length} errors=${check.errors.join(" | ") || "none"}`,
      );

      // Repair 1: ask for only the missing tail. This preserves the design and
      // is much cheaper than regenerating a 60k-char page.
      try {
        let repairMeta: HaikuMeta = {};
        const continuation = await callHaikuLow(
          [
            "You are completing a truncated HTML document for Tablecraft.",
            "The document below is complete up to its final character.",
            "Return ONLY the missing continuation, starting with the exact next character.",
            "Do not repeat existing text and do not wrap it in markdown fences.",
            "Finish any open function, add the missing init() call (it must call renderFilters, renderMenu, renderCart, applyHeroArt, applyGallery, setupBooking, setupChat, updateHeader, revealCheck), attach all remaining listeners, and close </script></body></html>.",
            "",
            "HTML so far:",
            html,
          ].join("\n"),
          {
            maxTokens: 20000,
            effort: "medium",
            disableThinking: true,
            onMeta: (m) => {
              repairMeta = m;
            },
          },
        );
        const stitched = cleanModelHtml(html + continuation);
        const stitchedCheck = validateBuiltHtml(stitched, validationOpts);
        if (stitchedCheck.ok) {
          html = stitched;
          check = stitchedCheck;
          repaired = true;
          console.log(
            `[AI BUILD] repaired truncated output for ${orgSlug}: ${html.length} chars repair_tokens=${repairMeta.outputTokens ?? "?"} stop=${repairMeta.stopReason ?? "?"}`,
          );
        } else {
          warnings.push(...stitchedCheck.errors);
          console.warn(
            `[AI BUILD] continuation failed for ${orgSlug}: ${stitchedCheck.errors.join(" | ")}`,
          );
        }
      } catch (e) {
        console.error(
          "[AI BUILD] continuation repair failed:",
          e instanceof Error ? e.message.slice(0, 300) : e,
        );
      }

      // Repair 2: compact full rebuild. Drop optional effects before wiring.
      if (!check.ok) {
        try {
          const compactPrompt = `${prompt}\n\nIMPORTANT: The previous attempt was cut off by the output limit. Regenerate the COMPLETE document from scratch, but keep it under 55,000 characters. Drop optional creative effects before required wiring. It must end with </script></body></html> and include init() with every render/apply/setup call.`;
          let compactMeta: HaikuMeta = {};
          const compactText = await callHaikuLow(compactPrompt, {
            ...buildOpts,
            onMeta: (m) => {
              compactMeta = m;
            },
          });
          const compactHtml = cleanModelHtml(compactText);
          const compactCheck = validateBuiltHtml(compactHtml, validationOpts);
          if (compactCheck.ok) {
            html = compactHtml;
            check = compactCheck;
            repaired = true;
            console.log(
              `[AI BUILD] compact rebuild succeeded for ${orgSlug}: ${html.length} chars stop=${compactMeta.stopReason ?? "?"}`,
            );
          } else {
            warnings.push(...compactCheck.errors);
            console.warn(
              `[AI BUILD] compact rebuild invalid for ${orgSlug}: ${compactCheck.errors.join(" | ")}`,
            );
          }
        } catch (e) {
          console.error(
            "[AI BUILD] compact rebuild failed:",
            e instanceof Error ? e.message.slice(0, 300) : e,
          );
        }
      }
    }

    warnings.push(...check.warnings);
    if (html.length > 60000) {
      warnings.push(
        `output is ${html.length} chars (target 45k-55k, hard ceiling 60k) — watch for truncation`,
      );
    }

    // Never persist a document we know is truncated/broken. The public page
    // falls back to the settings-driven design renderer when built_html is
    // absent, which is a far better failure mode than a dead site.
    if (!check.ok) {
      console.error(
        `[AI BUILD] refusing to save invalid HTML for ${orgSlug}: ${check.errors.join(" | ")}`,
      );
      return NextResponse.json(
        {
          error: "The AI build was incomplete. Please retry — no broken site was saved.",
          details: check.errors,
          warnings: [...new Set(warnings)],
          stopReason: buildMeta.stopReason,
          charCount: html.length,
        },
        { status: 502 },
      );
    }

    const wiring = validateSiteWiring(html, orgSlug);
    warnings.push(...wiring.issues);

    console.log(
      `[AI BUILD] html chars: ${html.length} ` +
        `output_tokens: ${buildMeta.outputTokens ?? "?"} ` +
        `input_tokens: ${buildMeta.inputTokens ?? "?"} ` +
        `stop: ${buildMeta.stopReason ?? "?"} ` +
        `repaired: ${repaired} ` +
        `wiring: ${wiring.ok ? "ok" : "issues"}`,
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

      // The full-document combine rewrite is the riskiest call in the pipeline.
      // Skip it when deterministic checks already prove the site is wired.
      if (wiring.ok) {
        connected = true;
        console.log(`[AI COMBINE] skipped for ${orgSlug}: deterministic wiring checks passed`);
      } else {
        try {
          const { verifyAndFixSiteHtml } = await import("@/lib/ai-connect");
          let combineOut = "?";
          let combineStop = "?";
          const fixed = await verifyAndFixSiteHtml(html, {
            orgSlug,
            name,
            onMeta: (m) => {
              combineOut = String(m.outputTokens ?? "?");
              combineStop = String(m.stopReason ?? "?");
            },
          });
          const fixedCheck = validateBuiltHtml(fixed, validationOpts);
          const fixedWiring = validateSiteWiring(fixed, orgSlug);
          if (!fixedCheck.ok || !fixedWiring.ok) {
            const issues = [...fixedCheck.errors, ...fixedWiring.issues];
            warnings.push(...issues);
            console.error(`[AI COMBINE] rejected for ${orgSlug}: ${issues.join(" | ")}`);
          } else {
            finalHtml = fixed;
            connected = true;
            console.log(
              `[AI COMBINE] auto-connect for ${orgSlug}: ${html.length} → ${fixed.length} chars output_tokens: ${combineOut} stop: ${combineStop}`,
            );
          }
        } catch (e) {
          console.error(
            "[AI COMBINE] auto-connect failed (raw build kept):",
            e instanceof Error ? e.message.slice(0, 300) : e,
          );
        }
      }

      const finalWiring = validateSiteWiring(finalHtml, orgSlug);
      if (!finalWiring.ok) {
        console.error(
          `[AI BUILD] refusing to save unwired site for ${orgSlug}: ${finalWiring.issues.join(" | ")}`,
        );
        return NextResponse.json(
          {
            error:
              "The AI build is missing required booking/cart/chat wiring. Please retry — no broken site was saved.",
            details: finalWiring.issues,
            warnings: [...new Set(warnings)],
            stopReason: buildMeta.stopReason,
            charCount: html.length,
          },
          { status: 502 },
        );
      }

      try {
        await saveHtml(finalHtml);
      } catch (e) {
        console.error(
          "[AI BUILD] persist failed (returning HTML anyway):",
          e instanceof Error ? e.message.slice(0, 200) : e,
        );
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

    const finalWarnings = [...new Set(warnings)];
    if (finalWarnings.length > 0) {
      console.error(`[AI BUILD] output warnings for ${orgSlug}: ${finalWarnings.join(" | ")}`);
    }
    return NextResponse.json({
      model: "claude-haiku-5-5",
      effort: "medium",
      html: finalHtml,
      connected,
      warnings: finalWarnings,
      stopReason: buildMeta.stopReason,
      charCount: finalHtml.length,
      repaired,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Build failed";
    const status = msg.includes("CLAUDE_API") ? 500 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
