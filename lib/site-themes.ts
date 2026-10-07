// ─── One-click full-page site themes (feature #11) ────────────────────────────
// Data + apply logic. A separate step builds the picker UI on top of:
//   SITE_THEMES    — the 4 pickable themes (id/name/blurb/swatches for cards)
//   getTheme(id)   — look up one theme (falls back to the first, never throws)
//   applySiteTheme — recolor/retype a DesignSettingsV2 with the theme applied
//
// A theme NEVER rebuilds layout or touches copy: hero/content elements keep
// their ids, positions, sizes, text, refs, and photos — only their colors and
// font families change. Menu/reserve/chatbot/header/page palettes are fully
// replaced (those screens have no user-authored layout to preserve).
//
// Theme-controlled (overwritten): page bg/text/accent, legacy text designs
// (recolored + retyped, sizes kept), header colors/fonts/CTA shape, hero +
// content element colors/fonts, full menu_page + reserve_page palettes,
// chatbot color/text/font.
// Preserved (never touched): everything else — element ids/positions/sizes,
// text content + refs, media URLs + background media type, hero_rect,
// custom_fonts, booking_config, header_elements, logo borders, chatbot logo,
// and hero/content/header/chatbot per-device sizes (menu/reserve per-device
// sizes are dropped with their replaced bases).

import { defaultChatbotDesign, dropPageFontOverrides } from "@/lib/design";
import type {
  ContentElement,
  DesignSettingsV2,
  HeroElement,
  MenuPageDesign,
  ReservePageDesign,
} from "@/lib/design";

export interface SiteTheme {
  id: string;
  name: string;
  blurb: string;
  swatches: [string, string, string];
}

interface ThemeSpec {
  id: string;
  name: string;
  blurb: string;
  swatches: [string, string, string];
  site: {
    background: string;
    text: string;
    accent: string;
    headingFont: string;
    bodyFont: string;
  };
  header: {
    background: string;
    brandColor: string;
    navColor: string;
    ctaBg: string;
    ctaText: string;
    ctaRadius: number;
  };
  hero: {
    background: string;
    titleColor: string;
    bodyColor: string;
    buttonBg: string;
    buttonText: string;
  };
  content: {
    titleColor: string;
    bodyColor: string;
  };
  menu: MenuPageDesign;
  reserve: ReservePageDesign;
  chatbot: { color: string; textColor: string; fontFamily: string };
}

