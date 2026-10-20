/**
 * lib/gallery.ts — shared helpers for the console's named image gallery
 * (`design_settings.ai_gallery`).
 *
 * The console Image Gallery and the Website Edits image picker both read
 * `ai_gallery`. Creation uploads used to seed it from restaurant photos only,
 * which left hero/mobile-hero uploads invisible. These helpers build a merged,
 * deduped seed from all creation assets.
 */

import { normalizeGallery, type GalleryImage } from "@/lib/design";

export const MAX_AI_GALLERY_ITEMS = 20;

export type AiGallerySeedInput = {
  logoUrl?: string | null;
  heroUrl?: string | null;
  heroMobileUrl?: string | null;
  photos?: string[] | null;
  existing?: unknown;
  max?: number;
};

/**
 * Build the named gallery list for an org:
 *   Logo -> Hero (desktop) -> Hero (mobile) -> Photo 1..N -> existing entries.
 * Deduped by URL (first name wins) and capped at `max`.
 */
export function buildAiGallerySeed({
  logoUrl,
  heroUrl,
  heroMobileUrl,
  photos,
  existing,
  max = MAX_AI_GALLERY_ITEMS,
}: AiGallerySeedInput): GalleryImage[] {
  const seed: GalleryImage[] = [];

  const add = (url: string | null | undefined, name: string) => {
    if (typeof url !== "string" || url.trim().length === 0) return;
    seed.push({ url: url.trim(), name });
  };

  add(logoUrl, "Logo");
  add(heroUrl, "Hero (desktop)");
  add(heroMobileUrl, "Hero (mobile)");
  (photos ?? []).forEach((url, i) => add(url, `Photo ${i + 1}`));

  const seen = new Set<string>();
  return [...seed, ...normalizeGallery(existing, max)]
    .filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .slice(0, max);
}
