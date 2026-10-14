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
 *  - href="#<id>" → preventDefault + scroll the matching element into view.
 *  - everything else (http(s), /paths) → untouched.
 */

const NAV_GUARD_MARKER = "data-tc-nav-guard";

const NAV_GUARD_SCRIPT = `<script ${NAV_GUARD_MARKER}>(function(){document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;var a=t.closest('a[href^="#"]');if(!a)return;var href=a.getAttribute("href");if(!href||href.length<2)return;if(href.charAt(1)==="/"){e.preventDefault();try{location.hash=href.slice(1);}catch(_){}return;}var id=decodeURIComponent(href.slice(1));var el=id&&document.getElementById(id);if(el){e.preventDefault();try{el.scrollIntoView({behavior:"smooth",block:"start"});}catch(_){el.scrollIntoView();}try{history.replaceState(null,"","#"+id);}catch(_){}}},true);})();</script>`;

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
 * Replace the built const MENU_ITEMS with live DB rows so console menu edits
 * (rename/remove/reprice) reflect on the site instantly — no rebuild.
 * Critical side effect: cart checkout posts DB UUIDs, which /api/cart/checkout
 * validates server-side (the model's invented slug ids would be rejected).
 * No-op when the const is absent or items is empty.
 */
export function withLiveMenu(html: string, items: LiveMenuItem[]): string {
  if (!html || items.length === 0 || !html.includes("MENU_ITEMS")) return html;
  const live = items.map((item) => ({
    id: item.id,
    name: item.name,
    price: Number(item.price),
    category: item.category ?? "General",
    description: item.description ?? "",
  }));
  const replacement = `const MENU_ITEMS = ${JSON.stringify(live)};`;
  const next = html.replace(/const MENU_ITEMS\s*=\s*\[[\s\S]*?\]\s*;/, replacement);
  return next === html ? html : next;
}

/** Preview-only chrome: hide scrollbars inside the preview frame (viewport sim). */
const PREVIEW_SCROLLBAR_CSS = `<style data-tc-preview-chrome>html{scrollbar-width:none!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}</style>`;

export function withPreviewChrome(html: string): string {
  if (!html || html.includes("data-tc-preview-chrome")) return html;
  if (/<\/head\s*>/i.test(html)) {
    return html.replace(/<\/head\s*>/i, `${PREVIEW_SCROLLBAR_CSS}</head>`);
  }
  return `${PREVIEW_SCROLLBAR_CSS}${html}`;
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
