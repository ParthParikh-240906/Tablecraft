/**
 * tests/create/gallery-seed.test.ts
 * Console image gallery seed: hero/mobile/logo/photos must all be present.
 */
import { describe, it, expect } from "vitest";
import { buildAiGallerySeed } from "@/lib/gallery";

describe("buildAiGallerySeed", () => {
  it("seeds logo, hero, mobile hero, and photos in order", () => {
    const seed = buildAiGallerySeed({
      logoUrl: "https://x/logo.png",
      heroUrl: "https://x/hero.png",
      heroMobileUrl: "https://x/mobile.png",
      photos: ["https://x/p1.jpg", "https://x/p2.jpg"],
    });
    expect(seed.map((g) => g.name)).toEqual([
      "Logo",
      "Hero (desktop)",
      "Hero (mobile)",
      "Photo 1",
      "Photo 2",
    ]);
  });

  it("dedupes by URL (first name wins)", () => {
    const seed = buildAiGallerySeed({
      heroUrl: "https://x/same.png",
      heroMobileUrl: "https://x/same.png",
      photos: ["https://x/same.png"],
    });
    expect(seed).toHaveLength(1);
    expect(seed[0]?.name).toBe("Hero (desktop)");
  });

  it("keeps existing gallery entries without duplicating new uploads", () => {
    const seed = buildAiGallerySeed({
      heroUrl: "https://x/hero.png",
      existing: [
        { url: "https://x/generated.png", name: "generated-1" },
        { url: "https://x/hero.png", name: "Hero (desktop)" },
      ],
    });
    expect(seed.map((g) => g.url)).toEqual([
      "https://x/hero.png",
      "https://x/generated.png",
    ]);
    expect(seed[1]?.name).toBe("generated-1");
  });

  it("caps at 20 and ignores empty values", () => {
    const photos = Array.from({ length: 30 }, (_, i) => `https://x/${i}.jpg`);
    const seed = buildAiGallerySeed({
      heroUrl: "",
      heroMobileUrl: null,
      photos,
      max: 20,
    });
    expect(seed).toHaveLength(20);
    expect(seed[0]?.name).toBe("Photo 1");
  });
});
