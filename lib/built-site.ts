/**
 * lib/built-site.ts — serving guards for AI-built standalone sites.
 *
 * Stored sites are served inside same-origin srcDoc iframes. Two platform
 * facts break their in-page navigation unless guarded:
 *  1. An about:srcdoc document inherits the embedder's URL as its base, so a
 *     fragment link like href="#menu" NAVIGATES the frame to /<slug>#menu
 *     (a real reload) instead of scrolling in place.
 *  2. With X-Frame-Options/CSP refusing the reload, the frame goes blank.
 *
 * withBuiltSiteGuards() injects a tiny capture-phase click guard (idempotent)
 * that keeps fragment navigation in-document:
 *  - href="#/cart" (or any "#/...") → preventDefault + set location.hash
 *    directly (fires hashchange, no navigation) so the cart router runs.
 *  - href="#<id>" in the console preview → native fragment navigation via
 *    clamped window.scrollTo with measured header height (same in-document scroll as live, but instant to avoid Safari tile tears under the scaled frame; clamped to max-scroll so last anchors never overshoot into letterbox;
 *    no history spam; missing targets do nothing instead of navigating away).
 *  - href="#<id>" on the live site → preventDefault + smooth scrollIntoView.
 *  - everything else (http(s), /paths) → untouched.
 */

const NAV_GUARD_MARKER = "data-tc-nav-guard";

const NAV_GUARD_SCRIPT = `<script ${NAV_GUARD_MARKER}>(function(){document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;var a=t.closest('a[href^="#"]');if(!a)return;var href=a.getAttribute("href");if(!href||href.length<2)return;if(href.charAt(1)==="/"){e.preventDefault();try{location.hash=href.slice(1);}catch(_){}return;}var id=decodeURIComponent(href.slice(1));var el=id&&document.getElementById(id);var pv=false;try{pv=!!document.querySelector('[data-tc-preview-chrome]');}catch(_){}if(pv){e.preventDefault();if(!el)return;try{var hdr=document.querySelector("header");var off=hdr?hdr.getBoundingClientRect().height+12:84;var y=el.getBoundingClientRect().top+window.scrollY-off;var max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);window.scrollTo({top:Math.min(Math.max(0,y),max),behavior:"auto"});}catch(_){try{el.scrollIntoView({block:"start"});}catch(_){}}return;}if(el){e.preventDefault();try{el.scrollIntoView({behavior:"smooth",block:"start"});}catch(_){el.scrollIntoView();}try{history.replaceState(null,"","#"+id);}catch(_){}}},true);})();</script>`;

