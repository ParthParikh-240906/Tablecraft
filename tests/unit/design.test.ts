/**
 * tests/unit/design.test.ts
 * Covers lib/design.ts — color helpers, shadow, rect clamping,
 * defaults, hydration (v1→v2), content builders, templates.
 * Mirrors error-handling contract: hydrateSettings must never throw
 * on legacy/malformed JSONB, always returns a renderable v2 object.
 */
import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  hexToRgba,
  getShadowStyle,
  clampRect,
  uid,
  newHeroElement,
  newContentElement,
  defaultHeaderDesign,
  defaultHeroBackground,
  defaultChatbotDesign,
  defaultMenuPageDesign,
  defaultReservePageDesign,
  defaultBookingConfig,
  hydrateSettings,
  buildDefaultContentElements,
  buildHeroTemplate,
  buildContentTemplate,
  DEFAULT_TEXT_DESIGN,
  deviceForWidth,
  resolveFontSize,
  getFontOverride,
  withFontOverride,
  resolveColor,
  getColorOverride,
  withColorOverride,
  resolveRect,
  getRectOverride,
  withRectOverride,
  pruneElementOverrides,
  dropPageFontOverrides,
  LOGO_SIZE_KEY,
  resolveLogoSize,
  getLogoSizeOverride,
  withLogoSizeOverride,
  type ResponsiveOverrides,
} from "@/lib/design";

