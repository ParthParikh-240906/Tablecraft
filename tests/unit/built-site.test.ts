/**
 * tests/unit/built-site.test.ts
 * Covers lib/built-site.ts — nav-guard injection for srcDoc-served AI sites.
 */
import { describe, it, expect } from "vitest";
import vm from "node:vm";
import { withBuiltSiteGuards, withLiveHero, withLiveHeroMobile, withLiveMenu, withPreviewChrome, extractChatbotAccent } from "@/lib/built-site";

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

  it("contains preview scrolling to the frame (never the embedder page)", () => {
    const out = withBuiltSiteGuards("<html><body></body></html>");
    // scrollIntoView inside an iframe otherwise scrolls every scrollable
    // ancestor up through the parent document — the console-page jump.
    expect(out).toContain("prototype.scrollIntoView");
    // The wrapper snapshots the embedder scroll and restores it.
    expect(out).toContain("window.parent.scrollTo");
    // focus() can't drag the parent either (preventScroll + iframe-local reveal).
    expect(out).toContain("prototype.focus");
    expect(out).toContain("preventScroll");
    // Installed once per frame.
    expect(out).toContain("__tcPreviewScrollPatched__");
    // Clamp accounts for body-sized documents too, not just documentElement.
    expect(out).toContain("document.body");
  });
});

/**
 * Behavioral coverage: execute the injected guard in a mocked iframe and
 * assert scrolling stays inside the frame while the embedder is untouched.
 */
function extractGuardJs(html: string): string {
  const m = html.match(/<script data-tc-nav-guard>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("guard script not found in output");
  return m[1];
}

interface MockFrame {
  run: (code: string) => void;
  clickAnchor: (href: string, targetId: string | null) => { prevented: boolean };
  sivOn: (el: object, arg?: unknown) => void;
  frameScrolls: unknown[][];
  parentScrolls: [number, number][];
  parentPos: () => { x: number; y: number };
  nativeSivCalls: { opts: unknown }[];
  replacedHash: () => string | null;
}

function makeMockFrame(opts: { targetTop?: number }, composedHtml: string): MockFrame {
  const frameScrolls: unknown[][] = [];
  const parentScrolls: [number, number][] = [];
  const nativeSivCalls: { opts: unknown }[] = [];
  // Sentinel embedder position — the bug moved this on every nav click.
  let parentX = 111;
  let parentY = 222;
  let replaced: string | null = null;
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const targetTop = opts.targetTop ?? 500;
  // Faithful preview detection: the guard can only see a <style> ELEMENT,
  // exactly like querySelector in a real document — a bare marker substring
  // inside the guard's own script text does NOT count (that false-positive
  // masked the real bug: the chrome element was never injected).
  const preview = composedHtml.includes("<style data-tc-preview-chrome");

  function ElementMock(this: unknown) {}
  ElementMock.prototype.scrollIntoView = function (this: unknown, arg: unknown) {
    nativeSivCalls.push({ opts: arg });
    // Simulate the platform leak: a native scrollIntoView inside an iframe
    // also moves the embedder document.
    parentY = 9999;
  };
  function HTMLElementMock(this: unknown) {}
  HTMLElementMock.prototype.focus = function () {};

  // Anchor targets are real Elements (so scrollIntoView resolves on them).
  const targetEl = Object.assign(Object.create(ElementMock.prototype), {
    getBoundingClientRect: () => ({ top: targetTop, height: 100 }),
  });
  const headerEl = { getBoundingClientRect: () => ({ height: 60 }) };

  const documentMock: {
    querySelector: (sel: string) => unknown;
    getElementById: (id: string) => typeof targetEl | null;
    addEventListener: (type: string, fn: (e: unknown) => void) => void;
    documentElement: { scrollHeight: number };
    body: { scrollHeight: number; offsetHeight: number };
  } = {
    querySelector: (sel: string) => {
      if (sel === "[data-tc-preview-chrome]") return preview ? {} : null;
      if (sel === "header") return headerEl;
      return null;
    },
    getElementById: (id: string) => (id === "menu" ? targetEl : null),
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      (listeners[type] ??= []).push(fn);
    },
    documentElement: { scrollHeight: 3000 },
    body: { scrollHeight: 3000, offsetHeight: 3000 },
  };

  const parentMock = {
    get scrollX() {
      return parentX;
    },
    get scrollY() {
      return parentY;
    },
    scrollTo: (x: number, y: number) => {
      parentScrolls.push([x, y]);
      parentX = x;
      parentY = y;
    },
  };
  const windowMock: Record<string, unknown> = {
    scrollY: 100,
    innerHeight: 800,
    scrollTo: (...args: unknown[]) => {
      frameScrolls.push(args);
    },
    parent: preview ? parentMock : undefined,
    Element: ElementMock,
    HTMLElement: HTMLElementMock,
  };
  // Live (non-preview) documents are top-level: parent === self.
  if (!preview) windowMock.parent = windowMock;

  const sandbox: Record<string, unknown> = {
    document: documentMock,
    window: windowMock,
    Element: ElementMock,
    HTMLElement: HTMLElementMock,
    location: { hash: "" },
    history: {
      replaceState: (_a: unknown, _b: unknown, url: string) => {
        replaced = url;
      },
    },
    requestAnimationFrame: (fn: () => void) => {
      fn();
      return 0;
    },
  };
  // Bare globals in the guard resolve against the context itself.
  vm.createContext(sandbox);

  return {
    run: (code: string) => vm.runInContext(code, sandbox),
    frameScrolls,
    parentScrolls,
    nativeSivCalls,
    parentPos: () => ({ x: parentX, y: parentY }),
    replacedHash: () => replaced,
    clickAnchor: (href: string, targetId: string | null) => {
      let prevented = false;
      const anchor = { getAttribute: (n: string) => (n === "href" ? href : null) };
      const event = {
        target: { closest: () => anchor },
        preventDefault: () => {
          prevented = true;
        },
      };
      // Point getElementById at the requested target for this click.
      documentMock.getElementById =
        targetId === null ? () => null : (id: string) => (id === targetId ? targetEl : null);
      for (const fn of listeners["click"] ?? []) fn(event);
      return { prevented };
    },
    sivOn: (el: object, arg?: unknown) => {
      (ElementMock.prototype.scrollIntoView as (this: unknown, a?: unknown) => void).call(el, arg);
    },
  };
}