/** Inject the nav guard before </body> (or append). Idempotent. */
export function withBuiltSiteGuards(html: string): string {
  if (!html || html.includes(NAV_GUARD_MARKER)) return html;
  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${NAV_GUARD_SCRIPT}</body>`);
  }
  return `${html}${NAV_GUARD_SCRIPT}`;
}

export type LiveMenuItem = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  description: string | null;
};

/**
 * Replace the built MENU_ITEMS declaration with live DB rows so console menu
 * edits (add/rename/remove/reprice) reflect on the site instantly — no rebuild.
 * Critical side effect: cart checkout posts DB UUIDs, which /api/cart/checkout
 * validates server-side (the model's invented slug ids would be rejected).
 * An empty list still replaces (renders the site's empty state) — otherwise
 * deleting every item would leave the baked-in demo menu on the site.
 * No-op only when the declaration is absent or has an unrecognized shape.
 */
export function withLiveMenu(html: string, items: LiveMenuItem[]): string {
  if (!html || !html.includes("MENU_ITEMS")) return html;
  const live = items.map((item) => ({
    id: item.id,
    name: item.name,
    price: Number(item.price),
    category: item.category ?? "General",
    description: item.description ?? "",
  }));
  const replacement = `const MENU_ITEMS = ${JSON.stringify(live)};`;
  const next = html.replace(/(?:const|let|var)\s+MENU_ITEMS\s*=\s*\[[\s\S]*?\]\s*;/, replacement);
  return next === html ? html : next;
}

/**
 * Replace the built GALLERY_IMAGES declaration with live photo URLs so
 * creation uploads (organizations.restaurant_photos) and later console photo
 * edits reflect on the site instantly — no rebuild.
 * No-op when the declaration is absent or the live list is empty (keeps the
 * baked placeholders rather than blanking the gallery grid).
 */
export function withLiveGallery(html: string, imageUrls: string[]): string {
  if (!html || !html.includes("GALLERY_IMAGES")) return html;
  const live = (imageUrls ?? []).filter((u) => typeof u === "string" && u.length > 0).slice(0, 10);
  if (live.length === 0) return html;
  const replacement =
    `const GALLERY_IMAGES = ${JSON.stringify(live.map((src, i) => ({ src, caption: `Photo ${i + 1}` })))};`;
  const next = html.replace(/(?:const|let|var)\s+GALLERY_IMAGES\s*=\s*\[[\s\S]*?\]\s*;/, replacement);
  return next === html ? html : next;
}

/**
 * Replace the built HERO_IMAGE_URL const with the live hero photo
 * (organizations.background_image_url from the creation hero upload) so the
 * hero stays live without a rebuild. Gallery images are never used here.
 * No-op when the declaration is absent or heroUrl is empty (keeps the baked
 * CSS-art placeholder rather than injecting a broken src).
 */
export function withLiveHero(html: string, heroUrl: string | null | undefined): string {
  if (!html || !html.includes("HERO_IMAGE_URL")) return html;
  if (typeof heroUrl !== "string" || heroUrl.length === 0) return html;
  const replacement = `const HERO_IMAGE_URL = ${JSON.stringify(heroUrl)};`;
  const next = html.replace(/(?:const|let|var)\s+HERO_IMAGE_URL\s*=\s*(?:"[^"]*"|'[^']*')\s*;/, replacement);
  return next === html ? html : next;
}


/** Preview-only chrome: hide scrollbars + force instant anchor scrolling inside
 * the preview frame (a smooth programmatic scroll under the scaled preview
 * ancestor tears unpainted tiles in Safari; live sites keep smooth scroll). */
function previewViewportMeta(deviceWidth?: number): string {
  const w = typeof deviceWidth === "number" && Number.isFinite(deviceWidth) && deviceWidth > 0 ? Math.round(deviceWidth) : 0;
  const content = w > 0 ? `width=${w}, initial-scale=1` : "width=device-width, initial-scale=1";
  return `<meta name="viewport" content="${content}">`;
}
const PREVIEW_SCROLLBAR_CSS = `<style data-tc-preview-chrome>html{scrollbar-width:none!important;scroll-behavior:auto!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}html,body{margin:0!important;padding:0!important}body{min-height:100%}</style>`;

export function withPreviewChrome(html: string, deviceWidth?: number): string {
  if (!html) return html;
  const viewportMeta = previewViewportMeta(deviceWidth);
  let next = html;
  if (!/name=["\']viewport["\']/i.test(next)) {
    if (/<head[^>]*>/i.test(next)) {
      next = next.replace(/<head[^>]*>/i, (m) => `${m}${viewportMeta}`);
    } else if (/<html[^>]*>/i.test(next)) {
      next = next.replace(/<html[^>]*>/i, (m) => `${m}<head>${viewportMeta}</head>`);
    } else {
      next = `${viewportMeta}${next}`;
    }
  }
  if (next.includes("data-tc-preview-chrome")) return next;
  if (/<\/head\s*>/i.test(next)) {
    return next.replace(/<\/head\s*>/i, `${PREVIEW_SCROLLBAR_CSS}</head>`);
  }
  return `${PREVIEW_SCROLLBAR_CSS}${next}`;
}

/**
 * Pull the AI-built chatbot's accent color out of stored HTML (FAB background)
 * so the console chatbot preview can wear the site's real colors instead of
 * the default Tablecraft theme. Returns null when not found.
 */
export function extractChatbotAccent(html: string): string | null {
  if (!html) return null;
  const patterns = [
    /\.chat-fab\s*\{[^}]*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/,
    /#chatFab[^}]*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) return m[1];
  }
  return null;
}
