/**
 * lib/build-validation.ts
 *
 * Structural validation for AI-built standalone sites. The build model can
 * return a non-empty string that is still unusable (truncated mid-script,
 * unbalanced tags, missing boot call). Saving that output produces a page
 * where every control is dead, so validation must run before persistence.
 *
 * `new Function` only COMPILES the script; it never executes it. This catches
 * the exact class of failure that hit the creative template: a response cut
 * off inside a function.
 */

export type BuiltHtmlValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type BuiltHtmlValidationOptions = {
  /** Require the static desktop hero image marker. */
  heroUrl?: string | null;
  /** Require the static mobile hero image marker. */
  heroMobileUrl?: string | null;
  /** Require static gallery tiles when gallery images exist. */
  galleryUrls?: string[];
  /** New builds must call init() explicitly at the end of the script. */
  requireBootCall?: boolean;
  /** New builds must declare HERO_IMAGE_URL_MOBILE (legacy sites may not). */
  requireMobileHeroConst?: boolean;
  /** New builds use GALLERY_IMAGES = [{src, caption}], never bare strings. */
  requireGalleryObjects?: boolean;
  /** Verify the built ORG_SLUG matches the requested slug. */
  orgSlug?: string;
};

export type SiteWiringValidation = {
  ok: boolean;
  issues: string[];
};

const FORBIDDEN_ENDPOINTS = [
  "/api/booking-actions",
  "/api/menu-manager",
  "/api/design-settings",
];

const REQUIRED_CONSTS = [
  "ORG_SLUG",
  "MENU_ITEMS",
  "HERO_IMAGE_URL",
  "GALLERY_IMAGES",
  "CART_SETTINGS",
];

/**
 * Extract inline classic scripts, skipping external scripts and non-JS
 * script types (JSON-LD, templates).
 */
