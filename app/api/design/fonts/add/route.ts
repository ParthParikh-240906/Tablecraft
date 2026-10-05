import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Self-host a Google Font weight (GDPR: no visitor IP ever hits Google).
 *
 * POST { family: string, weight: number }
 *  - validates family+weight against fonts.googleapis.com (same rules as the
 *    console: HTTP 400 = unknown, proxy `/l/font` payload = non-Google name)
 *  - downloads every woff2 subset, uploads to the public `org-custom-fonts`
 *    bucket under a deterministic global path (deduped across orgs via upsert)
 *  - returns a custom_fonts entry whose `css` holds rewritten @font-face rules
 *
 * Responses:
 *  200 { ok, font } | 400 invalid input | 404 { code: "not_found" } |
 *  404 { code: "weight_unavailable", family } | 502 { code: "unreachable" }
 */

const BUCKET = "org-custom-fonts";
// A current Chrome UA so Google returns split woff2 subsets (not legacy ttf).
const GOOGLE_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const VALID_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const MAX_FILES = 25;
const MAX_FILE_BYTES = 2_000_000;

const normalizeFamily = (raw: string) => raw.trim().replace(/\s+/g, " ");
const familyKey = (family: string) => normalizeFamily(family).toLowerCase();
const slugify = (family: string) =>
  familyKey(family).replace(/ /g, "-").replace(/[^a-z0-9-]/g, "") || "font";
const titleCaseFamily = (family: string) =>
  family
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");

const cssUrl = (family: string, weight?: number) =>
  `https://fonts.googleapis.com/css2?family=${normalizeFamily(family).replace(/ /g, "+")}${weight ? `:wght@${weight}` : ""}&display=swap`;

/** Fetch CSS text. Returns null on HTTP error; throws on network failure. */
async function fetchCss(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": GOOGLE_UA },
    });
    if (!res.ok) return null;
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Null unless `css` is a REAL Google font payload for `candidate`:
 * rejects proxy `/l/font` responses (plausible non-Google names like Calibri)
 * and requires the echoed family to match. Returns the canonical family name.
 */
function canonicalFamily(css: string | null, candidate: string): string | null {
  if (!css || css.includes("/l/font")) return null;
  const m = css.match(/font-family: '([^']+)'/);
  return m && familyKey(m[1]) === familyKey(candidate) ? m[1] : null;
}

export async function POST(req: Request) {
  let body: { family?: unknown; weight?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const family = typeof body.family === "string" ? normalizeFamily(body.family) : "";
  const weight = typeof body.weight === "number" ? body.weight : parseInt(String(body.weight), 10);
  if (!family) return NextResponse.json({ error: "Missing family" }, { status: 400 });
  if (!VALID_WEIGHTS.includes(weight)) {
    return NextResponse.json({ error: "Invalid weight" }, { status: 400 });
  }

  const candidates = [...new Set([family, titleCaseFamily(family)])];
  const admin = createAdminClient();

  try {
    let matched: { canonical: string; css: string } | null = null;
    for (const candidate of candidates) {
      const css = await fetchCss(cssUrl(candidate, weight));
      const canonical = canonicalFamily(css, candidate);
      if (canonical && css) {
        matched = { canonical, css };
        break;
      }
    }

    if (!matched) {
      // Family-only probe: distinguishes "no such font" from "weight missing".
      let familyCanonical: string | null = null;
      for (const candidate of candidates) {
        const canonical = canonicalFamily(await fetchCss(cssUrl(candidate)), candidate);
        if (canonical) {
          familyCanonical = canonical;
          break;
        }
      }
      if (familyCanonical) {
        return NextResponse.json(
          { code: "weight_unavailable", family: familyCanonical },
          { status: 404 },
        );
      }
      return NextResponse.json({ code: "not_found" }, { status: 404 });
    }

    // Split the CSS into @font-face blocks (keeping `/* subset */` labels).
    const labeled = [
      ...matched.css.matchAll(/\/\*\s*([a-z0-9-]+)\s*\*\/\s*(@font-face\s*{[^}]*})/g),
    ];
    const blocks: { subset: string; block: string }[] =
      labeled.length > 0
        ? labeled.map((m, i) => ({ subset: m[1], block: m[2] || m[0] }))
        : [...matched.css.matchAll(/@font-face\s*{[^}]*}/g)].map((m, i) => ({
            subset: `subset-${i}`,
            block: m[0],
          }));

    if (blocks.length === 0 || blocks.length > MAX_FILES) {
      return NextResponse.json({ error: "Unexpected font payload" }, { status: 502 });
    }

    const slug = slugify(matched.canonical);
    let css = matched.css;
    const uploaded: string[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const src = blocks[i].block.match(/url\((https:[^)]+)\)/);
      if (!src) continue;
      const gstaticUrl = src[1];
      const fileRes = await fetch(gstaticUrl, {
        headers: { "User-Agent": GOOGLE_UA },
      });
      if (!fileRes.ok) {
        return NextResponse.json({ error: "Font download failed" }, { status: 502 });
      }
      const buf = Buffer.from(await fileRes.arrayBuffer());
      if (buf.length === 0 || buf.length > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "Unexpected font file size" }, { status: 502 });
      }
      const subset = blocks[i].subset.replace(/[^a-z0-9-]/g, "") || `subset-${i}`;
      const path = `google/${slug}/${weight}/${subset}.woff2`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, buf, {
          contentType: "font/woff2",
          cacheControl: "31536000",
          upsert: true,
        });
      if (uploadError) {
        console.error("font upload:", uploadError);
        return NextResponse.json({ error: "Font storage failed" }, { status: 500 });
      }
      const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = data.publicUrl;
      uploaded.push(publicUrl);
      css = css.split(gstaticUrl).join(publicUrl);
    }

    if (uploaded.length === 0) {
      return NextResponse.json({ error: "No font files found" }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      font: {
        name: matched.canonical,
        value: `'${matched.canonical}', sans-serif`,
        url: uploaded[0],
        weight,
        css,
      },
    });
  } catch (e) {
    console.error("fonts/add:", e);
    return NextResponse.json({ code: "unreachable" }, { status: 502 });
  }
}
