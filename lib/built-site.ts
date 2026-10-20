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
 *  - href="#<id>" in the console preview → preventDefault + clamped
 *    window.scrollTo with measured header height (same in-document scroll as
 *    live, but instant to avoid Safari tile tears under the scaled frame;
 *    clamped to max-scroll so last anchors never overshoot into letterbox;
 *    no history spam; missing targets do nothing instead of navigating away).
 *  - href="#<id>" on the live site → preventDefault + smooth scrollIntoView.
 *  - everything else (http(s), /paths) → untouched.
 *
 * Preview scroll containment: Element.prototype.scrollIntoView() called inside
 * an iframe ALSO scrolls every scrollable ancestor up through the embedder
 * document — so the site's own smooth-scroll handlers (and even the guard's
 * fallback) used to shove the whole console page up/down on every header-nav
 * click, and the preview frame was left showing its background under the
 * jump. In preview documents (detected via the data-tc-preview-chrome style)
 * the guard therefore also installs idempotent wrappers that keep scrolling
 * inside the frame: scrollIntoView is re-issued with instant behavior and the
 * embedder's scroll position is snapshotted + restored (sync + rAF, so async
 * browser scrolls can't leak out either), and focus() is forced to
 * preventScroll with an iframe-local reveal. The live site is untouched.
 */

const NAV_GUARD_MARKER = "data-tc-nav-guard";

// Flag left on the iframe window so the preview API patches install once.
const PREVIEW_PATCH_FLAG = "__tcPreviewScrollPatched__";

const NAV_GUARD_SCRIPT = `<script ${NAV_GUARD_MARKER}>(function(){var PF='${PREVIEW_PATCH_FLAG}';function isPreview(){try{return !!document.querySelector('[data-tc-preview-chrome]');}catch(_){return false;}}function headerOffset(){try{var h=document.querySelector("header");return h?h.getBoundingClientRect().height+12:84;}catch(_){return 84;}}function maxScroll(){try{var d=document.documentElement,b=document.body;var h=Math.max(d?d.scrollHeight:0,b?b.scrollHeight:0);return Math.max(0,h-window.innerHeight);}catch(_){return 0;}}function snapParent(){try{if(window.parent&&window.parent!==window){return {x:window.parent.scrollX||0,y:window.parent.scrollY||0};}}catch(_){}return null;}function restoreParent(s){if(!s)return;try{if(window.parent&&window.parent!==window){window.parent.scrollTo(s.x,s.y);}}catch(_){}}function containedTo(y){var m=maxScroll();var t=Math.min(Math.max(0,y),m);try{window.scrollTo({top:t,behavior:"auto"});}catch(_){try{window.scrollTo(0,t);}catch(_){}}try{void document.body.offsetHeight;}catch(_){}}function containedToEl(el){try{containedTo(el.getBoundingClientRect().top+window.scrollY-headerOffset());}catch(_){}}function patchPreviewAPIs(){if(window[PF])return;window[PF]=true;try{if(window.Element&&Element.prototype&&Element.prototype.scrollIntoView){var nS=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(){if(!isPreview())return nS.apply(this,arguments);var a=arguments.length>0?arguments[0]:undefined;var o;if(a===true)o={block:"start"};else if(a===false)o={block:"end"};else if(a&&typeof a==="object"){o={};for(var k in a){if(Object.prototype.hasOwnProperty.call(a,k))o[k]=a[k];}}else o={block:"start"};o.behavior="auto";var ps=snapParent();var r;try{r=nS.call(this,o);}catch(_){try{containedToEl(this);}catch(_){}}restoreParent(ps);try{requestAnimationFrame(function(){restoreParent(ps);});}catch(_){}return r;};}}catch(_){}try{if(window.HTMLElement&&HTMLElement.prototype&&HTMLElement.prototype.focus){var nF=HTMLElement.prototype.focus;HTMLElement.prototype.focus=function(){if(!isPreview())return nF.apply(this,arguments);var a=arguments.length>0?arguments[0]:undefined;var ps=snapParent();try{nF.call(this,{preventScroll:true});}catch(_){try{nF.call(this);}catch(_){}}try{if(!(a&&typeof a==="object"&&a.preventScroll===true)&&this instanceof Element){this.scrollIntoView({block:"nearest"});}}catch(_){}restoreParent(ps);};}}catch(_){}}try{if(isPreview())patchPreviewAPIs();}catch(_){}document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;var a=t.closest('a[href^="#"]');if(!a)return;var href=a.getAttribute("href");if(!href||href.length<2)return;if(href.charAt(1)==="/"){e.preventDefault();try{location.hash=href.slice(1);}catch(_){}return;}var id=null;try{id=decodeURIComponent(href.slice(1));}catch(_){id=href.slice(1);}var el=id&&document.getElementById(id);if(isPreview()){e.preventDefault();try{patchPreviewAPIs();}catch(_){}if(!el)return;containedToEl(el);return;}if(el){e.preventDefault();try{el.scrollIntoView({behavior:"smooth",block:"start"});}catch(_){try{el.scrollIntoView();}catch(_){}}try{history.replaceState(null,"","#"+id);}catch(_){}}},true);})();</script>`;

