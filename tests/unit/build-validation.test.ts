/**
 * tests/unit/build-validation.test.ts
 * Structural validation for AI-built standalone sites.
 */
import { describe, it, expect } from "vitest";
import {
  extractInlineScripts,
  validateBuiltHtml,
  validateSiteWiring,
} from "@/lib/build-validation";

function makeHtml(body = "") {
  return `<!DOCTYPE html>
<html><head><title>Test</title></head>
<body>
${body}
<script>
const ORG_SLUG = "test-org";
const MENU_ITEMS = [{ "name": "Dish", "price": 10, "category": "Mains", "description": "x" }];
const HERO_IMAGE_URL = "";
const HERO_IMAGE_URL_MOBILE = "";
const GALLERY_IMAGES = [];
const CART_SETTINGS = { mode: "pickup" };
function submitBooking() {}
function submitCartCheckout() {}
function sendChatMessage() {}
function init() { submitBooking(); submitCartCheckout(); sendChatMessage(); }
init();
</script>
</body></html>`;
}

describe("validateBuiltHtml", () => {
  it("accepts a complete document with all required declarations", () => {
    const result = validateBuiltHtml(makeHtml(), { requireBootCall: true });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("rejects a truncated document (the /murlidhar failure)", () => {
    const truncated = makeHtml().slice(0, 220);
    const result = validateBuiltHtml(truncated);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("missing complete");
  });

  it("rejects an unclosed script even when body/html exist", () => {
    const html = `<!DOCTYPE html><html><body><script>const ORG_SLUG = "x";`;
    const result = validateBuiltHtml(html);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("unbalanced script");
  });

  it("rejects a script syntax error", () => {
    const html = makeHtml().replace("function init()", "function init( {");
    const result = validateBuiltHtml(html);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("script syntax");
  });

  it("requires the init() boot call for new builds", () => {
    const html = makeHtml().replace("init();", "");
    const result = validateBuiltHtml(html, { requireBootCall: true });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("init()");
  });

  it("requires static hero markers when a hero URL is provided", () => {
    const result = validateBuiltHtml(makeHtml(), {
      heroUrl: "https://x/hero.jpg",
      heroMobileUrl: "https://x/mobile.jpg",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("data-tc-hero");
  });

  it("accepts static hero markers", () => {
    const html = makeHtml(
      '<section class="hero"><img data-tc-hero="desktop" src="https://x/hero.jpg"><img data-tc-hero="mobile" src="https://x/mobile.jpg"></section>',
    );
    const result = validateBuiltHtml(html, {
      heroUrl: "https://x/hero.jpg",
      heroMobileUrl: "https://x/mobile.jpg",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects bare-string GALLERY_IMAGES for new builds", () => {
    const html = makeHtml().replace(
      "const GALLERY_IMAGES = [];",
      'const GALLERY_IMAGES = ["https://x/a.jpg"];',
    );
    const result = validateBuiltHtml(html, { requireGalleryObjects: true });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("objects");
  });

  it("rejects forbidden endpoints and ORG_SLUG mismatches", () => {
    const html = makeHtml().replace(
      "function init()",
      'fetch("/api/menu-manager"); function init()',
    );
    const result = validateBuiltHtml(html, { orgSlug: "other-org" });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("forbidden endpoint");
    expect(result.errors.join(" ")).toContain("ORG_SLUG mismatch");
  });
});

describe("extractInlineScripts", () => {
  it("skips external scripts and JSON-LD", () => {
    const html = `
      <script src="/app.js"></script>
      <script type="application/ld+json">{"a":1}</script>
      <script>console.log("ok")</script>`;
    expect(extractInlineScripts(html)).toEqual(['console.log("ok")']);
  });
});

describe("validateSiteWiring", () => {
  it("passes a fully wired page", () => {
    const html = makeHtml().replace(
      "function sendChatMessage() {}",
      "function sendChatMessage() { fetch('/api/chat/bookings') }",
    );
    // The helper requires the literal endpoints in the page.
    const wired = html
      .replace("function submitBooking() {}", "function submitBooking() { fetch('/api/bookings') }")
      .replace(
        "function submitCartCheckout() {}",
        "function submitCartCheckout() { fetch('/api/cart/checkout') }",
      );
    const result = validateSiteWiring(wired, "test-org");
    expect(result.ok).toBe(true);
  });

  it("flags missing endpoints/functions and forbidden URLs", () => {
    const html = makeHtml().replace(
      "const ORG_SLUG",
      "fetch('/api/booking-actions'); const ORG_SLUG",
    );
    const result = validateSiteWiring(html, "test-org");
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toContain("/api/chat/bookings");
    expect(result.issues.join(" ")).toContain("forbidden endpoint");
  });
});
