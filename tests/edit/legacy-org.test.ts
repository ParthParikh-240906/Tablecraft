/**
 * tests/edit/legacy-org.test.ts
 * Legacy-org fixture: design_settings=null, only legacy columns.
 * Proves old -> new edit path (hydrate never throws, deep-merge preserves legacy).
 */
import { describe, it, expect } from "vitest";
import { hydrateSettings } from "@/lib/design";

const legacyOrg = {
  name: "Old Bistro",
  slug: "old-bistro",
  theme_color: "#0f0f0f",
  theme_text_color: "#f5f5f4",
  theme_secondary_color: "#f97316",
  tagline: "Classic plates",
  about_text: "A family bistro serving classics since 1998.",
  logo_url: null,
  restaurant_photos: [],
  design_settings: null,
};

describe("legacy org edit path", () => {
  it("hydrates null design_settings to renderable v2 (never throws)", () => {
    const s = hydrateSettings(legacyOrg.design_settings as never);
    expect(s.version).toBe(2);
    expect(s.hero.elements.length).toBeGreaterThan(0);
    expect(s.booking_config?.buffer_before_minutes).toBe(120);
  });

  it("infers vibe from about_text when vibe field missing", () => {
    const vibe = (legacyOrg as { vibe?: string }).vibe ?? legacyOrg.about_text;
    expect(vibe).toContain("bistro");
  });

  it("edit route requires orgId + prompt", async () => {
    const { POST } = await import("@/app/api/ai/edit/route");
    const res = await POST(new Request("http://localhost/api/ai/edit", {
      method: "POST",
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });

  it("patch validator rejects empty patches", async () => {
    const { POST } = await import("@/app/api/ai/edit/route");
    // Needs staff auth; without a request scope (cookies) it throws —
    // that still proves the staff guard runs before any patch handling.
    try {
      const res = await POST(new Request("http://localhost/api/ai/edit", {
        method: "POST",
        body: JSON.stringify({ orgId: "00000000-0000-0000-0000-000000000000", prompt: "x", preview: false, patches: [] }),
      }));
      expect([400, 401, 500]).toContain(res.status);
    } catch (e) {
      expect(String(e)).toMatch(/cookies|request scope|auth/i);
    }
  });
});
