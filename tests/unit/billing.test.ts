/**
 * tests/unit/billing.test.ts
 * Owner-wide billing helpers (lib/billing.ts): the fix for
 * "upgraded to Max but still shows Free + per-restaurant selector".
 */
import { describe, it, expect, vi } from "vitest";
import {
  applySubscriptionToOwnerOrgs,
  computeOwnerPlan,
  inferPlanFromSubscription,
  inferPlanFromUnitAmount,
  toDbPlan,
  toDbStatus,
} from "@/lib/billing";
import { PLAN_ANNUAL_AED, PLAN_MONTHLY_AED } from "@/lib/pricing";

describe("inferPlanFromUnitAmount", () => {
  it("matches monthly + annual AED amounts", () => {
    expect(inferPlanFromUnitAmount(PLAN_MONTHLY_AED.pro * 100, "aed")).toBe("pro");
    expect(inferPlanFromUnitAmount(PLAN_ANNUAL_AED.pro * 100, "AED")).toBe("pro");
    expect(inferPlanFromUnitAmount(PLAN_MONTHLY_AED.max * 100, "aed")).toBe("max");
    expect(inferPlanFromUnitAmount(PLAN_ANNUAL_AED.max * 100, "aed")).toBe("max");
  });
  it("rejects unknown amounts / currencies / empty", () => {
    expect(inferPlanFromUnitAmount(999 * 100, "aed")).toBeNull();
    expect(inferPlanFromUnitAmount(PLAN_MONTHLY_AED.pro * 100, "usd")).toBeNull();
    expect(inferPlanFromUnitAmount(null)).toBeNull();
  });
});

describe("inferPlanFromSubscription", () => {
  it("prefers metadata.plan", () => {
    expect(inferPlanFromSubscription({ metadata: { plan: "max" } })).toBe("max");
  });
  it("falls back to price amount for legacy subs without metadata", () => {
    expect(
      inferPlanFromSubscription({
        metadata: {},
        items: { data: [{ price: { unit_amount: PLAN_MONTHLY_AED.max * 100, currency: "aed" } }] },
      }),
    ).toBe("max");
  });
  it("returns null when nothing matches", () => {
    expect(inferPlanFromSubscription({ metadata: {} })).toBeNull();
  });
});

describe("toDbStatus / toDbPlan (cancel-is-immediate)", () => {
  it("maps active/past_due, cancel_at_period_end forces canceled", () => {
    expect(toDbStatus("active", false)).toBe("active");
    expect(toDbStatus("active", true)).toBe("canceled");
    expect(toDbStatus("past_due")).toBe("past_due");
    expect(toDbStatus("canceled")).toBe("canceled");
  });
  it("canceled status always drops to free", () => {
    expect(toDbPlan("max", "canceled")).toBe("free");
    expect(toDbPlan("pro", "active")).toBe("pro");
    expect(toDbPlan(null, "active")).toBe("free");
  });
});

describe("computeOwnerPlan (one plan for all restaurants)", () => {
  it("highest tier wins, canceled counts as free", () => {
    expect(
      computeOwnerPlan([
        { subscription_plan: "free", subscription_status: "active" },
        { subscription_plan: "max", subscription_status: "active" },
      ]),
    ).toBe("max");
    expect(
      computeOwnerPlan([
        { subscription_plan: "max", subscription_status: "canceled" },
        { subscription_plan: "pro", subscription_status: "active" },
      ]),
    ).toBe("pro");
    expect(computeOwnerPlan([])).toBe("free");
  });
});

describe("applySubscriptionToOwnerOrgs (fan-out write)", () => {
  it("updates every owned org id in one query", async () => {
    const update = vi.fn(() => ({ in: vi.fn(async () => ({ error: null })) }));
    const admin = { from: vi.fn(() => ({ update })) } as any;
    const { error } = await applySubscriptionToOwnerOrgs(admin, ["org-1", "org-2"], {
      plan: "max",
      status: "active",
      subscriptionId: "sub_123",
      customerId: "cus_123",
      periodEnd: "2026-11-15T00:00:00.000Z",
    });
    expect(error).toBeNull();
    expect(admin.from).toHaveBeenCalledWith("organizations");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_plan: "max", subscription_status: "active" }),
    );
  });
});
