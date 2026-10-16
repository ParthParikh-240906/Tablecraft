/**
 * tests/unit/built-site.test.ts
 * Covers lib/built-site.ts — nav-guard injection for srcDoc-served AI sites.
 */
import { describe, it, expect } from "vitest";
import { withBuiltSiteGuards, withLiveHero, withLiveMenu, withPreviewChrome, extractChatbotAccent } from "@/lib/built-site";

describe("withBuiltSiteGuards", () => {
  it("injects the guard before </body>", () => {
    const out = withBuiltSiteGuards("<html><body><p>hi</p></body></html>");
    expect(out).toContain("data-tc-nav-guard");
    expect(out.indexOf("data-tc-nav-guard")).toBeLessThan(out.indexOf("</body>"));
  });

  it("is idempotent", () => {
    const once = withBuiltSiteGuards("<html><body></body></html>");
    expect(withBuiltSiteGuards(once)).toBe(once);
  });

  it("appends when no </body> exists and leaves empty input alone", () => {
    expect(withBuiltSiteGuards("<p>x</p>")).toContain("data-tc-nav-guard");
    expect(withBuiltSiteGuards("")).toBe("");
  });

  it("guard distinguishes #/cart routes from #id anchors", () => {
    const out = withBuiltSiteGuards("<html><body></body></html>");
    // Cart-style hashes go through location.hash (router), plain ids scroll.
    expect(out).toContain("location.hash");
    expect(out).toContain("scrollIntoView");
  });

  it("clamps preview anchor scroll and smooth-scrolls on live", () => {
    const out = withBuiltSiteGuards("<html><body></body></html>");
    // Preview branch uses clamped window.scrollTo with measured header height
    // (never overshoots into letterbox at max-scroll); live keeps smooth scrollIntoView.
    expect(out).toContain("data-tc-preview-chrome");
    expect(out).not.toContain("location.replace(href)");
    expect(out).toContain("window.scrollTo");
    expect(out).toContain("scrollHeight");
    expect(out).toContain('"smooth"');
  });
});

describe("withLiveMenu", () => {
  const html = `<html><body><script>const MENU_ITEMS = [{id: "x", name: "Old", price: 1}];
render();<\/script></body></html>`;
  const items = [{ id: "uuid-1", name: "New Dish", price: 42, category: "Mains", description: "demo menu item" }];

  it("replaces the const with DB rows (UUID ids for checkout)", () => {
    const out = withLiveMenu(html, items);
    expect(out).toContain('"uuid-1"');
    expect(out).toContain('"New Dish"');
    expect(out).not.toContain('"Old"');
    expect(out).toContain("render();");
  });

  it("replaces with an empty list when the DB list is empty (never keeps demos)", () => {
    const out = withLiveMenu(html, []);
    expect(out).toContain("const MENU_ITEMS = [];");
    expect(out).not.toContain('"Old"');
  });

  it("is a no-op without the declaration", () => {
    expect(withLiveMenu("<p>no menu here</p>", items)).toBe("<p>no menu here</p>");
  });

  it("matches let/var declarations too", () => {
    const v = `<script>let MENU_ITEMS = [{name: "Old", price: 1}];</script>`;
    expect(withLiveMenu(v, items)).toContain('"uuid-1"');
  });
});

describe("withPreviewChrome", () => {
  it("hides preview scrollbars and is idempotent", () => {
    const out = withPreviewChrome("<html><head></head><body></body></html>");
    expect(out).toContain("data-tc-preview-chrome");
    expect(withPreviewChrome(out)).toBe(out);
  });

  it("injects a viewport meta so tablet/mobile widths trigger media queries", () => {
    const out = withPreviewChrome("<html><head></head><body></body></html>");
    expect(out).toContain('name="viewport"');
    expect(out).toContain("width=device-width");
    expect(withPreviewChrome(out)).toBe(out);
  });

  it("injects a per-device viewport width when given (preview frame truth)", () => {
    const out = withPreviewChrome("<html><head></head><body></body></html>", 390);
    expect(out).toContain("width=390");
    expect(out).not.toContain("width=device-width");
  });

  it("zeroes body margin instead of global scroll-margin (JS clamps instead)", () => {
    const out = withPreviewChrome("<html><head></head><body></body></html>");
    expect(out).toContain("margin:0");
    expect(out).not.toContain("scroll-margin-top");
  });
});

describe("withLiveHero", () => {
  it("replaces HERO_IMAGE_URL with the live hero URL", () => {
    const html = `<script>const HERO_IMAGE_URL = "";</script>`;
    const out = withLiveHero(html, "https://x/hero.jpg");
    expect(out).toContain("https://x/hero.jpg");
  });

  it("is a no-op when hero is empty or declaration absent", () => {
    expect(withLiveHero(`<script>const HERO_IMAGE_URL = "";</script>`, "")).toContain("HERO_IMAGE_URL");
    expect(withLiveHero("<p>no hero here</p>", "https://x/hero.jpg")).toBe("<p>no hero here</p>");
  });

  it("leaves HERO_IMAGE_URL_MOBILE untouched (mobile override is edit-owned)", () => {
    const html = `<script>const HERO_IMAGE_URL = "";const HERO_IMAGE_URL_MOBILE = "https://x/mobile.jpg";</script>`;
    const out = withLiveHero(html, "https://x/desktop.jpg");
    expect(out).toContain("https://x/desktop.jpg");
    expect(out).toContain('const HERO_IMAGE_URL_MOBILE = "https://x/mobile.jpg";');
  });
});

describe("extractChatbotAccent", () => {
  it("reads the FAB background hex", () => {
    expect(extractChatbotAccent("<style>.chat-fab{background:#8b1e2d;color:#fff}</style>")).toBe("#8b1e2d");
    expect(extractChatbotAccent("<p>no chat here</p>")).toBeNull();
  });
});
