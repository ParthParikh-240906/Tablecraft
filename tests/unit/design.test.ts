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
