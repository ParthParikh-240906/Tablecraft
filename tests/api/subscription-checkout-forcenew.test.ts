/**
 * tests/api/subscription-checkout-forcenew.test.ts
 *
 * Regression test for the "Redirecting to Stripe… but Stripe never opened" bug:
 * when the org's Stripe customer already has an active subscription, the
 * checkout route silently updated it in place ({ upgraded: true }) instead of
 * opening Stripe Checkout. The console pricing page now sends `forceNew: true`
 * so a deliberate purchase always returns a Checkout Session URL.
 *
 * Owner-wide billing: one plan covers all owned orgs. Checkout fans the
 * Stripe customer ID out to every owned org and stamps
 * subscription_data.metadata so the webhook can resolve the owner.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ORG_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function makeQuery(result: { data: unknown; error?: unknown }) {
  const q: Record<string, any> = {};
  q.select = vi.fn(() => q);
  q.eq = vi.fn(() => q);
  q.in = vi.fn(() => q);
  q.limit = vi.fn(() => q);
  q.single = vi.fn(async () => result);
  q.maybeSingle = vi.fn(async () => result);
  q.update = vi.fn(() => q);
  // Supabase builders are thenable: `await from().select().eq()` resolves.
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

const mocks = vi.hoisted(() => {
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
      update: vi.fn(async () => ({ id: "sub_existing", current_period_end: 9999999999 })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async () => ({ url: "https://checkout.stripe.test/sess_1", id: "cs_1" })),
      },
    },
  };

  return { stripe };
});

vi.mock("@/lib/api-auth", () => ({
  requireOwnerForSlug: vi.fn(async () => ({ user: { id: "user-1" }, orgId: ORG_ID })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "staff_users") {
        return makeQuery({ data: [{ org_id: ORG_ID }], error: null });
      }
      if (table === "organizations") {
        return makeQuery({ data: [{ id: ORG_ID, stripe_customer_id: "cus_123" }], error: null });
      }
      return makeQuery({ data: null, error: null });
    },
  })),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: mocks.stripe,
  STRIPE_PUBLISHABLE_KEY: "",
}));

import { POST as checkout } from "@/app/api/subscription/checkout/route";

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

  it("stamps subscription_data.metadata so the webhook can fan-out owner-wide", async () => {
    const res = await checkout(req({ ...baseBody, forceNew: true }));
    expect(res.status).toBe(200);
    const createArg = (mocks.stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(createArg.subscription_data?.metadata?.plan).toBe("pro");
    expect(createArg.subscription_data?.metadata?.ownerId).toBe("user-1");
    expect(createArg.metadata?.type).toBe("subscription");
  });
});
