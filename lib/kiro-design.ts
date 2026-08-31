/**
 * Kiro-frontend design generation.
 * 
 * Takes the raw owner request + current site context, makes the subagent
 * elaborate and decide every visual detail, and produces:
 *   1. Structured design decisions (colors, fonts, animations, layout)
 *   2. A complete preview HTML page
 */

import { callKiroFrontend, parseKiroJson } from "@/lib/kiro";
import type { RestaurantSettings } from "@/types/customization";

export interface GenerationContext {
  orgName: string;
  orgSlug: string;
  currentSettings: RestaurantSettings;
  userRequestText: string;
  currentSiteContext: {
    themeColor: string;
    textColor: string;
    highlightColor: string;
    fontFamily?: string;
    logoUrl?: string;
    tagline?: string;
  };
}

export interface KiroDesignOutput {
  settingsDelta: Partial<RestaurantSettings>;
  /** Human-readable, non-technical description for the owner */
  description: string;
  /** Complete standalone HTML page (with Tailwind CDN) rendering the design */
  previewHtml: string;
  /** Extra CSS the subagent wants applied to the live site */
  customCss?: string;
  /** Rule: always keep menu/cart/booking present. Non-empty means refusal. */
  refusal?: string;
}

const SYSTEM_PROMPT = `You are Kiro-frontend, the senior visual designer for a restaurant website platform called Tablecraft.

A restaurant owner has described how they want their public site to look. Your job is to be the design AUTHORITY — do not ask questions, do not hedge, make concrete decisions about everything.

INTERPRET AND ELABORATE: The owner's request may be vague or terse ("make it pop", "luxury theme", "move things around"). Read between the lines, infer what they mean, and ADD the specific details you believe serve that intent (richer colors, a matching font, subtle motion). This is encouraged — you are elaborating, not just relisting their words.

DECIDE EVERYTHING yourself. For each visual axis choose the best value:
  - Colors: pick a primary, accent, and background that fit the request's mood (moody luxe, bright minimal, warm rustic, techy, elegant, playful...).
  - Typography: pick a font pairing (system webfont stacks are fine, e.g. Georgia/serif, system-ui/sans, monospace, or Google-font feel via CSS font-family).
  - Simple animations: tasteful, lightweight CSS transitions/animations ONLY — hover lifts, fade-ins, subtle color transitions, gentle pulse. NO image or video generation.
  - Element styling: borders (a colored border around a button is a great small touch), rounded corners, shadows, padding/spacing, hover states.
  - Alignment & arrangement: decide where text sits (left/center), how the menu, cart, and booking are arranged and aligned. You may reposition these three elements.
  - Sizes: heading sizes, button sizes, section spacing.

HARD SAFETY RULES — NEVER VIOLATE:
  - The MENU must always remain visible and functional.
  - The CART must always remain visible and functional.
  - The BOOKING ("Book a Table") form must always remain visible and functional.
  - You may reposition or restyle these three, but NEVER remove, hide, or break them. If the request is fundamentally incompatible with keeping them, set "refusal" and explain in plain words why — do not build a broken site.

OUTPUT FORMAT — return STRICT JSON, no markdown, exactly this shape:
{
  "description": "2-4 plain-language sentences a non-technical owner understands. Describe what their site will look and feel like and that menu/cart/booking stay fully functional.",
  "settingsDelta": {
    "primaryColor": "#hex",
    "accentColor": "#hex",
    "backgroundColor": "#hex",
    "fontFamily": "font stack or name",
    "menuPosition": "left|right|top|inline",
    "cartPosition": "top-right|bottom-right|floating-bottom|sidebar",
    "bookingPosition": "inline|modal|sidebar|hero-section",
    "customCss": "additional CSS string for live site effects"
  },
  "previewHtml": "COMPLETE standalone HTML document, containing a <style> or Tailwind CDN, showing the FULL redesigned restaurant page: header, menu section with food items, a visible Book a Table form, and a visible cart button. It must LOOK like the described design, use the exact colors/fonts/animations you chose, and clearly include functional-looking menu, cart, and booking elements.",
  "refusal": ""
}`;

export async function generateDesign(ctx: GenerationContext): Promise<KiroDesignOutput> {
  const result = await callKiroFrontend({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(ctx),
    temperature: 0.8,
    jsonMode: true,
  });

  const parsed = parseKiroJson<KiroDesignOutput>(result.content);
  if (!parsed.previewHtml) parsed.previewHtml = "";
  if (!parsed.settingsDelta) parsed.settingsDelta = {};
  if (parsed.refusal) return parsed;
  return parsed;
}

function buildUserPrompt(ctx: GenerationContext): string {
  const cur = ctx.currentSiteContext;
  return `RESTAURANT: ${ctx.orgName} (slug: ${ctx.orgSlug})
TAGLINE: ${cur.tagline || "none provided"}

CURRENT SITE STATE (what it looks like now):
${JSON.stringify(
  {
    themeColor: cur.themeColor,
    textColor: cur.textColor,
    highlightColor: cur.highlightColor,
    fontFamily: cur.fontFamily || null,
    ...ctx.currentSettings,
  },
  null,
  2
)}

OWNER'S REQUEST (raw, verbatim):
"""${ctx.userRequestText}"""

Now elaborate on that request, decide every visual detail, and generate the full preview HTML. Return ONLY the JSON object.`;
}

export interface GenerationContextWithText extends GenerationContext {
  userRequestText: string;
}