export function extractInlineScripts(html: string): string[] {
  const scripts: string[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const attrs = match[1] ?? "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    if (
      /\btype\s*=\s*["'](?:application\/(?:ld\+)?json|text\/template|text\/plain)["']/i.test(
        attrs,
      )
    ) {
      continue;
    }
    // Module scripts cannot be compiled with new Function. They are allowed
    // (the prompt asks for classic scripts), but syntax-check what we can.
    if (/\btype\s*=\s*["']module["']/i.test(attrs)) continue;
    scripts.push(match[2]);
  }
  return scripts;
}

function scriptTagCounts(html: string): { opens: number; closes: number } {
  return {
    opens: (html.match(/<script(?=[\s>])/gi) ?? []).length,
    closes: (html.match(/<\/script\s*>/gi) ?? []).length,
  };
}

function extractConstBody(html: string, name: string): string | null {
  const re = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*([\\s\\S]*?);`, "m");
  const match = html.match(re);
  return match ? match[1] : null;
}

function galleryLooksLikeObjects(body: string): boolean {
  return /\bsrc\s*:/.test(body) || /["']src["']\s*:/.test(body);
}



function hasBootCall(html: string): boolean {
  // New builds call init(); at the end. Accept boot/start aliases so a valid
  // page is not rejected purely on a name difference.
  return /\b(?:init|boot|start)\s*\(\s*\)\s*;/.test(html);
}

/** Validate document completeness + required data/wiring declarations. */
export function validateBuiltHtml(
  html: string,
  opts: BuiltHtmlValidationOptions = {},
): BuiltHtmlValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!html || html.trim().length === 0) {
    return { ok: false, errors: ["empty output"], warnings };
  }

  if (!/^\s*<!doctype html/i.test(html)) {
    warnings.push("missing <!DOCTYPE html>");
  }
  if (!/<html\b/i.test(html) || !/<\/html\s*>/i.test(html)) {
    errors.push("missing complete <html>...</html>");
  }
  if (!/<body\b/i.test(html) || !/<\/body\s*>/i.test(html)) {
    errors.push("missing complete <body>...</body>");
  }

  const { opens, closes } = scriptTagCounts(html);
  if (opens !== closes) {
    errors.push(`unbalanced script tags: ${opens} open / ${closes} close`);
  }

  if (opens === closes) {
    for (const script of extractInlineScripts(html)) {
      try {
        // Compile only. Never execute AI output in the server process.
        new Function(script);
      } catch (e) {
        errors.push(`script syntax error: ${(e as Error).message}`);
        break;
      }
    }
  }

  for (const name of REQUIRED_CONSTS) {
    if (!new RegExp(`(?:const|let|var)\\s+${name}\\b`).test(html)) {
      errors.push(`missing ${name} declaration`);
    }
  }
  if (
    opts.requireMobileHeroConst &&
    !/(?:const|let|var)\s+HERO_IMAGE_URL_MOBILE\b/.test(html)
  ) {
    errors.push("missing HERO_IMAGE_URL_MOBILE declaration");
  }

  if (opts.requireBootCall && !hasBootCall(html)) {
    errors.push("missing init() boot call");
  }

  const galleryBody = extractConstBody(html, "GALLERY_IMAGES");
  if (galleryBody && opts.requireGalleryObjects) {
    const trimmed = galleryBody.trim();
    if (trimmed !== "" && trimmed !== "[]" && !galleryLooksLikeObjects(galleryBody)) {
      errors.push("GALLERY_IMAGES must be [{src, caption}] objects, not bare strings");
    }
  }

  const heroImg = (marker: "desktop" | "mobile") =>
    new RegExp(
      `<img\\b[^>]*\\bdata-tc-hero\\s*=\\s*["']${marker}["'][^>]*>`,
      "i",
    ).test(html);

  if (opts.heroUrl && !heroImg("desktop")) {
    errors.push("hero URL provided but no static <img data-tc-hero=\"desktop\">");
  }
  if (opts.heroMobileUrl && !heroImg("mobile")) {
    errors.push("mobile hero URL provided but no static <img data-tc-hero=\"mobile\">");
  }
  if (
    (opts.galleryUrls?.length ?? 0) > 0 &&
    !/<img\b[^>]*\bdata-tc-gallery\s*=/i.test(html)
  ) {
    errors.push("gallery images provided but no static <img data-tc-gallery> tiles");
  }

  if (opts.orgSlug) {
    const match = html.match(
      /(?:const|let|var)\s+ORG_SLUG\s*=\s*["']([^"']*)["']/,
    );
    if (!match) {
      errors.push("ORG_SLUG is not a plain string literal");
    } else if (match[1] !== opts.orgSlug) {
      errors.push(`ORG_SLUG mismatch: expected ${opts.orgSlug}, got ${match[1]}`);
    }
  }

  for (const endpoint of FORBIDDEN_ENDPOINTS) {
    if (html.includes(endpoint)) errors.push(`forbidden endpoint: ${endpoint}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Deterministic wiring checks. When these pass, the full-document AI combine
 * pass can be skipped (it is the riskiest full-output call in the pipeline).
 */
export function validateSiteWiring(
  html: string,
  orgSlug: string,
): SiteWiringValidation {
  const issues: string[] = [];

  const orgMatch = html.match(
    /(?:const|let|var)\s+ORG_SLUG\s*=\s*["']([^"']*)["']/,
  );
  if (!orgMatch) {
    issues.push("ORG_SLUG declaration missing or not a plain string literal");
  } else if (orgMatch[1] !== orgSlug) {
    issues.push(`ORG_SLUG mismatch: expected ${orgSlug}, got ${orgMatch[1]}`);
  }

  for (const endpoint of [
    "/api/bookings",
    "/api/cart/checkout",
    "/api/chat/bookings",
  ]) {
    if (!html.includes(endpoint)) issues.push(`missing wiring endpoint: ${endpoint}`);
  }

  for (const fn of ["submitBooking", "submitCartCheckout", "sendChatMessage"]) {
    if (!new RegExp(`\\b${fn}\\b`).test(html)) {
      issues.push(`missing ${fn}()`);
    }
  }

  if (!/\bMENU_ITEMS\b/.test(html)) issues.push("missing MENU_ITEMS");
  if (!/\bGALLERY_IMAGES\b/.test(html)) issues.push("missing GALLERY_IMAGES");
  if (!/\bHERO_IMAGE_URL\b/.test(html)) issues.push("missing HERO_IMAGE_URL");
  if (!/\bHERO_IMAGE_URL_MOBILE\b/.test(html)) {
    issues.push("missing HERO_IMAGE_URL_MOBILE");
  }

  for (const endpoint of FORBIDDEN_ENDPOINTS) {
    if (html.includes(endpoint)) issues.push(`forbidden endpoint: ${endpoint}`);
  }

  return { ok: issues.length === 0, issues };
}