const THEME_SPECS: ThemeSpec[] = [
  {
    id: "warm-bistro",
    name: "Warm Bistro",
    blurb:
      "Espresso + cream with burnt-orange accents and classic serif headings — cozy neighborhood bistro.",
    swatches: ["#211712", "#FAF3E8", "#C2410C"],
    site: {
      background: "#211712",
      text: "#FAF3E8",
      accent: "#C2410C",
      headingFont: "Playfair Display",
      bodyFont: "Inter",
    },
    header: {
      background: "#211712",
      brandColor: "#FAF3E8",
      navColor: "#E7DCC8",
      ctaBg: "#C2410C",
      ctaText: "#FFF7ED",
      ctaRadius: 9999,
    },
    hero: {
      background: "#211712",
      titleColor: "#FAF3E8",
      bodyColor: "#E7DCC8",
      buttonBg: "#C2410C",
      buttonText: "#FFF7ED",
    },
    content: {
      titleColor: "#FAF3E8",
      bodyColor: "#E7DCC8",
    },
    menu: {
      title_design: { fontFamily: "Playfair Display", fontSize: 30, color: "#FAF3E8", textAlign: "left" },
      subtitle_design: { fontFamily: "Inter", fontSize: 14, color: "#CBB79E", textAlign: "left" },
      category_design: { fontFamily: "Inter", fontSize: 14, color: "#E07B39", textAlign: "left" },
      item_name_design: { fontFamily: "Inter", fontSize: 16, color: "#FAF3E8", textAlign: "left" },
      item_price_design: { fontFamily: "Inter", fontSize: 16, color: "#FAF3E8", textAlign: "right" },
      item_description_design: { fontFamily: "Inter", fontSize: 13, color: "#CBB79E", textAlign: "left" },
      border_color: "#44403C",
      border_width: 1,
      back_button_color: "#FAF3E8",
    },
    reserve: {
      title_design: { fontFamily: "Playfair Display", fontSize: 30, color: "#FAF3E8", textAlign: "left" },
      subtitle_design: { fontFamily: "Inter", fontSize: 14, color: "#CBB79E", textAlign: "left" },
      label_design: { fontFamily: "Inter", fontSize: 12, color: "#E7DCC8", textAlign: "left" },
      button_design: { fontFamily: "Inter", fontSize: 15, color: "#FFF7ED", textAlign: "center" },
      input_bg_color: "#2A1D16",
      input_text_color: "#FAF3E8",
      input_border_color: "#57534E",
      border_color: "#44403C",
      border_width: 1,
      back_button_color: "#FAF3E8",
    },
    chatbot: { color: "#C2410C", textColor: "#FFFFFF", fontFamily: "Inter" },
  },
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    blurb:
      "Near-white canvas, ink type and hairline dividers — airy, gallery-like minimalism.",
    swatches: ["#FAFAF9", "#18181B", "#E4E4E7"],
    site: {
      background: "#FAFAF9",
      text: "#18181B",
      accent: "#18181B",
      headingFont: "Space Grotesk",
      bodyFont: "Inter",
    },
    header: {
      background: "#FAFAF9",
      brandColor: "#18181B",
      navColor: "#52525B",
      ctaBg: "#18181B",
      ctaText: "#FFFFFF",
      ctaRadius: 8,
    },
    hero: {
      background: "#FAFAF9",
      titleColor: "#18181B",
      bodyColor: "#52525B",
      buttonBg: "#18181B",
      buttonText: "#FFFFFF",
    },
    content: {
      titleColor: "#18181B",
      bodyColor: "#3F3F46",
    },
    menu: {
      title_design: { fontFamily: "Space Grotesk", fontSize: 30, color: "#18181B", textAlign: "left" },
      subtitle_design: { fontFamily: "Inter", fontSize: 14, color: "#71717A", textAlign: "left" },
      category_design: { fontFamily: "JetBrains Mono", fontSize: 13, color: "#18181B", textAlign: "left" },
      item_name_design: { fontFamily: "Inter", fontSize: 16, color: "#18181B", textAlign: "left" },
      item_price_design: { fontFamily: "Inter", fontSize: 16, color: "#18181B", textAlign: "right" },
      item_description_design: { fontFamily: "Inter", fontSize: 13, color: "#71717A", textAlign: "left" },
      border_color: "#E4E4E7",
      border_width: 1,
      back_button_color: "#18181B",
    },
    reserve: {
      title_design: { fontFamily: "Space Grotesk", fontSize: 30, color: "#18181B", textAlign: "left" },
      subtitle_design: { fontFamily: "Inter", fontSize: 14, color: "#71717A", textAlign: "left" },
      label_design: { fontFamily: "Inter", fontSize: 12, color: "#3F3F46", textAlign: "left" },
      button_design: { fontFamily: "Inter", fontSize: 15, color: "#FFFFFF", textAlign: "center" },
      input_bg_color: "#FFFFFF",
      input_text_color: "#18181B",
      input_border_color: "#D4D4D8",
      border_color: "#E4E4E7",
      border_width: 1,
      back_button_color: "#18181B",
    },
    chatbot: { color: "#18181B", textColor: "#FFFFFF", fontFamily: "Inter" },
  },
  {
    id: "smokehouse-bold",
    name: "Smokehouse Bold",
    blurb:
      "Near-black smoke, oversized display type and an amber-red ember accent — loud and proud.",
    swatches: ["#0C0A09", "#FAFAF9", "#DC2626"],
    site: {
      background: "#0C0A09",
      text: "#FAFAF9",
      accent: "#DC2626",
      headingFont: "Calistoga",
      bodyFont: "Space Grotesk",
    },
    header: {
      background: "#0C0A09",
      brandColor: "#FAFAF9",
      navColor: "#D6D3D1",
      ctaBg: "#DC2626",
      ctaText: "#FFFFFF",
      ctaRadius: 4,
    },
    hero: {
      background: "#0C0A09",
      titleColor: "#FAFAF9",
      bodyColor: "#D6D3D1",
      buttonBg: "#DC2626",
      buttonText: "#FFFFFF",
    },
    content: {
      titleColor: "#FAFAF9",
      bodyColor: "#D6D3D1",
    },
    menu: {
      title_design: { fontFamily: "Calistoga", fontSize: 32, color: "#FAFAF9", textAlign: "left" },
      subtitle_design: { fontFamily: "Space Grotesk", fontSize: 14, color: "#A8A29E", textAlign: "left" },
      category_design: { fontFamily: "Calistoga", fontSize: 16, color: "#F87171", textAlign: "left" },
      item_name_design: { fontFamily: "Space Grotesk", fontSize: 16, color: "#FAFAF9", textAlign: "left" },
      item_price_design: { fontFamily: "Space Grotesk", fontSize: 16, color: "#FAFAF9", textAlign: "right" },
      item_description_design: { fontFamily: "Space Grotesk", fontSize: 13, color: "#A8A29E", textAlign: "left" },
      border_color: "#292524",
      border_width: 1,
      back_button_color: "#FAFAF9",
    },
    reserve: {
      title_design: { fontFamily: "Calistoga", fontSize: 30, color: "#FAFAF9", textAlign: "left" },
      subtitle_design: { fontFamily: "Space Grotesk", fontSize: 14, color: "#A8A29E", textAlign: "left" },
      label_design: { fontFamily: "Space Grotesk", fontSize: 12, color: "#D6D3D1", textAlign: "left" },
      button_design: { fontFamily: "Space Grotesk", fontSize: 15, color: "#FFFFFF", textAlign: "center" },
      input_bg_color: "#1C1917",
      input_text_color: "#FAFAF9",
      input_border_color: "#44403C",
      border_color: "#292524",
      border_width: 1,
      back_button_color: "#FAFAF9",
    },
    chatbot: { color: "#DC2626", textColor: "#FFFFFF", fontFamily: "Space Grotesk" },
  },
  {
    id: "coastal-cafe",
    name: "Coastal Café",
    blurb:
      "Warm sand, sea-teal accents and soft rounded shapes — friendly brunch-by-the-water energy.",
    swatches: ["#FAF5E9", "#0E7C7B", "#134E4A"],
    site: {
      background: "#FAF5E9",
      text: "#134E4A",
      accent: "#0E7C7B",
      headingFont: "Instrument Serif",
      bodyFont: "Manrope",
    },
    header: {
      background: "#FAF5E9",
      brandColor: "#134E4A",
      navColor: "#35605C",
      ctaBg: "#0E7C7B",
      ctaText: "#FFFFFF",
      ctaRadius: 9999,
    },
    hero: {
      background: "#FAF5E9",
      titleColor: "#134E4A",
      bodyColor: "#3F6360",
      buttonBg: "#0E7C7B",
      buttonText: "#FFFFFF",
    },
    content: {
      titleColor: "#134E4A",
      bodyColor: "#35605C",
    },
    menu: {
      title_design: { fontFamily: "Instrument Serif", fontSize: 30, color: "#134E4A", textAlign: "left" },
      subtitle_design: { fontFamily: "Manrope", fontSize: 14, color: "#7A8B89", textAlign: "left" },
      category_design: { fontFamily: "Manrope", fontSize: 14, color: "#0E7C7B", textAlign: "left" },
      item_name_design: { fontFamily: "Manrope", fontSize: 16, color: "#134E4A", textAlign: "left" },
      item_price_design: { fontFamily: "Manrope", fontSize: 16, color: "#134E4A", textAlign: "right" },
      item_description_design: { fontFamily: "Manrope", fontSize: 13, color: "#6B7F7D", textAlign: "left" },
      border_color: "#E7DCC3",
      border_width: 1,
      back_button_color: "#0E7C7B",
    },
    reserve: {
      title_design: { fontFamily: "Instrument Serif", fontSize: 30, color: "#134E4A", textAlign: "left" },
      subtitle_design: { fontFamily: "Manrope", fontSize: 14, color: "#7A8B89", textAlign: "left" },
      label_design: { fontFamily: "Manrope", fontSize: 12, color: "#35605C", textAlign: "left" },
      button_design: { fontFamily: "Manrope", fontSize: 15, color: "#FFFFFF", textAlign: "center" },
      input_bg_color: "#FFFFFF",
      input_text_color: "#134E4A",
      input_border_color: "#E0D5B8",
      border_color: "#E7DCC3",
      border_width: 1,
      back_button_color: "#0E7C7B",
    },
    chatbot: { color: "#0E7C7B", textColor: "#FFFFFF", fontFamily: "Manrope" },
  },
];

