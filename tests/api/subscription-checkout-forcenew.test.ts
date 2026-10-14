/**
 * tests/api/subscription-checkout-forcenew.test.ts
 *
 * Regression test for the "Redirecting to Stripe… but Stripe never opened" bug:
 * when the org's Stripe customer already has an active subscription, the
 * checkout route silently updated it in place ({ upgraded: true }) instead of
 * opening Stripe Checkout. The console pricing page now sends `forceNew: true`
 * so a deliberate purchase always returns a Checkout Session URL.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const builder: Record<string, any> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.single = vi.fn(async () => ({
    data: { stripe_customer_id: "cus_123" },
    error: null,
  }));
  builder.update = vi.fn(() => builder);

  const stripe = {
    customers: {
      retrieve: vi.fn(async () => ({ id: "cus_123" })),
      create: vi.fn(async () => ({ id: "cus_123" })),
    },
    products: {
      list: vi.fn(async () => ({ data: [] })),
      create: vi.fn(async (p: { name: string }) => ({ id: `prod_${p.name}`, ...p })),
    },
    prices: {
      list: vi.fn(async () => ({ data: [] })),
      create: vi.fn(async (p: { unit_amount: number }) => ({ id: `price_${p.unit_amount}`, ...p })),
    },
    subscriptions: {
      list: vi.fn(async () => ({
        data: [{ id: "sub_existing", items: { data: [{ id: "si_existing" }] } }],
      })),
      update: vi.fn(async () => ({ id: "sub_existing" })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async () => ({ url: "https://checkout.stripe.test/sess_1", id: "cs_1" })),
      },
    },
  };

  return { builder, stripe };
});

vi.mock("@/lib/api-auth", () => ({
  requireOwnerForSlug: vi.fn(async () => ({ user: { id: "user-1" }, orgId: "org-1" })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: () => mocks.builder })),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: mocks.stripe,
  STRIPE_PUBLISHABLE_KEY: "",
}));

import { POST as checkout } from "@/app/api/subscription/checkout/route";

const ORG_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const req = (body: unknown) =>
  new Request("http://localhost/api/subscription/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });

const baseBody = {
  plan: "pro",
  orgId: ORG_ID,
  orgSlug: "test-cafe",
  email: "owner@test.com",
  billing: "monthly",
};

describe("POST /api/subscription/checkout forceNew", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("without forceNew, an existing active subscription is updated in place (no Stripe page)", async () => {
    const res = await checkout(req(baseBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.upgraded).toBe(true);
    expect(mocks.stripe.subscriptions.update).toHaveBeenCalledOnce();
    expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("with forceNew:true, always returns a Checkout Session URL (Stripe opens)", async () => {
    const res = await checkout(req({ ...baseBody, forceNew: true }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBe("https://checkout.stripe.test/sess_1");
    expect(data.upgraded).toBeUndefined();
    expect(mocks.stripe.subscriptions.list).not.toHaveBeenCalled();
    expect(mocks.stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledOnce();
  });
});
