/**
 * tests/api/subscription-status.test.ts
 * Covers GET /api/subscription/status auth contract (hardened: billing data
 * requires a signed-in staff member of the org).
 *  400 missing orgSlug, 401 signed out, 403 not staff, 404 unknown org.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockState = vi.hoisted(() => ({
  user: null as null | { id: string },
  orgRow: null as null | { id: string; subscription_plan?: string; subscription_status?: string; subscription_current_period_end?: string | null },
  staffRows: [] as { org_id: string }[],
}));

function chain(result: { data: unknown; error?: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "maybeSingle", "single"]) {
    q[m] = vi.fn(() => q);
  }
  // Terminal: maybeSingle/single resolve; await builder resolves too
  (q.maybeSingle as ReturnType<typeof vi.fn>) = vi.fn(async () => result);
  (q.single as ReturnType<typeof vi.fn>) = vi.fn(async () => result);
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: mockState.user } })) },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "organizations") return chain({ data: mockState.orgRow });
      if (table === "staff_users") return chain({ data: mockState.staffRows });
      return chain({ data: null });
    }),
  })),
}));

import { GET } from "@/app/api/subscription/status/route";

const get = (qs: string) => new Request(`http://localhost/api/subscription/status${qs}`);

beforeEach(() => {
  mockState.user = null;
  mockState.orgRow = null;
  mockState.staffRows = [];
});

describe("GET /api/subscription/status", () => {
  it("400 when orgSlug missing", async () => {
    const res = await GET(get(""));
    expect(res.status).toBe(400);
  });

  it("401 when not signed in", async () => {
    const res = await GET(get("?orgSlug=demo-diner"));
    expect(res.status).toBe(401);
  });

  it("404 when org unknown", async () => {
    mockState.user = { id: "u1" };
    mockState.orgRow = null;
    const res = await GET(get("?orgSlug=nope"));
    expect(res.status).toBe(404);
  });

  it("403 when signed in but not staff of org", async () => {
    mockState.user = { id: "u1" };
    mockState.orgRow = { id: "org-1" };
    mockState.staffRows = [];
    const res = await GET(get("?orgSlug=demo-diner"));
    expect(res.status).toBe(403);
  });

  it("200 for staff member (plan defaults to free)", async () => {
    mockState.user = { id: "u1" };
    mockState.orgRow = { id: "org-1" };
    mockState.staffRows = [{ org_id: "org-1" }];
    const res = await GET(get("?orgSlug=demo-diner"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBe("free");
  });
});
