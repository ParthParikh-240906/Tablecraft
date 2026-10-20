/**
 * tests/edit/finalize-edit.test.ts
 * Edit-apply finalization: DB image sources stay in sync with stored HTML.
 */
import { describe, it, expect } from "vitest";
import { finalizeEditedHtml } from "@/app/api/ai/edit/route";

const BASE = `<!DOCTYPE html><html><body>
<img data-tc-hero="desktop" src="https://x/old-hero.jpg">
<img data-tc-gallery="0" src="https://x/old-g.jpg">
<script>
const HERO_IMAGE_URL = "https://x/old-hero.jpg";
const HERO_IMAGE_URL_MOBILE = "";
const GALLERY_IMAGES = [{src: "https://x/old-g.jpg", caption: "Old"}];
function init() {}
init();
</script>
</body></html>`;

describe("finalizeEditedHtml", () => {
  it("detects and clears a removed hero", () => {
    const next = BASE.replace(
      'const HERO_IMAGE_URL = "https://x/old-hero.jpg";',
      'const HERO_IMAGE_URL = "";',
    );
    const out = finalizeEditedHtml(BASE, next);
    expect(out.heroChanged).toBe(true);
    expect(out.hero).toBe("");
    expect(out.html).not.toContain('src="https://x/old-hero.jpg"');
    expect(out.html).toContain('data-tc-hero="desktop"');
  });

  it("detects a replaced hero and returns the new URL for the org row", () => {
    const next = BASE.replace(
      'const HERO_IMAGE_URL = "https://x/old-hero.jpg";',
      'const HERO_IMAGE_URL = "https://x/new-hero.jpg";',
    );
    const out = finalizeEditedHtml(BASE, next);
    expect(out.heroChanged).toBe(true);
    expect(out.hero).toBe("https://x/new-hero.jpg");
  });

  it("detects gallery changes and clears static tiles when emptied", () => {
    const next = BASE.replace(
      'const GALLERY_IMAGES = [{src: "https://x/old-g.jpg", caption: "Old"}];',
      "const GALLERY_IMAGES = [];",
    );
    const out = finalizeEditedHtml(BASE, next);
    expect(out.galleryChanged).toBe(true);
    expect(out.gallery).toEqual([]);
    expect(out.html).not.toContain('src="https://x/old-g.jpg"');
    expect(out.html).toContain('data-tc-gallery="0"');
  });

  it("is a no-op for unrelated edits", () => {
    const next = BASE.replace("<body>", "<body><p>New copy</p>");
    const out = finalizeEditedHtml(BASE, next);
    expect(out.heroChanged).toBe(false);
    expect(out.mobileHeroChanged).toBe(false);
    expect(out.galleryChanged).toBe(false);
    expect(out.html).toContain("New copy");
  });
});
