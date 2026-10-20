/**
 * scripts/backfill-ai-gallery.mjs
 *
 * One-off backfill for the console Image Gallery (design_settings.ai_gallery).
 * Creation uploads made before this fix (logo / hero / mobile hero / restaurant
 * photos) were never mirrored there, so the Website Edits image picker could
 * not select them.
 *
 * Usage:
 *   node scripts/backfill-ai-gallery.mjs           # dry run
 *   node scripts/backfill-ai-gallery.mjs --apply   # write
 *
 * Loads .env.local when present; otherwise reads the process env.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const MAX = 20;
const supabase = createClient(supabaseUrl, serviceKey);

function normalizeGallery(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  let auto = 0;
  for (const item of raw) {
    if (typeof item === "string" && item.length > 0) {
      auto += 1;
      out.push({ url: item, name: `image-${auto}` });
    } else if (
      item &&
      typeof item === "object" &&
      typeof item.url === "string" &&
      item.url.length > 0
    ) {
      auto += 1;
      out.push({
        url: item.url,
        name:
          typeof item.name === "string" && item.name.trim()
            ? item.name.trim().slice(0, 60)
            : `image-${auto}`,
      });
    }
    if (out.length >= MAX) break;
  }
  return out;
}

function buildSeed(org) {
  // Preserve the existing gallery order and names; append only missing
  // creation assets. A backfill should not reorder or rename a gallery the
  // owner already curated.
  const existing = normalizeGallery(org.design_settings?.ai_gallery);
  const seed = [];
  const add = (url, name) => {
    if (typeof url === "string" && url.trim()) seed.push({ url: url.trim(), name });
  };
  add(org.logo_url, "Logo");
  add(org.background_image_url, "Hero (desktop)");
  add(org.mobile_background_image_url, "Hero (mobile)");
  if (Array.isArray(org.restaurant_photos)) {
    org.restaurant_photos.forEach((url, i) => add(url, `Photo ${i + 1}`));
  }

  const seen = new Set(existing.map((g) => g.url));
  const merged = [...existing];
  for (const item of seed) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    merged.push(item);
  }
  return merged.slice(0, MAX);
}

const { data: orgs, error } = await supabase
  .from("organizations")
  .select(
    "id, slug, logo_url, background_image_url, mobile_background_image_url, restaurant_photos, design_settings",
  )
  .order("created_at", { ascending: true });

if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

let changed = 0;
for (const org of orgs ?? []) {
  const existing = normalizeGallery(org.design_settings?.ai_gallery);
  const next = buildSeed(org);
  const before = JSON.stringify(existing.map((g) => g.url));
  const after = JSON.stringify(next.map((g) => g.url));
  if (before === after) continue;

  changed += 1;
  console.log(
    `${org.slug}: ${existing.length} -> ${next.length} images` +
      (next.length
        ? ` [${next.map((g) => g.name).join(", ")}]`
        : " []"),
  );

  if (!apply) continue;
  const settings = (org.design_settings ?? {}) || {};
  const { error: updateError } = await supabase
    .from("organizations")
    .update({ design_settings: { ...settings, ai_gallery: next } })
    .eq("id", org.id);
  if (updateError) console.error(`  update failed: ${updateError.message}`);
}

console.log(
  apply
    ? `\nBackfilled ${changed} organization(s).`
    : `\nDry run: ${changed} organization(s) would change. Re-run with --apply.`,
);
