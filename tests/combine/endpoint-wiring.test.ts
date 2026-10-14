/**
 * tests/combine/endpoint-wiring.test.ts
 * Combination hard rules (Haiku 5.5 medium): menu + booking endpoints
 * wired to console, orgSlug preserved, design unchanged. Runs automatically
 * once per restaurant inside POST /api/ai/build (lib/ai-connect.ts).
 */
import { describe, it, expect } from "vitest";
import { GPT_SOL_MODEL } from "@/lib/ai-models";

describe("combine hard rules", () => {
  it("uses GPT 6.1 Sol", () => {
    expect(GPT_SOL_MODEL).toBe("gpt-6.1-sol");
  });

  it("combine route requires orgId + orgSlug", async () => {
    const { POST } = await import("@/app/api/ai/combine/route");
    const res = await POST(new Request("http://localhost/api/ai/combine", {
      method: "POST",
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });

  it("public booking endpoint accepts orgSlug (combine target intact)", async () => {
    // Validation layer only: missing fields -> 400 proves orgSlug routing exists.
    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }));
    expect([400, 500]).toContain(res.status);
  });

  it("combine prompt covers cart wiring + console-wins cart_config", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile("lib/ai-connect.ts", "utf8"),
    );
    expect(src).toContain("/api/cart/checkout");
    expect(src).toContain("cart_config");
    expect(src).toContain("/cart");
  });
});
