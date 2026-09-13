// ─── Design v2 shared model ───────────────────────────────────────────────────
// All v2 design data lives in organizations.design_settings JSONB.
// Layout is presentation-only (JSONB); long-form text stays in org columns /
// paragraphs table, referenced by elements via `ref`.

export interface TextDesign {
  fontFamily: string;
  fontSize: number;
  color: string;
  textAlign: "left" | "center" | "right";
}

export interface HeaderNavDesign {
  color: string;
  fontFamily: string;
  fontSize: number;
}
export interface HeaderCtaDesign {
  bgColor: string;
  textColor: string;
  borderColor: string;
  fontFamily: string;
  fontSize: number;
  borderRadius: number; // px
  borderWidth: number; // px
}
export type LayerType = "color" | "image" | "images" | "video";
export type HeroElementKind = "logo" | "title" | "tagline" | "text" | "shape" | "image" | "button";
export type ContentElementKind = "title" | "text" | "image" | "images" | "shape" | "button";
export type ButtonType = "book" | "menu";

export interface Rect {
  x: number; // percent of container width
  y: number; // percent of container height
  w: number; // percent of container width
  h: number; // percent of container height
}

export interface ShapeStyle {
  color?: string; // fill for shape blocks
  image_url?: string; // for image blocks
  borderWidth?: number; // px, 0 = no border
  borderColor?: string;
  borderRadius?: number; // percent 0-50, 0 = square, 50 = circle/oval
  opacity?: number; // 0-100
}

export interface HeroBackground {
  type: LayerType;
  color?: string;
  image_url?: string;
  image_urls?: string[];
  video_url?: string;
  opacity: number; // 0-100
  intervalMs: number; // carousel interval, default 4000
  aspectRatio?: number; // width/height of the single background image, filled on upload
}

export interface HeroElement extends Rect, ShapeStyle {
  id: string;
  kind: HeroElementKind;
  ref?: { org: "logo_url" | "name" | "tagline" };
  content?: string; // free text/title
  design: TextDesign;
  buttonType?: ButtonType;
  bgColor?: string;
}

export interface ContentElement extends Rect, ShapeStyle {
  id: string;
  kind: ContentElementKind;
  ref?: { para: string } | { org: "about_title" | "about_text" | "location" | "contact_heading" | "contact_body" | "restaurant_photos" };
  content?: string; // free text/title
  image_urls?: string[];
  design: TextDesign;
  buttonType?: ButtonType;
  bgColor?: string;
}

export interface ChatbotDesign {
  color: string;
  logo_url: string | null;
  text_color: string;
  text_size: number;
  font_family: string;
}

export interface DesignSettingsV2 {
  version: 2;
  // legacy keys stay valid
  background_color: string;
  text_color: string;
  accent_color: string;
  name_design: TextDesign;
  tagline_design: TextDesign;
  about_title_design: TextDesign;
  about_content_design: TextDesign;
  contact_heading_design: TextDesign;
  contact_body_design: TextDesign;
  restaurant_photos?: string[];
  // v2 keys
  header: {
    background_color: string;
    opacity: number; // 0-100, marketing page uses ~90
    design: TextDesign; // brand text / nav text
    logo_color: string;
    nav_design: HeaderNavDesign;
    cta_design: HeaderCtaDesign;
  };
  canvas: {
    hero_rect: { y: number; h: number }; // % of page height
  };
  hero: {
    background: HeroBackground;
    elements: HeroElement[];
  };
  content: {
    elements: ContentElement[];
  };
  chatbot?: ChatbotDesign;
}

// ─── Fonts ────────────────────────────────────────────────────────────────────

export const GOOGLE_FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Roboto:wght@400;700&family=Open+Sans:wght@400;700&family=Montserrat:wght@400;700&family=Poppins:wght@400;700&family=Lato:wght@400;700&family=Playfair+Display:wght@400;700&family=Lora:wght@400;700&family=DM+Sans:wght@400;700&family=Merriweather:wght@400;700&display=swap";

export const GOOGLE_FONTS = [
  { name: "Inter", value: "'Inter', sans-serif" },
  { name: "Roboto", value: "'Roboto', sans-serif" },
  { name: "Open Sans", value: "'Open Sans', sans-serif" },
  { name: "Montserrat", value: "'Montserrat', sans-serif" },
  { name: "Poppins", value: "'Poppins', sans-serif" },
  { name: "Lato", value: "'Lato', sans-serif" },
  { name: "Playfair Display", value: "'Playfair Display', serif" },
  { name: "Lora", value: "'Lora', serif" },
  { name: "DM Sans", value: "'DM Sans', sans-serif" },
  { name: "Merriweather", value: "'Merriweather', serif" },
];