export const SITE_THEMES: SiteTheme[] = THEME_SPECS.map((s): SiteTheme => ({
  id: s.id,
  name: s.name,
  blurb: s.blurb,
  swatches: s.swatches,
}));

function specFor(themeId: string): ThemeSpec {
  const found = THEME_SPECS.find((s) => s.id === themeId);
  if (found) return found;
  const fallback = THEME_SPECS[0];
  if (!fallback) throw new Error("SITE_THEMES is empty");
  return fallback;
}

export function getTheme(id: string): SiteTheme {
  const spec = specFor(id);
  return { id: spec.id, name: spec.name, blurb: spec.blurb, swatches: spec.swatches };
}

/**
 * Recolor the user's EXISTING hero elements in place. Ids, positions, sizes,
 * text, refs, and photos are untouched — only colors and font families change
 * to the theme's palette. Shapes keep their custom colors.
 */
function themeHeroElements(spec: ThemeSpec, prevElements: HeroElement[]): HeroElement[] {
  return prevElements.map((el): HeroElement => {
    if (el.kind === "title" || el.kind === "logo") {
      return {
        ...el,
        design: {
          ...el.design,
          fontFamily: spec.site.headingFont,
          color: spec.hero.titleColor,
        },
      };
    }
    if (el.kind === "tagline" || el.kind === "text") {
      return {
        ...el,
        design: { ...el.design, fontFamily: spec.site.bodyFont, color: spec.hero.bodyColor },
      };
    }
    if (el.kind === "button") {
      return {
        ...el,
        bgColor: spec.hero.buttonBg,
        design: {
          ...el.design,
          fontFamily: spec.site.bodyFont,
          color: spec.hero.buttonText,
        },
      };
    }
    return el;
  });
}

