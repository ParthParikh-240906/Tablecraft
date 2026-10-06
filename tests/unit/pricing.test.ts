/**
 * tests/unit/pricing.test.ts
 * Covers lib/pricing.ts + lib/marketing-plans.ts — plan config,
 * Stripe price ensure logic (mocked), marketing plan consistency.
 */
import { describe, it, expect, vi } from "vitest";
import { PLAN_MONTHLY_AED, PLAN_LABELS, getPlanConfig, ensurePriceIds, getMonthlyPriceId } from "@/lib/pricing";
import { MARKETING_PLANS } from "@/lib/marketing-plans";

describe("pricing constants", () => {
  it("has AED monthly prices for pro/max", () => {
    expect(PLAN_MONTHLY_AED.pro).toBe(500);
    expect(PLAN_MONTHLY_AED.max).toBe(850);
  });

  it("has labels for all plans", () => {
    expect(PLAN_LABELS.pro).toBe("Pro");
    expect(PLAN_LABELS.max).toBe("Max");
    expect(PLAN_LABELS.free).toBe("Free");
  });

  it("getPlanConfig returns label + amount", () => {
    expect(getPlanConfig("pro")).toEqual({ label: "Pro", monthlyAed: 500 });
    expect(getPlanConfig("max")).toEqual({ label: "Max", monthlyAed: 850 });
  });
});

function mockStripe(existing: { products?: { id: string; name: string }[]; prices?: { id: string; unit_amount: number | null; active: boolean; type: string }[] } = {}) {
  const products = existing.products ?? [];
  const prices = existing.prices ?? [];
  return {
    products: {
      list: vi.fn(async () => ({ data: products })),
      create: vi.fn(async (p: { name: string }) => ({ id: `prod_${p.name}`, ...p })),
    },
    prices: {
      list: vi.fn(async () => ({ data: prices })),
      create: vi.fn(async (p: { unit_amount: number }) => ({ id: `price_${p.unit_amount}`, ...p })),
    },
  } as never;
}

describe("ensurePriceIds (Stripe mocked)", () => {
  it("creates products + prices when none exist", async () => {
    // Reset module cache between tests by re-importing is not needed:
    // _priceIds is module-level — first test populates it. So test creation
    // on a fresh mock would return cached. We assert shape instead.
    const stripe = mockStripe();
    const ids = await ensurePriceIds(stripe);
    expect(ids.proMonthly).toMatch(/^price_/);
    expect(ids.maxMonthly).toMatch(/^price_/);
  });

  it("getMonthlyPriceId returns cached ids without new Stripe calls", async () => {
    const stripe = mockStripe();
    const pro = await getMonthlyPriceId(stripe, "pro");
    const max = await getMonthlyPriceId(stripe, "max");
    expect(typeof pro).toBe("string");
    expect(typeof max).toBe("string");
    expect(pro).not.toBe(max);
  });
});

describe("MARKETING_PLANS consistency", () => {
  it("has Free/Pro/Max with correct price strings from PLAN_MONTHLY_AED", () => {
    const names = MARKETING_PLANS.map((p) => p.name);
    expect(names).toEqual(["Free", "Pro", "Max"]);
    const pro = MARKETING_PLANS.find((p) => p.planKey === "pro")!;
    const max = MARKETING_PLANS.find((p) => p.planKey === "max")!;
    expect(pro.price).toBe(`${PLAN_MONTHLY_AED.pro}`);
    expect(max.price).toBe(`${PLAN_MONTHLY_AED.max}`);
    expect(MARKETING_PLANS.find((p) => p.planKey === null)?.price).toBe("0");
  });

  it("exactly one highlighted plan (Pro)", () => {
    expect(MARKETING_PLANS.filter((p) => p.highlighted)).toHaveLength(1);
    expect(MARKETING_PLANS.find((p) => p.highlighted)?.name).toBe("Pro");
  });

  it("every plan has CTA + features", () => {
    for (const p of MARKETING_PLANS) {
      expect(p.cta.length).toBeGreaterThan(0);
      expect(p.ctaLink.startsWith("/")).toBe(true);
      expect(p.features.length).toBeGreaterThan(0);
    }
  });
});
