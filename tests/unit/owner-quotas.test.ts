/**
 * tests/unit/owner-quotas.test.ts
 * Covers lib/owner-quotas.ts — new per-owner monthly quotas + lifetime create.
 */
import { describe, it, expect } from "vitest";
import {
  OWNER_QUOTAS,
  getOwnerQuotaLimit,
  resolveOwnerPlan,
  checkRestaurantCreateAllowed,
  peekOwnerQuota,
} from "@/lib/owner-quotas";

describe("OWNER_QUOTAS values (user-specified)", () => {
  it("free tier matches spec", () => {
    expect(OWNER_QUOTAS.free).toEqual({
      chatbot: 50,
      menu_scanner: 20,
      restaurant_create: 1,
      edit: 3,
      image: 10,
    });
  });

  it("pro tier matches spec", () => {
    expect(OWNER_QUOTAS.pro).toEqual({
      chatbot: 300,
      menu_scanner: 60,
      restaurant_create: 5,
      edit: 30,
      image: 100,
    });
  });

  it("max tier matches spec", () => {
    expect(OWNER_QUOTAS.max).toEqual({
      chatbot: 1000,
      menu_scanner: 140,
      restaurant_create: 20,
      edit: 100,
      image: 300,
    });
  });
});

describe("resolveOwnerPlan (highest tier wins)", () => {
  it("returns max if any owned org is max", () => {
    expect(resolveOwnerPlan(["free", "pro", "max"])).toBe("max");
  });
  it("returns pro if any pro and no max", () => {
    expect(resolveOwnerPlan(["free", "pro"])).toBe("pro");
  });
  it("defaults to free", () => {
    expect(resolveOwnerPlan([])).toBe("free");
    expect(resolveOwnerPlan([null, undefined, "free"])).toBe("free");
  });
  it("canceled orgs contribute free (parity with displayPlan quota fix)", async () => {
    const { displayPlan } = await import("@/lib/pricing");
    // apex-cafe/malabar-bites shape: raw paid plan + canceled status → free pool.
    expect(resolveOwnerPlan([displayPlan("max", "canceled"), displayPlan("pro", "canceled")])).toBe("free");
    expect(resolveOwnerPlan([displayPlan("max", "active"), displayPlan("free", "canceled")])).toBe("max");
  });
});

describe("restaurant_create lifetime gate", () => {
  it("free allows 1, blocks 2nd", () => {
    expect(checkRestaurantCreateAllowed(0, "free").allowed).toBe(true);
    expect(checkRestaurantCreateAllowed(1, "free").allowed).toBe(false);
  });
  it("pro allows 5, max allows 20", () => {
    expect(checkRestaurantCreateAllowed(4, "pro").allowed).toBe(true);
    expect(checkRestaurantCreateAllowed(5, "pro").allowed).toBe(false);
    expect(checkRestaurantCreateAllowed(19, "max").allowed).toBe(true);
    expect(checkRestaurantCreateAllowed(20, "max").allowed).toBe(false);
  });
});

describe("peekOwnerQuota", () => {
  it("returns spec limits for fresh owner", () => {
    const owner = `test-owner-${Date.now()}-${Math.random()}`;
    expect(peekOwnerQuota(owner, "free", "chatbot").limit).toBe(50);
    expect(peekOwnerQuota(owner, "pro", "image").limit).toBe(100);
    expect(peekOwnerQuota(owner, "max", "edit").limit).toBe(100);
    expect(getOwnerQuotaLimit("free", "menu_scanner")).toBe(20);
  });
});