/**
 * Inject the nav guard before </body> (or append for balanced fragments).
 * Idempotent.
 *
 * Never inject into a document with an open <script>: appending a second
 * <script> inside an unterminated script makes the HTML parser treat the tag
 * as JS and throw "Unexpected token '<'", which kills every control on the
 * page. A truncated build must be repaired/rejected upstream; the guard stays
 * out of it either way.
 */
export function withBuiltSiteGuards(html: string): string {
  if (!html || html.includes(NAV_GUARD_MARKER)) return html;
  const opens = (html.match(/<script(?=[\s>])/gi) ?? []).length;
  const closes = (html.match(/<\/script\s*>/gi) ?? []).length;
  if (opens !== closes) return html;
  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${NAV_GUARD_SCRIPT}</body>`);
  }
  // Never append after a closed </html>; insert before it instead.
  if (/<\/html\s*>/i.test(html)) {
    return html.replace(/<\/html\s*>/i, `${NAV_GUARD_SCRIPT}</html>`);
  }
  return `${html}${NAV_GUARD_SCRIPT}`;
}

function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** Replace a plain string-literal const (single, double, or backtick quotes). */
function replaceStringConst(html: string, name: string, value: string): string {
  const re = new RegExp(
    `((?:const|let|var)\\s+${name}\\s*=\\s*)(?:"[^"]*"|'[^']*'|\`[^\`]*\`)`,
    "m",
  );
  if (!re.test(html)) return html;
  return html.replace(re, (_match, prefix: string) => `${prefix}${JSON.stringify(value)}`);
}

/** Read a plain string-literal const. Returns null when the declaration is absent. */
export function extractStringConst(html: string, name: string): string | null {
  const re = new RegExp(
    `(?:const|let|var)\\s+${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\`([^\`]*)\`)\\s*;`,
  );
  const match = html.match(re);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? "";
}

/** Replace src on an <img> carrying a specific marker attribute. */
function replaceMarkedImgSrc(
  html: string,
  attr: "data-tc-hero" | "data-tc-gallery",
  marker: string,
  url: string,
): string {
  const tagRe = new RegExp(
    `<img\\b[^>]*\\b${attr}=["']${marker}["'][^>]*>`,
    "gi",
  );
  return html.replace(tagRe, (tag) => {
    const next = /\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i.test(tag)
      ? tag.replace(
          /\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i,
          `src="${escapeAttr(url)}"`,
        )
      : tag.replace(/\s*(\/?)>$/, (_end, slash: string) =>
          ` src="${escapeAttr(url)}"${slash ? "/" : ""}>`,
        );
    // A placeholder tile may have been rendered with `hidden`; once it has a
    // real URL it must be visible again.
    return next.replace(/\s+hidden(?=[\s>])/gi, "");
  });
}

function stripMarkedImgSrc(
  html: string,
  attr: "data-tc-hero" | "data-tc-gallery",
  marker: string,
): string {
  const tagRe = new RegExp(
    `<img\\b[^>]*\\b${attr}=["']${marker}["'][^>]*>`,
    "gi",
  );
  return html.replace(tagRe, (tag) =>
    tag
      .replace(/\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+>/, " hidden>"),
  );
}

/** Remove the static hero src when an edit explicitly clears the hero. */
export function withHeroCleared(html: string, marker: "desktop" | "mobile"): string {
  return stripMarkedImgSrc(html, "data-tc-hero", marker);
}

/**
 * Clear both the const and the static hero fallback. Used by console deletes:
 * `withLiveHero(null)` intentionally no-ops (so legacy AI-generated heroes are
 * not wiped), so the stored HTML itself must be cleared.
 */
export function withHeroRemoved(html: string, marker: "desktop" | "mobile"): string {
  const name = marker === "desktop" ? "HERO_IMAGE_URL" : "HERO_IMAGE_URL_MOBILE";
  const next = replaceStringConst(html, name, "");
  return withHeroCleared(next, marker);
}

/** Remove static gallery image srcs when an edit clears every gallery image. */
export function withGalleryCleared(html: string): string {
  const tagRe = /<img\b[^>]*\bdata-tc-gallery=["'][^"']*["'][^>]*>/gi;
  return html.replace(tagRe, (tag) =>
    tag
      .replace(/\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+>/, " hidden>"),
  );
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

function extractGalleryBody(html: string): string | null {
  const match = html.match(
    /(?:const|let|var)\s+GALLERY_IMAGES\s*=\s*([\s\S]*?)\]\s*;/,
  );
  return match ? match[1] : null;
}

/**
 * Legacy builds read GALLERY_IMAGES[i] as a URL string; new builds read
 * GALLERY_IMAGES[i].src. Detect which contract this page implements so live
 * photos never inject objects into a string consumer (which renders
 * "[object Object]"). New static tiles carry data-tc-gallery.
 */