// ─── Defaults ─────────────────────────────────────────────────────────────────

export function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, alpha))})`;
}

export const DEFAULT_TEXT_DESIGN: TextDesign = {
  fontFamily: "Inter",
  fontSize: 18,
  color: "#f5f5f4",
  textAlign: "center",
};

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function clampRect(r: Rect, min = 3, maxY = 100): Rect {
  const w = Math.min(100, Math.max(min, r.w));
  const h = Math.min(100, Math.max(min, r.h));
  return {
    x: Math.min(100 - w, Math.max(0, r.x)),
    y: Math.min(maxY - h, Math.max(0, r.y)),
    w,
    h,
  };
}

export function newHeroElement(kind: HeroElementKind, size: number): HeroElement {
  const base: HeroElement = {
    id: uid(),
    kind,
    design: { ...DEFAULT_TEXT_DESIGN, fontSize: size, color: "#f5f5f4" },
    x: 30,
    y: 10,
    w: 40,
    h: 15,
  };
  if (kind === "shape") {
    base.color = "#1a1a1a";
    base.borderWidth = 0;
    base.borderColor = undefined;
    base.borderRadius = 0;
    base.opacity = 100;
    base.x = 30;
    base.y = 30;
    base.w = 30;
    base.h = 30;
  }
  if (kind === "image") {
    base.opacity = 100;
    base.x = 30;
    base.y = 30;
    base.w = 30;
    base.h = 30;
  }
  if (kind === "button") {
    base.buttonType = "book";
    base.bgColor = "#f97316";
    base.design = { ...DEFAULT_TEXT_DESIGN, fontSize: 16, color: "#ffffff", textAlign: "center" };
    base.x = 30;
    base.y = 60;
    base.w = 25;
    base.h = 8;
  }
  return base;
}

export function newContentElement(kind: ContentElementKind): ContentElement {
  const base: ContentElement = {
    id: uid(),
    kind,
    design: { ...DEFAULT_TEXT_DESIGN, fontSize: kind === "title" ? 28 : 16 },
    x: kind === "images" ? 0 : 10,
    y: 0,
    w: kind === "images" ? 100 : 80,
    h: kind === "title" ? 10 : kind === "images" ? 35 : 15,
  };
  if (kind === "images") base.image_urls = [];
  if (kind === "shape") {
    base.color = "#1a1a1a";
    base.borderWidth = 0;
    base.borderColor = undefined;
    base.borderRadius = 0;
    base.opacity = 100;
    base.w = 30;
    base.h = 30;
  }
  if (kind === "button") {
    base.buttonType = "book";
    base.bgColor = "#f97316";
    base.design = { ...DEFAULT_TEXT_DESIGN, fontSize: 16, color: "#ffffff", textAlign: "center" };
    base.x = 10;
    base.y = 0;
    base.w = 25;
    base.h = 8;
  }
  return base;
}

export function defaultHeaderDesign(): {
  background_color: string;
  opacity: number;
  design: TextDesign;
  logo_color: string;
  nav_design: HeaderNavDesign;
  cta_design: HeaderCtaDesign;
} {
  return {
    background_color: "#0f0f0f",
    opacity: 90,
    design: { ...DEFAULT_TEXT_DESIGN, fontSize: 18, textAlign: "left", color: "#f5f5f4" },
    logo_color: "#f5f5f4",
    nav_design: { color: "#f5f5f4", fontFamily: "Inter", fontSize: 14 },
    cta_design: {
      bgColor: "#f97316",
      textColor: "#ffffff",
      borderColor: "#f97316",
      fontFamily: "Inter",
      fontSize: 14,
      borderRadius: 9999,
      borderWidth: 2,
    },
  };
}

export function defaultHeroBackground(): HeroBackground {
  return {
    type: "color",
    color: "#141414",
    opacity: 100,
    intervalMs: 4000,
  };
}

export function defaultChatbotDesign(): ChatbotDesign {
  return {
    color: "#f97316",
    logo_url: null,
    text_color: "#ffffff",
    text_size: 14,
    font_family: "Inter",
  };
}

// ─── Hydration ────────────────────────────────────────────────────────────────
// Old orgs have no v2 keys — fill them from the legacy settings/columns.
/* eslint-disable @typescript-eslint/no-explicit-any -- legacy JSONB docs are loosely typed by design */

const rectOf = (r: any): Rect => ({
  x: r?.x ?? 10,
  y: r?.y ?? 10,
  w: r?.w ?? 50,
  h: r?.h ?? 20,
});

/** The pre-2.0 experiment stored hero/content "blocks" and top-level page_layers. */
function migrateExperimentBlocks(blocks: any[] | undefined): HeroElement[] | ContentElement[] {
  if (!Array.isArray(blocks)) return [];
  const els: any[] = [];
  for (const b of blocks) {
    const rect = rectOf(b.rect);
    const kind: string = b.kind ?? "text";
    if (kind === "logo" || kind === "name" || kind === "tagline") {
      els.push({
        id: b.id ?? uid(),
        kind: kind === "name" ? "title" : kind,
        ref: { org: kind === "logo" ? "logo_url" : kind === "name" ? "name" : "tagline" },
        design: b.design ?? { ...DEFAULT_TEXT_DESIGN },
        ...rect,
      });
    } else if (kind === "about") {
      els.push(
        { id: `${b.id}-title`, kind: "title", ref: { org: "about_title" }, design: b.designs?.title ?? { ...DEFAULT_TEXT_DESIGN }, ...rect },
        { id: `${b.id}-text`, kind: "text", ref: { org: "about_text" }, design: b.designs?.content ?? { ...DEFAULT_TEXT_DESIGN }, ...rect },
      );
    } else if (kind === "photos") {
      els.push({ id: b.id ?? uid(), kind: "images", ref: { org: "restaurant_photos" }, design: { ...DEFAULT_TEXT_DESIGN }, ...rect });
    } else if (kind === "contact") {
      els.push(
        { id: `${b.id}-heading`, kind: "title", ref: { org: "contact_heading" }, design: b.designs?.heading ?? { ...DEFAULT_TEXT_DESIGN }, ...rect },
        { id: `${b.id}-body`, kind: "text", ref: { org: "contact_body" }, design: b.designs?.body ?? { ...DEFAULT_TEXT_DESIGN }, ...rect },
      );
    } else {
      els.push({ id: b.id ?? uid(), kind: "text", content: b.content ?? "", design: b.designs?.content ?? b.design ?? { ...DEFAULT_TEXT_DESIGN }, ...rect });
    }
  }
  return els;
}

/** A legacy canvas shape / page layer (saved by the short-lived Shapes panel or pre-2.0 page_layers) becomes a hero element. */
function shapeToHeroElement(l: any): HeroElement {
  const flat = l.x !== undefined;
  const r = flat ? { x: l.x, y: l.y, w: l.w, h: l.h } : rectOf(l.rect);
  return {
    id: l.id ?? uid(),
    kind: l.type === "image" || l.type === "images" ? "image" : "shape",
    ...r,
    design: { ...DEFAULT_TEXT_DESIGN },
    opacity: flat ? (l.opacity ?? 100) : l.config?.opacity !== undefined ? Math.round(l.config.opacity * 100) : 100,
    color: l.color ?? (l.type === "color" || l.type === "shape" ? l.config?.color ?? "#1a1a1a" : undefined),
    image_url: flat ? (l.image_url ?? l.image_urls?.[0]) : undefined,
    borderWidth: l.borderWidth ?? 0,
    borderColor: l.borderColor ?? undefined,
    borderRadius: Math.min(50, Math.max(0, Math.round(l.borderRadius ?? 0))),
  };
}

function normalizeHeader(h: any): DesignSettingsV2["header"] {
  const d = defaultHeaderDesign();
  if (!h || typeof h !== "object") return d;
  if (h.design) return { ...d, ...h }; // already the final shape
  // experiment shape: opacity 0..1, brand design under title_design
  return {
    ...d,
    background_color: h.background_color ?? d.background_color,
    opacity: h.opacity !== undefined ? Math.round(h.opacity * 100) : d.opacity,
    design: h.title_design ?? d.design,
    logo_color: h.logo_color ?? d.logo_color,
    nav_design: h.nav_design ?? d.nav_design,
    cta_design: h.cta_design ?? d.cta_design,
  };
}

export function hydrateSettings(raw: Record<string, any> | null | undefined): DesignSettingsV2 {
  const legacy = raw ?? {};
  const name_design = { ...DEFAULT_TEXT_DESIGN, ...(legacy.name_design ?? {}), fontSize: legacy.name_design?.fontSize ?? 48, textAlign: "center" };
  const tagline_design = { ...DEFAULT_TEXT_DESIGN, ...(legacy.tagline_design ?? {}), fontSize: legacy.tagline_design?.fontSize ?? 20, textAlign: "center" };
  const base: DesignSettingsV2 = {
    version: 2,
    background_color: legacy.background_color ?? "#141414",
    text_color: legacy.text_color ?? "#f5f5f4",
    accent_color: legacy.accent_color ?? "#f97316",
    name_design,
    tagline_design,
    about_title_design: { ...DEFAULT_TEXT_DESIGN, ...(legacy.about_title_design ?? {}), fontSize: legacy.about_title_design?.fontSize ?? 30, textAlign: "left" },
    about_content_design: { ...DEFAULT_TEXT_DESIGN, ...(legacy.about_content_design ?? {}), fontSize: legacy.about_content_design?.fontSize ?? 16, textAlign: "left" },
    contact_heading_design: { ...DEFAULT_TEXT_DESIGN, ...(legacy.contact_heading_design ?? {}), fontSize: legacy.contact_heading_design?.fontSize ?? 28, textAlign: "center" },
    contact_body_design: { ...DEFAULT_TEXT_DESIGN, ...(legacy.contact_body_design ?? {}), fontSize: legacy.contact_body_design?.fontSize ?? 15, textAlign: "left" },
    restaurant_photos: legacy.restaurant_photos ?? [],
    header: normalizeHeader(legacy.header),
    canvas: {
      hero_rect: legacy.canvas?.hero_rect ?? { y: 14, h: 55 },
    },
    hero: legacy.hero?.blocks
      ? {
          background: {
            ...defaultHeroBackground(),
            ...(legacy.hero.background ?? {}),
          },
          elements: migrateExperimentBlocks(legacy.hero.blocks) as HeroElement[],
        }
      : legacy.hero
        ? legacy.hero
        : {
      background: {
        ...defaultHeroBackground(),
        color: legacy.background_color ?? "#141414",
      },
      elements: [
        {
          id: uid(),
          kind: "logo",
          ref: { org: "logo_url" },
          design: { ...DEFAULT_TEXT_DESIGN },
          x: 42, y: 4, w: 16, h: 18,
        },
        {
          id: uid(),
          kind: "title",
          ref: { org: "name" },
          design: name_design,
          x: 20, y: 26, w: 60, h: 14,
        },
        {
          id: uid(),
          kind: "tagline",
          ref: { org: "tagline" },
          design: tagline_design,
          x: 25, y: 42, w: 50, h: 9,
        },
      ],
    },
    content: legacy.content?.blocks
      ? { elements: migrateExperimentBlocks(legacy.content.blocks) as ContentElement[] }
      : legacy.content ?? { elements: [] },
    chatbot: legacy.chatbot ?? defaultChatbotDesign(),
  };

  // Legacy page layers / canvas shapes ride along as hero elements
  const legacyShapes = legacy.canvas?.shapes ?? legacy.canvas?.layers ?? legacy.page_layers;
  if (Array.isArray(legacyShapes) && legacyShapes.length > 0) {
    base.hero.elements.push(...legacyShapes.map(shapeToHeroElement));
  }
  // hero background: legacy background image rides along as a default hero image
  if (!legacy.hero) {
    const bgUrl = legacy.background_image_url;
    if (bgUrl) {
      base.hero.elements.push({
        id: uid(),
        kind: "image",
        design: { ...DEFAULT_TEXT_DESIGN },
        x: 0,
        y: 0,
        w: 100,
        h: 100,
        opacity: 35,
        image_url: bgUrl,
      });
    }
  }
  // Stacking rule: shape elements are backgrounds — keep them behind text,
  // images and everything else (stable partition; no-op once already ordered).
  if (base.hero.elements.some((e) => e.kind === "shape")) {
    base.hero.elements = [
      ...base.hero.elements.filter((e) => e.kind === "shape"),
      ...base.hero.elements.filter((e) => e.kind !== "shape"),
    ];
  }
  if (base.content.elements.some((e) => e.kind === "shape")) {
    base.content.elements = [
      ...base.content.elements.filter((e) => e.kind === "shape"),
      ...base.content.elements.filter((e) => e.kind !== "shape"),
    ];
  }
  // Removed fonts: remap saved families to the closest still-loaded one.
  const FONT_REMAP: Record<string, string> = {
    "'Raleway', sans-serif": "'Inter', sans-serif",
    "'Ubuntu', sans-serif": "'Roboto', sans-serif",
    "'Roboto Slab', serif": "'Merriweather', serif",
  };
  (function remapFonts(node: unknown) {
    if (Array.isArray(node)) return node.forEach(remapFonts);
    if (node && typeof node === "object") {
      for (const key of Object.keys(node as Record<string, unknown>)) {
        const v = (node as Record<string, unknown>)[key];
        if (key === "fontFamily" && typeof v === "string" && FONT_REMAP[v]) {
          (node as Record<string, unknown>)[key] = FONT_REMAP[v];
        } else {
          remapFonts(v);
        }
      }
    }
  })(base);
  return base;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Build the default content elements from legacy org columns + paragraphs.
 * Used when an org has no content.elements yet (first visit to the editor).
 */
export function buildDefaultContentElements(input: {
  about_title: string | null;
  about_text: string | null;
  contact_heading: string | null;
  location: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_address?: string | null;
  restaurant_photos: string[];
  paragraphs: { id: string; title: string | null; content: string | null; image_url: string | null }[];
}): ContentElement[] {
  const els: ContentElement[] = [];
  let y = 0;

  const push = (e: Omit<ContentElement, "id">) => {
    els.push({ ...e, id: uid(), x: e.x ?? 10, w: e.w ?? 80, y: y, h: e.h ?? 15 });
    y += (e.h ?? 15) + 4;
  };

  if (input.about_text) {
    push({
      kind: "title",
      ref: { org: "about_title" },
      design: { ...DEFAULT_TEXT_DESIGN, fontSize: 30, textAlign: "left" },
      y, h: 10, x: 10, w: 80,
    });
    push({
      kind: "text",
      ref: { org: "about_text" },
      design: { ...DEFAULT_TEXT_DESIGN, fontSize: 16, textAlign: "left" },
      y, h: 20, x: 10, w: 80,
    });
  }
  if (input.restaurant_photos.length > 0) {
    push({
      kind: "images",
      image_urls: input.restaurant_photos,
      design: { ...DEFAULT_TEXT_DESIGN, fontSize: 16, textAlign: "left" },
      y, h: 30, x: 10, w: 80,
    });
  }
  for (const p of input.paragraphs) {
    if (p.title) {
      push({
        kind: "title",
        ref: { para: p.id },
        design: { ...DEFAULT_TEXT_DESIGN, fontSize: 24, textAlign: "left" },
        y, h: 10, x: 10, w: 80,
      });
    }
    if (p.content) {
      push({
        kind: "text",
        ref: { para: p.id },
        design: { ...DEFAULT_TEXT_DESIGN, fontSize: 16, textAlign: "left" },
        y, h: 15, x: 10, w: 80,
      });
    }
    if (p.image_url) {
      push({
        kind: "image",
        image_urls: [p.image_url],
        design: { ...DEFAULT_TEXT_DESIGN, fontSize: 16, textAlign: "left" },
        y, h: 25, x: 10, w: 80,
      });
    }
  }
  if (input.location) {
    push({
      kind: "text",
      ref: { org: "location" },
      design: { ...DEFAULT_TEXT_DESIGN, fontSize: 15, textAlign: "left" },
      y, h: 15, x: 10, w: 80,
    });
  }
  if (input.contact_heading) {
    push({
      kind: "title",
      ref: { org: "contact_heading" },
      design: { ...DEFAULT_TEXT_DESIGN, fontSize: 28, textAlign: "center" },
      y, h: 10, x: 10, w: 80,
    });
  }
  const contactLines = [
    input.contact_phone ? `Phone: ${input.contact_phone}` : "",
    input.contact_email ? `Email: ${input.contact_email}` : "",
    input.contact_address ? `Address: ${input.contact_address}` : "",
  ].filter(Boolean);
  if (contactLines.length > 0) {
    push({
      kind: "text",
      content: contactLines.join("\n"),
      design: { ...DEFAULT_TEXT_DESIGN, fontSize: 15, textAlign: "left" },
      y, h: 15, x: 10, w: 80,
    });
  }
  return els;
}