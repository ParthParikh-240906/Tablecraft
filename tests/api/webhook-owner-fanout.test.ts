/**
 * tests/api/webhook-owner-fanout.test.ts
 * Owner-wide webhook: a single Stripe purchase must update EVERY org the
 * owner holds (the fix for "stuck on Free + infinite ?checkout=done loop").
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

function makeQuery(result: { data: unknown; error?: unknown }, capture?: { updates: unknown[] }) {
  const q: Record<string, any> = {};
  q.select = vi.fn(() => q);
  q.eq = vi.fn(() => q);
  q.in = vi.fn(() => q);
  q.limit = vi.fn(() => q);
  q.single = vi.fn(async () => result);
  q.maybeSingle = vi.fn(async () => result);
  q.update = vi.fn((payload: unknown) => {
    capture?.updates.push(payload);
    return q;
  });
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

const state = {
  updates: [] as unknown[],
  orgRows: [
    { id: "org-1", slug: "taj" },
    { id: "org-2", slug: "taj-2" },
  ],
};

const stripeMocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  retrieveSub: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: stripeMocks.constructEvent },
    subscriptions: { retrieve: stripeMocks.retrieveSub },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "staff_users") {
        // getOwnerOrgIds + getOwnerIdForOrg: two orgs for owner-1
        return makeQuery({ data: [{ org_id: "org-1" }, { org_id: "org-2" }], error: null });
      }
      if (table === "organizations") {
        return makeQuery({ data: state.orgRows, error: null }, state as { updates: unknown[] });
      }
      return makeQuery({ data: null, error: null });
    },
  })),
}));

import { POST } from "@/app/api/webhooks/stripe/route";

function webhookReq(event: unknown) {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: JSON.stringify(event),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.updates = [];
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

describe("owner-wide Stripe webhook", () => {
  it("checkout.session.completed (subscription) reconciles via session metadata", async () => {
    stripeMocks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          mode: "subscription",
          subscription: "sub_123",
          customer: "cus_123",
          metadata: { type: "subscription", ownerId: "owner-1", orgId: "org-1", orgSlug: "taj", plan: "max" },
        },
      },
    });
    stripeMocks.retrieveSub.mockResolvedValue({
      id: "sub_123",
      status: "active",
      customer: "cus_123",
      current_period_end: 1790000000,
      metadata: { ownerId: "owner-1", orgId: "org-1", orgSlug: "taj", plan: "max" },
      items: { data: [] },
    });

    const res = await POST(webhookReq({}));
    expect(res.status).toBe(200);
    expect(stripeMocks.retrieveSub).toHaveBeenCalledWith("sub_123");
    // Fan-out update carried the Max plan.
    expect(state.updates.some((u) => (u as Record<string, unknown>).subscription_plan === "max")).toBe(true);
  });

  it("customer.subscription.created with empty metadata falls back to price inference, not Free", async () => {
    stripeMocks.constructEvent.mockReturnValue({
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_456",
          status: "active",
          customer: "cus_123",
          current_period_end: 1790000000,
          metadata: { ownerId: "owner-1" },
          items: { data: [{ price: { unit_amount: 35000, currency: "aed" } }] },
        },
      },
    });

    const res = await POST(webhookReq({}));
    expect(res.status).toBe(200);
    // 35000 fils = AED 350 = Max monthly → must not downgrade to Free.
    expect(state.updates.some((u) => (u as Record<string, unknown>).subscription_plan === "max")).toBe(true);
  });
});
