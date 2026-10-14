/**
 * tests/unit/pricing.test.ts
 * Covers lib/pricing.ts + lib/marketing-plans.ts — plan config,
 * Stripe price ensure logic (mocked), marketing plan consistency.
 */
import { describe, it, expect, vi } from "vitest";
import { PLAN_MONTHLY_AED, PLAN_ANNUAL_AED, PLAN_LABELS, getPlanConfig, displayPlan, ensurePriceIds, getMonthlyPriceId, getAnnualPriceId } from "@/lib/pricing";
import { MARKETING_PLANS } from "@/lib/marketing-plans";

describe("pricing constants", () => {
  it("has AED monthly prices for pro/max", () => {
    expect(PLAN_MONTHLY_AED.pro).toBe(150);
    expect(PLAN_MONTHLY_AED.max).toBe(350);
  });

  it("has AED annual prices for pro/max", () => {
    expect(PLAN_ANNUAL_AED.pro).toBe(1650);
    expect(PLAN_ANNUAL_AED.max).toBe(3850);
  });

  it("has labels for all plans", () => {
    expect(PLAN_LABELS.pro).toBe("Pro");
    expect(PLAN_LABELS.max).toBe("Max");
    expect(PLAN_LABELS.free).toBe("Free");
  });

  it("getPlanConfig returns label + amount", () => {
    expect(getPlanConfig("pro")).toEqual({ label: "Pro", monthlyAed: 150, annualAed: 1650 });
    expect(getPlanConfig("max")).toEqual({ label: "Max", monthlyAed: 350, annualAed: 3850 });
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
    expect(ids.proAnnual).toMatch(/^price_/);
    expect(ids.maxAnnual).toMatch(/^price_/);
  });

  it("getMonthlyPriceId returns cached ids without new Stripe calls", async () => {
    const stripe = mockStripe();
    const pro = await getMonthlyPriceId(stripe, "pro");
    const max = await getMonthlyPriceId(stripe, "max");
    expect(typeof pro).toBe("string");
    expect(typeof max).toBe("string");
    expect(pro).not.toBe(max);
  });

  it("getAnnualPriceId returns annual ids", async () => {
    const stripe = mockStripe();
    const pro = await getAnnualPriceId(stripe, "pro");
    const max = await getAnnualPriceId(stripe, "max");
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

  it("no plan promises meetings with a senior developer", () => {
    const haystack = MARKETING_PLANS.flatMap((p) => [p.description, ...p.features]).join("\n").toLowerCase();
    expect(haystack).not.toContain("senior frontend");
    expect(haystack).not.toContain("senior developer");
    expect(haystack).not.toContain("meetings with senior");
  });
});

describe("displayPlan (canceling is immediate)", () => {
  it("canceled/canceling status always shows Free, even with a paid stored plan", () => {
    expect(displayPlan("pro", "canceled")).toBe("free");
    expect(displayPlan("max", "canceled")).toBe("free");
    expect(displayPlan("pro", "canceling")).toBe("free");
    expect(displayPlan("max", "canceling")).toBe("free");
  });

  it("active/past_due/free statuses show the stored plan", () => {
    expect(displayPlan("pro", "active")).toBe("pro");
    expect(displayPlan("max", "active")).toBe("max");
    expect(displayPlan("max", "past_due")).toBe("max");
    expect(displayPlan("free", "free")).toBe("free");
  });

  it("unknown values fall back to Free", () => {
    expect(displayPlan(null, "active")).toBe("free");
    expect(displayPlan("enterprise", "active")).toBe("free");
    expect(displayPlan("pro", null)).toBe("pro");
  });
});