function galleryUsesObjects(html: string): boolean {
  if (/\bdata-tc-gallery\s*=/i.test(html)) return true;
  const body = extractGalleryBody(html);
  if (body && /\bsrc\s*:/.test(body)) return true;
  return (
    /GALLERY_IMAGES\s*\[[^\]]*\]\s*\.\s*(?:src|url)\b/.test(html) ||
    /GALLERY_IMAGES[\s\S]{0,1000}?\.src\b/.test(html)
  );
}

/** Pull URL -> caption pairs out of the built GALLERY_IMAGES objects. */
function extractGalleryCaptions(html: string): Map<string, string> {
  const captions = new Map<string, string>();
  const body = extractGalleryBody(html);
  if (!body) return captions;
  for (const match of body.matchAll(/\{[^{}]*\}/g)) {
    const entry = match[0];
    const src = entry.match(/\bsrc\s*:\s*["']([^"']+)["']/i)?.[1];
    if (!src) continue;
    const caption = entry.match(/\bcaption\s*:\s*["']([^"']*)["']/i)?.[1];
    captions.set(src, caption ?? "");
  }
  return captions;
}

/**
 * Read gallery image URLs from the built const. Returns null when the
 * declaration is absent (as opposed to an explicit empty array).
 */
export function extractGalleryUrls(html: string): string[] | null {
  const body = extractGalleryBody(html);
  if (body === null) return null;
  const urls: string[] = [];
  for (const match of body.matchAll(/["'](https?:\/\/[^"']+)["']/g)) {
    urls.push(match[1]);
  }
  return [...new Set(urls)];
}

/**
 * Replace the built GALLERY_IMAGES declaration with live photo URLs so
 * creation uploads (organizations.restaurant_photos) and later console photo
 * edits reflect on the site instantly — no rebuild.
 *
 * Shape-aware:
 *  - New builds (data-tc-gallery / .src) receive [{src, caption}] and their
 *    static tiles are re-synced.
 *  - Legacy builds receive string[] so their existing renderer keeps working.
 *
 * No-op when the declaration is absent or the live list is empty (keeps the
 * baked placeholders / hero fallback rather than blanking the grid).
 */
export function withLiveGallery(html: string, imageUrls: string[]): string {
  if (!html || !html.includes("GALLERY_IMAGES")) return html;
  const live = (imageUrls ?? [])
    .filter((u) => typeof u === "string" && u.length > 0)
    .slice(0, 10);
  if (live.length === 0) return html;

  const objects = galleryUsesObjects(html);
  const existingCaptions = extractGalleryCaptions(html);
  const payload = objects
    ? live.map((src, i) => ({
        src,
        caption: existingCaptions.get(src) || `Photo ${i + 1}`,
      }))
    : live;

  const replacement = `const GALLERY_IMAGES = ${JSON.stringify(payload)};`;
  const next = html.replace(
    /(?:const|let|var)\s+GALLERY_IMAGES\s*=\s*\[[\s\S]*?\]\s*;/,
    replacement,
  );
  if (next === html) return html;

  let synced = next;
  if (objects) {
    live.forEach((url, i) => {
      synced = replaceMarkedImgSrc(synced, "data-tc-gallery", String(i), url);
    });
  }
  return synced;
}

/**
 * Replace the built HERO_IMAGE_URL const AND the static
 * <img data-tc-hero="desktop"> src. The static image is the no-JS fallback;
 * the const is what init() applies for live console updates.
 * No-op when the declaration is absent or heroUrl is empty (keeps the baked
 * CSS-art placeholder or an edit-applied override).
 */
export function withLiveHero(html: string, heroUrl: string | null | undefined): string {
  if (!html || !html.includes("HERO_IMAGE_URL")) return html;
  if (typeof heroUrl !== "string" || heroUrl.length === 0) return html;
  let next = replaceStringConst(html, "HERO_IMAGE_URL", heroUrl);
  next = replaceMarkedImgSrc(next, "data-tc-hero", "desktop", heroUrl);
  return next;
}

/**
 * Mobile twin of withLiveHero. Never touches HERO_IMAGE_URL: the desktop
 * helper only matches the exact declaration name and the desktop marker.
 * No-op when the declaration is absent or mobileUrl is empty.
 */
export function withLiveHeroMobile(html: string, mobileUrl: string | null | undefined): string {
  if (!html || !html.includes("HERO_IMAGE_URL_MOBILE")) return html;
  if (typeof mobileUrl !== "string" || mobileUrl.length === 0) return html;
  let next = replaceStringConst(html, "HERO_IMAGE_URL_MOBILE", mobileUrl);
  next = replaceMarkedImgSrc(next, "data-tc-hero", "mobile", mobileUrl);
  return next;
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
  // Match the style ELEMENT, not the bare marker string. The nav-guard script
  // contains "data-tc-preview-chrome" inside its own
  // querySelector('[data-tc-preview-chrome]') preview check, so a bare
  // substring match false-positives on guarded HTML and skips the injection —
  // leaving preview detection permanently off (every preview anchor click
  // then takes the live smooth-scroll path and shoves the console page).
  if (next.includes("<style data-tc-preview-chrome")) return next;
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