describe("preview scroll containment (behavioral)", () => {
  it("anchor click scrolls only the frame; the embedder never moves", () => {
    const html = withPreviewChrome(withBuiltSiteGuards("<html><head></head><body></body></html>"), 1280);
    const frame = makeMockFrame({}, html);
    frame.run(extractGuardJs(html));

    const { prevented } = frame.clickAnchor("#menu", "menu");
    expect(prevented).toBe(true);
    // 500 (target top) + 100 (scrollY) - (60 header + 12) = 528, under max 2200.
    expect(frame.frameScrolls).toEqual([[{ top: 528, behavior: "auto" }]]);
    expect(frame.parentPos()).toEqual({ x: 111, y: 222 });
    expect(frame.parentScrolls).toEqual([]);
  });

  it("near-bottom anchors clamp to max-scroll (no overshoot into letterbox)", () => {
    const html = withPreviewChrome(withBuiltSiteGuards("<html><head></head><body></body></html>"), 768);
    const frame = makeMockFrame({ targetTop: 5000 }, html);
    frame.run(extractGuardJs(html));

    frame.clickAnchor("#menu", "menu");
    // 5000 + 100 - 72 = 5028 → clamped to 3000 - 800 = 2200.
    expect(frame.frameScrolls).toEqual([[{ top: 2200, behavior: "auto" }]]);
    expect(frame.parentPos()).toEqual({ x: 111, y: 222 });
  });

  it("site-JS scrollIntoView is contained: native runs instant, embedder restored", () => {
    const html = withPreviewChrome(withBuiltSiteGuards("<html><head></head><body></body></html>"), 390);
    const frame = makeMockFrame({}, html);
    frame.run(extractGuardJs(html));

    const el = {};
    frame.sivOn(el, { behavior: "smooth", block: "start" });
    // Native still runs (in-frame positioning intact) but forced instant.
    expect(frame.nativeSivCalls).toHaveLength(1);
    expect(frame.nativeSivCalls[0].opts).toMatchObject({ behavior: "auto" });
    // The platform leak (parent yanked to 9999) is undone.
    expect(frame.parentPos()).toEqual({ x: 111, y: 222 });
    expect(frame.parentScrolls[frame.parentScrolls.length - 1]).toEqual([111, 222]);
  });

  it("missing anchor targets do nothing instead of navigating away", () => {
    const html = withPreviewChrome(withBuiltSiteGuards("<html><head></head><body></body></html>"), 1280);
    const frame = makeMockFrame({}, html);
    frame.run(extractGuardJs(html));

    const { prevented } = frame.clickAnchor("#nope", null);
    expect(prevented).toBe(true);
    expect(frame.frameScrolls).toEqual([]);
    expect(frame.parentPos()).toEqual({ x: 111, y: 222 });
  });

  it("live documents keep smooth scroll + hash (no containment installed)", () => {
    const html = withBuiltSiteGuards("<html><head></head><body></body></html>");
    const frame = makeMockFrame({}, html);
    frame.run(extractGuardJs(html));

    const { prevented } = frame.clickAnchor("#menu", "menu");
    expect(prevented).toBe(true);
    expect(frame.nativeSivCalls).toHaveLength(1);
    expect(frame.nativeSivCalls[0].opts).toMatchObject({ behavior: "smooth" });
    expect(frame.replacedHash()).toBe("#menu");
    expect(frame.frameScrolls).toEqual([]);
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

  it("still injects the chrome element into guarded HTML (no false-positive skip)", () => {
    // The guard script contains the marker string inside its own preview
    // check — that must not satisfy the chrome idempotency check, or preview
    // detection stays off forever and every click takes the live scroll path.
    const guarded = withBuiltSiteGuards("<html><head></head><body></body></html>");
    expect(guarded).toContain("data-tc-preview-chrome");
    expect(guarded).not.toContain("<style data-tc-preview-chrome");
    const composed = withPreviewChrome(guarded, 1280);
    expect(composed).toContain("<style data-tc-preview-chrome");
    expect(composed).toContain("data-tc-nav-guard");
    expect(withPreviewChrome(composed)).toBe(composed);
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

  it("leaves HERO_IMAGE_URL_MOBILE untouched (the mobile const has its own live helper)", () => {
    const html = `<script>const HERO_IMAGE_URL = "";const HERO_IMAGE_URL_MOBILE = "https://x/mobile.jpg";</script>`;
    const out = withLiveHero(html, "https://x/desktop.jpg");
    expect(out).toContain("https://x/desktop.jpg");
    expect(out).toContain('const HERO_IMAGE_URL_MOBILE = "https://x/mobile.jpg";');
  });
});

describe("withLiveHeroMobile", () => {
  it("replaces HERO_IMAGE_URL_MOBILE with the live mobile hero URL", () => {
    const html = `<script>const HERO_IMAGE_URL_MOBILE = "";</script>`;
    const out = withLiveHeroMobile(html, "https://x/mobile.jpg");
    expect(out).toContain("https://x/mobile.jpg");
  });

  it("is a no-op when the mobile hero is empty or the declaration is absent", () => {
    expect(withLiveHeroMobile(`<script>const HERO_IMAGE_URL_MOBILE = "";</script>`, "")).toContain("HERO_IMAGE_URL_MOBILE");
    expect(withLiveHeroMobile("<p>no hero here</p>", "https://x/mobile.jpg")).toBe("<p>no hero here</p>");
  });

  it("never touches HERO_IMAGE_URL (desktop swap belongs to withLiveHero)", () => {
    const html = `<script>const HERO_IMAGE_URL = "https://x/desktop.jpg";const HERO_IMAGE_URL_MOBILE = "";</script>`;
    const out = withLiveHeroMobile(html, "https://x/mobile.jpg");
    expect(out).toContain('const HERO_IMAGE_URL = "https://x/desktop.jpg";');
    expect(out).toContain('const HERO_IMAGE_URL_MOBILE = "https://x/mobile.jpg";');
  });

  it("leaves HERO_IMAGE_URL untouched when only the mobile URL is present", () => {
    const html = `<script>const HERO_IMAGE_URL = "";const HERO_IMAGE_URL_MOBILE = "";</script>`;
    const out = withLiveHeroMobile(html, "https://x/mobile.jpg");
    expect(out).toContain('const HERO_IMAGE_URL = "";');
    expect(out).toContain('const HERO_IMAGE_URL_MOBILE = "https://x/mobile.jpg";');
  });
});

describe("extractChatbotAccent", () => {
  it("reads the FAB background hex", () => {
    expect(extractChatbotAccent("<style>.chat-fab{background:#8b1e2d;color:#fff}</style>")).toBe("#8b1e2d");
    expect(extractChatbotAccent("<p>no chat here</p>")).toBeNull();
  });
});