describe("hexToRgb", () => {
  it("parses 6-digit hex", () => {
    expect(hexToRgb("#ff6b35")).toEqual({ r: 255, g: 107, b: 53 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("parses 3-digit shorthand", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("returns black for invalid hex (error fallback, never throws)", () => {
    expect(hexToRgb("not-a-color")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#zzzzzz")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("")).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("hexToRgba", () => {
  it("converts hex + alpha to rgba string", () => {
    expect(hexToRgba("#ff0000", 1)).toBe("rgba(255,0,0,1)");
    expect(hexToRgba("#00ff00", 0.5)).toBe("rgba(0,255,0,0.5)");
  });

  it("clamps alpha to 0..1", () => {
    expect(hexToRgba("#000000", 5)).toBe("rgba(0,0,0,1)");
    expect(hexToRgba("#000000", -2)).toBe("rgba(0,0,0,0)");
  });

  it("falls back to black on invalid hex", () => {
    expect(hexToRgba("zzz", 0.5)).toBe("rgba(0,0,0,0.5)");
  });
});

describe("getShadowStyle", () => {
  it("returns undefined when no shadow or zero length", () => {
    expect(getShadowStyle(undefined)).toBeUndefined();
    expect(getShadowStyle({ color: "#000", direction: 0, length: 0 })).toBeUndefined();
  });

  it("computes offset from direction + length", () => {
    // direction 0deg → +x axis
    const s = getShadowStyle({ color: "#000000", direction: 0, length: 4 });
    expect(s).toContain("4px");
    expect(s).toContain("rgba(0,0,0,1)");
  });

  it("respects opacity and scale", () => {
    const s = getShadowStyle({ color: "#ffffff", direction: 90, length: 10, opacity: 0.5 }, 2);
    expect(s).toContain("rgba(255,255,255,0.5)");
  });
});

describe("clampRect", () => {
  it("clamps x/w inside 0..100", () => {
    const r = clampRect({ x: -10, y: -5, w: 200, h: 1 });
    expect(r.x).toBe(0);
    expect(r.w).toBe(100);
    expect(r.y).toBe(0);
    expect(r.h).toBeGreaterThanOrEqual(3);
  });

  it("respects maxY bound", () => {
    const r = clampRect({ x: 10, y: 90, w: 20, h: 20 }, 3, 100);
    expect(r.y + r.h).toBeLessThanOrEqual(100);
  });
});

describe("factories", () => {
  it("uid generates unique ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()));
    expect(ids.size).toBe(100);
  });

  it("newHeroElement shape/image/button have sane defaults", () => {
    expect(newHeroElement("title", 32).design.fontSize).toBe(32);
    const shape = newHeroElement("shape", 16);
    expect(shape.color).toBe("#1a1a1a");
    expect(shape.opacity).toBe(100);
    const btn = newHeroElement("button", 16);
    expect(btn.buttonType).toBe("book");
    expect(btn.bgColor).toBe("#f97316");
  });

  it("newContentElement images defaults", () => {
    const imgs = newContentElement("images");
    expect(imgs.image_urls).toEqual([]);
    expect(imgs.w).toBe(100);
    const title = newContentElement("title");
    expect(title.design.fontSize).toBe(28);
  });

  it("default designs return expected keys", () => {
    expect(defaultHeaderDesign().cta_design.bgColor).toBeDefined();
    expect(defaultHeroBackground().type).toBe("color");
    expect(defaultChatbotDesign().color).toBe("#f97316");
    expect(defaultMenuPageDesign().border_width).toBe(1);
    expect(defaultReservePageDesign().input_bg_color).toBe("#ffffff");
    expect(defaultBookingConfig()).toEqual({
      buffer_before_minutes: 120,
      duration_minutes: 120,
      no_time_limit: false,
    });
  });
});

describe("hydrateSettings", () => {
  it("hydrates null/undefined to full v2 defaults (never throws)", () => {
    for (const raw of [null, undefined, {}]) {
      const s = hydrateSettings(raw as never);
      expect(s.version).toBe(2);
      expect(s.hero.elements.length).toBeGreaterThan(0);
      expect(s.header).toBeDefined();
      expect(s.booking_config?.buffer_before_minutes).toBe(120);
    }
  });

  it("seeds default content when empty", () => {
    const s = hydrateSettings({});
    expect(s.content.elements.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves existing hero/content instead of reseeding", () => {
    const s = hydrateSettings({
      hero: { background: { type: "color", color: "#111", opacity: 100, intervalMs: 4000 }, elements: [] },
      content: { elements: [{ id: "a", kind: "text", content: "hi", design: DEFAULT_TEXT_DESIGN, x: 0, y: 0, w: 10, h: 10 }] },
    });
    expect(s.content.elements).toHaveLength(1);
  });

  it("migrates legacy experiment blocks", () => {
    const s = hydrateSettings({
      hero: { blocks: [{ id: "b1", kind: "tagline", design: DEFAULT_TEXT_DESIGN, rect: { x: 0, y: 0, w: 10, h: 10 } }] },
    } as never);
    expect(s.hero.elements.length).toBeGreaterThan(0);
  });

  it("moves shape elements behind text (stacking rule)", () => {
    const s = hydrateSettings({
      hero: {
        background: { type: "color", color: "#000", opacity: 100, intervalMs: 4000 },
        elements: [
          { id: "t1", kind: "title", design: DEFAULT_TEXT_DESIGN, x: 0, y: 0, w: 10, h: 10 },
          { id: "s1", kind: "shape", design: DEFAULT_TEXT_DESIGN, x: 0, y: 0, w: 10, h: 10 },
        ],
      },
    } as never);
    expect(s.hero.elements[0].kind).toBe("shape");
  });

  it("remaps removed fonts to loaded ones", () => {
    const s = hydrateSettings({
      hero: {
        background: { type: "color", color: "#000", opacity: 100, intervalMs: 4000 },
        elements: [
          { id: "t1", kind: "title", design: { ...DEFAULT_TEXT_DESIGN, fontFamily: "'Raleway', sans-serif" }, x: 0, y: 0, w: 10, h: 10 },
        ],
      },
    } as never);
    expect(s.hero.elements[0].design.fontFamily).toBe("'Inter', sans-serif");
  });
});

describe("buildDefaultContentElements", () => {
  it("returns empty when no input", () => {
    expect(
      buildDefaultContentElements({
        about_title: null, about_text: null, contact_heading: null,
        location: null, restaurant_photos: [], paragraphs: [],
      })
    ).toEqual([]);
  });

  it("builds about + photos + paragraphs + contact", () => {
    const els = buildDefaultContentElements({
      about_title: "About", about_text: "Great food",
      contact_heading: "Visit", location: "Dubai",
      contact_phone: "123", contact_email: null, contact_address: null,
      restaurant_photos: ["https://x/y.jpg"],
      paragraphs: [{ id: "p1", title: "Story", content: "Once...", image_url: "https://x/z.jpg" }],
    });
    const kinds = els.map((e) => e.kind);
    expect(kinds).toContain("title");
    expect(kinds).toContain("text");
    expect(kinds).toContain("images");
    // y positions strictly increase (stacked layout)
    for (let i = 1; i < els.length; i++) expect(els[i].y).toBeGreaterThan(els[i - 1].y);
  });
});

describe("templates", () => {
  it("buildHeroTemplate returns elements per style", () => {
    expect(buildHeroTemplate("full-image")).toHaveLength(1);
    expect(buildHeroTemplate("text-left")).toHaveLength(3);
    expect(buildHeroTemplate("text-right")).toHaveLength(3);
  });

  it("buildContentTemplate about/location", () => {
    expect(buildContentTemplate("about")).toHaveLength(3);
    const loc = buildContentTemplate("location", { location: "Downtown", contact_phone: "555" });
    expect(loc.map((e) => e.content).join("\n")).toContain("Downtown");
  });
});

describe("deviceForWidth", () => {
  it("maps widths to devices (<640 mobile, <1024 tablet, else desktop)", () => {
    expect(deviceForWidth(0)).toBe("desktop");
    expect(deviceForWidth(-5)).toBe("desktop");
    expect(deviceForWidth(390)).toBe("mobile");
    expect(deviceForWidth(768)).toBe("tablet");
    expect(deviceForWidth(1280)).toBe("desktop");
  });
});

describe("per-device font overrides", () => {
  it("resolveFontSize returns base on desktop or without override", () => {
    expect(resolveFontSize(18, "hero:abc", "desktop", { tablet: { fonts: { "hero:abc": 24 } } })).toBe(18);
    expect(resolveFontSize(18, "hero:abc", "tablet", undefined)).toBe(18);
    expect(resolveFontSize(18, undefined, "tablet", undefined)).toBe(18);
  });

  it("resolveFontSize uses the device override when finite", () => {
    const r = { tablet: { fonts: { "hero:abc": 24 } }, mobile: { fonts: { "hero:abc": 12 } } };
    expect(resolveFontSize(18, "hero:abc", "tablet", r)).toBe(24);
    expect(resolveFontSize(18, "hero:abc", "mobile", r)).toBe(12);
  });

  it("getFontOverride is null on desktop or when inheriting", () => {
    expect(getFontOverride({ tablet: { fonts: { k: 1 } } }, "desktop", "k")).toBeNull();
    expect(getFontOverride(undefined, "tablet", "k")).toBeNull();
    expect(getFontOverride({ tablet: { fonts: { k: 20 } } }, "tablet", "k")).toBe(20);
  });

  it("withFontOverride sets, resets, never mutates, desktop no-op", () => {
    const prev = { tablet: { fonts: { a: 1 } } } as const;
    const set = withFontOverride(prev as never, "tablet", "b", 22);
    expect(set.tablet?.fonts).toEqual({ a: 1, b: 22 });
    expect(prev.tablet.fonts).toEqual({ a: 1 });
    const reset = withFontOverride(set, "tablet", "b", undefined);
    expect(reset.tablet?.fonts).toEqual({ a: 1 });
    // Desktop passes through untouched
    expect(withFontOverride(set, "desktop", "b", 30)).toEqual(set);
    // Non-finite values are never persisted
    expect(withFontOverride(set, "tablet", "b", NaN).tablet?.fonts?.["b"]).toBeUndefined();
  });
});

describe("per-device color overrides", () => {
  it("resolveColor returns base on desktop or without override", () => {
    expect(resolveColor("#fff", "content:abc", "desktop", { tablet: { colors: { "content:abc": "#000" } } })).toBe("#fff");
    expect(resolveColor("#fff", "content:abc", "tablet", undefined)).toBe("#fff");
    expect(resolveColor("#fff", undefined, "tablet", undefined)).toBe("#fff");
  });

  it("resolveColor uses the device override when set", () => {
    const r = { tablet: { colors: { "content:abc": "#111" } }, mobile: { colors: { "content:abc": "#222" } } };
    expect(resolveColor("#fff", "content:abc", "tablet", r)).toBe("#111");
    expect(resolveColor("#fff", "content:abc", "mobile", r)).toBe("#222");
  });

  it("getColorOverride is null on desktop or when inheriting", () => {
    expect(getColorOverride({ tablet: { colors: { k: "#000" } } }, "desktop", "k")).toBeNull();
    expect(getColorOverride(undefined, "tablet", "k")).toBeNull();
    expect(getColorOverride({ tablet: { colors: { k: "#000" } } }, "tablet", "k")).toBe("#000");
  });

  it("withColorOverride sets, resets, never mutates, desktop no-op", () => {
    const prev = { tablet: { colors: { a: "#000" } } } as const;
    const set = withColorOverride(prev as never, "tablet", "b", "#fff");
    expect(set.tablet?.colors).toEqual({ a: "#000", b: "#fff" });
    expect(prev.tablet.colors).toEqual({ a: "#000" });
    const reset = withColorOverride(set, "tablet", "b", undefined);
    expect(reset.tablet?.colors).toEqual({ a: "#000" });
    expect(withColorOverride(set, "desktop", "b", "#fff")).toEqual(set);
  });
});

describe("per-device rect overrides", () => {
  const base = { x: 10, y: 10, w: 50, h: 20 };

  it("resolveRect returns base on desktop or without override", () => {
    expect(resolveRect(base, "hero:a", "desktop", { tablet: { rects: { "hero:a": { x: 0, y: 0, w: 1, h: 1 } } } })).toEqual(base);
    expect(resolveRect(base, "hero:a", "tablet", undefined)).toEqual(base);
  });

  it("resolveRect uses the override off-desktop and copies it", () => {
    const over = { x: 1, y: 2, w: 3, h: 4 };
    const out = resolveRect(base, "hero:a", "mobile", { mobile: { rects: { "hero:a": over } } });
    expect(out).toEqual(over);
    expect(out).not.toBe(over);
  });

  it("getRectOverride is null on desktop or when inheriting", () => {
    expect(getRectOverride({ tablet: { rects: { "hero:a": base } } }, "desktop", "hero:a")).toBeNull();
    expect(getRectOverride(undefined, "tablet", "hero:a")).toBeNull();
    expect(getRectOverride({ tablet: { rects: { "hero:a": base } } }, "tablet", "hero:a")).toEqual(base);
  });

  it("withRectOverride sets, resets, never mutates, desktop no-op, keeps fonts", () => {
    const prev: ResponsiveOverrides = { tablet: { fonts: { "hero:a": 20 }, rects: { "hero:a": base } } };
    const next = withRectOverride(prev, "tablet", "hero:b", { x: 0, y: 0, w: 10, h: 10 });
    expect(next.tablet?.rects?.["hero:b"]).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    expect(next.tablet?.fonts).toEqual({ "hero:a": 20 });
    expect(prev.tablet?.rects?.["hero:b"]).toBeUndefined();
    expect(withRectOverride(next, "desktop", "hero:b", { x: 0, y: 0, w: 1, h: 1 })).toEqual(next);
    const reset = withRectOverride(next, "tablet", "hero:b", undefined);
    expect(reset.tablet?.rects?.["hero:b"]).toBeUndefined();
    expect(reset.tablet?.fonts).toEqual({ "hero:a": 20 });
  });

  it("pruneElementOverrides drops only orphaned hero:/content: keys", () => {
    const prev = {
      tablet: {
        fonts: { "hero:gone": 20, "hero:kept": 21, "menu.title": 30, "content:gone": 10 },
        rects: { "hero:gone": base, "content:kept": base },
      },
    };
    const out = pruneElementOverrides(prev, ["kept"], ["kept"]);
    expect(out?.tablet?.fonts).toEqual({ "hero:kept": 21, "menu.title": 30 });
    expect(out?.tablet?.rects).toEqual({ "content:kept": base });
  });

  it("dropPageFontOverrides clears menu./reserve. keys only", () => {
    const prev = { mobile: { fonts: { "menu.title": 30, "reserve.label": 12, "hero:x": 20 } } };
    expect(dropPageFontOverrides(prev)?.mobile?.fonts).toEqual({ "hero:x": 20 });
    expect(dropPageFontOverrides(undefined)).toBeUndefined();
  });

  it("hydrateSettings preserves valid rect overrides and drops invalid ones", () => {
    const s = hydrateSettings({
      responsive: {
        tablet: { fonts: { "hero:a": 22 }, rects: { "hero:a": { x: 5, y: 5, w: 50, h: 10 } } },
        mobile: { fonts: { bad: "x" }, rects: { broken: { x: 1 } } },
      },
    } as never);
    expect(s.responsive?.tablet?.fonts?.["hero:a"]).toBe(22);
    expect(s.responsive?.tablet?.rects?.["hero:a"]).toEqual({ x: 5, y: 5, w: 50, h: 10 });
    expect(s.responsive?.mobile).toBeUndefined();
  });
});

describe("custom fonts + page shapes hydration", () => {
  it("preserves added custom fonts across loads (navigation-safe)", () => {
    const font = { name: "Sixtyfour", value: "'Sixtyfour', sans-serif", url: "https://example.com/sixtyfour.woff2", weight: 400, css: "@font-face{}" };
    const s = hydrateSettings({ custom_fonts: [font] } as never);
    expect(s.custom_fonts).toEqual([font]);
  });

  it("drops malformed font entries but keeps valid ones", () => {
    const good = { name: "A", value: "'A'", url: "https://x/y.woff2" };
    const s = hydrateSettings({ custom_fonts: [good, null, { name: "NoUrl" }, "x"] } as never);
    expect(s.custom_fonts).toEqual([good]);
  });

  it("absent fonts stay absent", () => {
    expect(hydrateSettings({}).custom_fonts).toBeUndefined();
  });

  it("preserves menu/reserve page shapes", () => {
    const shapes = [{ id: "s1", style: { color: "#fff", borderWidth: 2 } }];
    const s = hydrateSettings({ menu_page_shapes: shapes, reserve_page_shapes: [{ id: "x" }] } as never);
    expect(s.menu_page_shapes).toEqual(shapes);
    expect(s.reserve_page_shapes).toBeUndefined();
  });
});

describe("Phase A marketing toggles", () => {
  it("TextDesign gradient defaults off and survives hydration", () => {
    expect(DEFAULT_TEXT_DESIGN.gradient).toBeUndefined();
    const s = hydrateSettings({
      hero: {
        background: { type: "color", color: "#000", opacity: 100, intervalMs: 4000 },
        elements: [
          { id: "t1", kind: "title", content: "Hi", design: { ...DEFAULT_TEXT_DESIGN, gradient: true }, x: 0, y: 0, w: 10, h: 10 },
        ],
      },
    } as never);
    expect(s.hero.elements[0].design.gradient).toBe(true);
  });

  it("hero glow + scrim default off for old orgs (absent flags)", () => {
    expect(defaultHeroBackground().glow).toBeUndefined();
    expect(defaultHeroBackground().scrim).toBeUndefined();
    // Experiment-block path merges stored background over defaults untouched…
    const migrated = hydrateSettings({
      hero: { blocks: [], background: { type: "color", color: "#111", opacity: 100, intervalMs: 4000 } },
    } as never);
    expect(migrated.hero.background.glow).toBeUndefined();
    expect(migrated.hero.background.scrim).toBeUndefined();
    // …and an explicit opt-in survives the same path.
    const on = hydrateSettings({
      hero: { blocks: [], background: { type: "color", color: "#111", opacity: 100, intervalMs: 4000, glow: true, scrim: true } },
    } as never);
    expect(on.hero.background.glow).toBe(true);
    expect(on.hero.background.scrim).toBe(true);
  });

  it("menu hover_lift defaults true, explicit false survives", () => {
    expect(defaultMenuPageDesign().hover_lift).toBe(true);
    expect(hydrateSettings({}).menu_page?.hover_lift).toBe(true);
    const off = hydrateSettings({ menu_page: { hover_lift: false } } as never);
    expect(off.menu_page?.hover_lift).toBe(false);
  });
});

describe("header CTA opacity + logo size", () => {
  it("defaults CTA opacity to 100 and logo_size to 32", () => {
    const h = defaultHeaderDesign();
    expect(h.cta_design.opacity).toBe(100);
    expect(h.logo_size).toBe(32);
  });

  it("hydrateSettings backfills missing CTA opacity + logo_size", () => {
    const s = hydrateSettings({ header: { design: { ...DEFAULT_TEXT_DESIGN } } } as never);
    expect(s.header.cta_design.opacity).toBe(100);
    expect(s.header.logo_size).toBe(32);
  });

  it("hydrateSettings preserves a user-set CTA opacity and logo_size", () => {
    const s = hydrateSettings({
      header: {
        design: { ...DEFAULT_TEXT_DESIGN },
        logo_size: 48,
        cta_design: { ...defaultHeaderDesign().cta_design, opacity: 55 },
      },
    } as never);
    expect(s.header.cta_design.opacity).toBe(55);
    expect(s.header.logo_size).toBe(48);
  });

  it("hydrateSettings clamps out-of-range CTA opacity to 0..100", () => {
    const hi = hydrateSettings({
      header: { design: { ...DEFAULT_TEXT_DESIGN }, cta_design: { ...defaultHeaderDesign().cta_design, opacity: 250 } },
    } as never);
    expect(hi.header.cta_design.opacity).toBe(100);
    const lo = hydrateSettings({
      header: { design: { ...DEFAULT_TEXT_DESIGN }, cta_design: { ...defaultHeaderDesign().cta_design, opacity: -20 } },
    } as never);
    expect(lo.header.cta_design.opacity).toBe(0);
  });

  it("hydrateSettings keeps legacy pill radius (9999) untouched", () => {
    const s = hydrateSettings({
      header: {
        design: { ...DEFAULT_TEXT_DESIGN },
        cta_design: { ...defaultHeaderDesign().cta_design, borderRadius: 9999 },
      },
    } as never);
    expect(s.header.cta_design.borderRadius).toBe(9999);
  });
});

describe("per-device logo size", () => {
  it("resolveLogoSize returns the base on desktop or without override", () => {
    expect(resolveLogoSize(32, "desktop", { tablet: { fonts: { [LOGO_SIZE_KEY]: 48 } } })).toBe(32);
    expect(resolveLogoSize(32, "tablet", undefined)).toBe(32);
  });

  it("resolveLogoSize uses the device override, clamped 16..96", () => {
    const r: ResponsiveOverrides = { tablet: { fonts: { [LOGO_SIZE_KEY]: 48 } } };
    expect(resolveLogoSize(32, "tablet", r)).toBe(48);
    expect(resolveLogoSize(32, "mobile", { mobile: { fonts: { [LOGO_SIZE_KEY]: 500 } } })).toBe(96);
  });

  it("logo override round-trips through set/get/reset without touching fonts", () => {
    const prev: ResponsiveOverrides = { tablet: { fonts: { "header.brand": 20 } } };
    const set = withLogoSizeOverride(prev, "tablet", 48);
    expect(getLogoSizeOverride(set, "tablet")).toBe(48);
    expect(set.tablet?.fonts?.["header.brand"]).toBe(20);
    expect(getLogoSizeOverride(set, "desktop")).toBeNull();
    const reset = withLogoSizeOverride(set, "tablet", undefined);
    expect(getLogoSizeOverride(reset, "tablet")).toBeNull();
    expect(reset.tablet?.fonts?.["header.brand"]).toBe(20);
  });
});
