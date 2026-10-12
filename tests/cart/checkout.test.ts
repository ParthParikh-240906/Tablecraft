/**
 * tests/cart/checkout.test.ts
 * Guest cart checkout: validation, cart_config enforcement, Connect gating.
 */
import { describe, it, expect } from "vitest";
import { normalizeCartConfig, defaultCartConfig } from "@/lib/design";

describe("cart_config defaults", () => {
  it("defaults to pickup-only", () => {
    expect(defaultCartConfig()).toEqual({
      mode: "pickup",
      delivery_enabled: false,
      delivery_fee: 0,
      min_order: 0,
    });
  });

  it("normalizeCartConfig forces pickup when delivery disabled", () => {
    expect(normalizeCartConfig({ mode: "delivery", delivery_enabled: false })).toMatchObject({
      mode: "pickup",
      delivery_enabled: false,
    });
  });

  it("keeps delivery mode + fees when enabled", () => {
    expect(
      normalizeCartConfig({ mode: "delivery", delivery_enabled: true, delivery_fee: 15, min_order: 50 }),
    ).toEqual({ mode: "delivery", delivery_enabled: true, delivery_fee: 15, min_order: 50 });
  });

  it("sanitizes garbage to defaults (never throws)", () => {
    for (const raw of [null, undefined, "pickup", [], { delivery_fee: -5, min_order: NaN }]) {
      expect(normalizeCartConfig(raw)).toEqual(defaultCartConfig());
    }
  });
});

describe("POST /api/cart/checkout validation", () => {
  it("400 on invalid body", async () => {
    const { POST } = await import("@/app/api/cart/checkout/route");
    const res = await POST(new Request("http://localhost/api/cart/checkout", {
      method: "POST",
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });

  it("400 on empty cart", async () => {
    const { POST } = await import("@/app/api/cart/checkout/route");
    const res = await POST(new Request("http://localhost/api/cart/checkout", {
      method: "POST",
      body: JSON.stringify({ orgSlug: "x", items: [], customerName: "Jane" }),
    }));
    expect(res.status).toBe(400);
  });

  it("400 without customer name", async () => {
    const { POST } = await import("@/app/api/cart/checkout/route");
    const res = await POST(new Request("http://localhost/api/cart/checkout", {
      method: "POST",
      body: JSON.stringify({ orgSlug: "x", items: [{ id: "y", quantity: 1 }] }),
    }));
    expect(res.status).toBe(400);
  });
});

describe("connect routes validation", () => {
  it("connect/start 400 without orgSlug", async () => {
    const { POST } = await import("@/app/api/stripe/connect/start/route");
    const res = await POST(new Request("http://localhost/api/stripe/connect/start", {
      method: "POST",
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });

  it("connect/status 400 without orgSlug", async () => {
    const { GET } = await import("@/app/api/stripe/connect/status/route");
    const res = await GET(new Request("http://localhost/api/stripe/connect/status"));
    expect(res.status).toBe(400);
  });
});