/**
 * Recolor the user's EXISTING content elements in place (same contract as
 * themeHeroElements — layout and copy are preserved, images keep flowing
 * through their own slots).
 */
function themeContentElements(spec: ThemeSpec, prevElements: ContentElement[]): ContentElement[] {
  return prevElements.map((el): ContentElement => {
    if (el.kind === "title") {
      return {
        ...el,
        design: { ...el.design, fontFamily: spec.site.headingFont, color: spec.content.titleColor },
      };
    }
    if (el.kind === "text") {
      return {
        ...el,
        design: { ...el.design, fontFamily: spec.site.bodyFont, color: spec.content.bodyColor },
      };
    }
    if (el.kind === "button") {
      return {
        ...el,
        bgColor: spec.hero.buttonBg,
        design: { ...el.design, fontFamily: spec.site.bodyFont, color: spec.hero.buttonText },
      };
    }
    return el;
  });
}

/**
 * Apply a site theme to existing settings. Returns a NEW object — `prev` is
 * never mutated. Unknown theme ids fall back to the first theme.
 */
function cloneMenu(m: MenuPageDesign): MenuPageDesign {
  return {
    ...m,
    title_design: { ...m.title_design },
    subtitle_design: { ...m.subtitle_design },
    category_design: { ...m.category_design },
    item_name_design: { ...m.item_name_design },
    item_price_design: { ...m.item_price_design },
    item_description_design: { ...m.item_description_design },
  };
}

function cloneReserve(r: ReservePageDesign): ReservePageDesign {
  return {
    ...r,
    title_design: { ...r.title_design },
    subtitle_design: { ...r.subtitle_design },
    label_design: { ...r.label_design },
    button_design: { ...r.button_design },
  };
}

/**
 * Apply a site theme to existing settings. Returns a NEW object — `prev` is
 * never mutated. Unknown theme ids fall back to the first theme. Layout and
 * copy are preserved; only colors and font families change.
 */
export function applySiteTheme(
  prev: DesignSettingsV2,
  themeId: string,
): DesignSettingsV2 {
  const spec = specFor(themeId);
  const prevBot = prev.chatbot ?? defaultChatbotDesign();

  return {
    ...prev,
    background_color: spec.site.background,
    text_color: spec.site.text,
    accent_color: spec.site.accent,
    name_design: { ...prev.name_design, fontFamily: spec.site.headingFont, color: spec.site.text },
    tagline_design: {
      ...prev.tagline_design,
      fontFamily: spec.site.bodyFont,
      color: spec.hero.bodyColor,
    },
    about_title_design: {
      ...prev.about_title_design,
      fontFamily: spec.site.headingFont,
      color: spec.content.titleColor,
    },
    about_content_design: {
      ...prev.about_content_design,
      fontFamily: spec.site.bodyFont,
      color: spec.content.bodyColor,
    },
    contact_heading_design: {
      ...prev.contact_heading_design,
      fontFamily: spec.site.headingFont,
      color: spec.content.titleColor,
    },
    contact_body_design: {
      ...prev.contact_body_design,
      fontFamily: spec.site.bodyFont,
      color: spec.content.bodyColor,
    },
    header: {
      ...prev.header,
      background_color: spec.header.background,
      design: { ...prev.header.design, fontFamily: spec.site.headingFont, color: spec.header.brandColor },
      logo_color: spec.header.brandColor,
      nav_design: {
        ...prev.header.nav_design,
        color: spec.header.navColor,
        fontFamily: spec.site.bodyFont,
      },
      cta_design: {
        ...prev.header.cta_design,
        bgColor: spec.header.ctaBg,
        textColor: spec.header.ctaText,
        borderColor: spec.header.ctaBg,
        fontFamily: spec.site.bodyFont,
        borderRadius: spec.header.ctaRadius,
      },
    },
    hero: {
      ...prev.hero,
      // Keep the user's media type/URLs/opacity — only the fallback color is themed.
      background: { ...prev.hero.background, color: spec.hero.background },
      elements: themeHeroElements(spec, prev.hero.elements),
    },
    content: {
      ...prev.content,
      elements: themeContentElements(spec, prev.content.elements),
    },
    chatbot: {
      ...prevBot,
      color: spec.chatbot.color,
      text_color: spec.chatbot.textColor,
      font_family: spec.chatbot.fontFamily,
      logo_url: prevBot.logo_url,
    },
    menu_page: cloneMenu(spec.menu),
    reserve_page: cloneReserve(spec.reserve),
    // menu/reserve bases are replaced wholesale — surviving per-device sizes
    // for those keys would look like random changes when toggling devices.
    responsive: dropPageFontOverrides(prev.responsive),
  };
}
