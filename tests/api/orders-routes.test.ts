/**
 * tests/api/orders-routes.test.ts
 * Auth + validation tests for the console orders API with mocked Supabase.
 * Proves the error-handling contract without a DB:
 *  400 invalid body / missing fields / bad quantity / bad status
 *  401 unauthenticated, 403 not staff, 404 order not found.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockState = vi.hoisted(() => ({
  user: null as null | { id: string },
  adminData: {} as Record<string, { data: unknown; error?: unknown }>,
  serverData: {} as Record<string, { data: unknown; error?: unknown }>,
}));

/** Minimal thenable Supabase query builder: every filter returns itself,
 *  terminal methods resolve the preconfigured result, `await builder` works. */
function chain(result: { data: unknown; error?: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "insert", "update", "delete", "upsert", "gte", "gt", "lt", "neq"]) {
    q[m] = vi.fn(() => q);
  }
  q.maybeSingle = vi.fn(async () => result);
  q.single = vi.fn(async () => result);
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: mockState.user } })) },
    from: vi.fn((table: string) => chain(mockState.serverData[table] ?? { data: null })),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => chain(mockState.adminData[table] ?? { data: null })),
  })),
}));

import { POST as createOrder } from "@/app/api/orders/create/route";
import { POST as updateStatus } from "@/app/api/orders/status/route";
import { POST as updateOrder } from "@/app/api/orders/update/route";
import { DELETE as deleteOrder } from "@/app/api/orders/delete/route";

const post = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  mockState.user = null;
  mockState.adminData = {};
  mockState.serverData = {};
});

describe("orders/create", () => {
  it("400 on invalid JSON", async () => {
    const res = await createOrder(new Request("http://x/api/orders/create", { method: "POST", body: "{{" }));
    expect(res.status).toBe(400);
  });

  it("401 when not signed in", async () => {
    mockState.user = null;
    const res = await createOrder(post("http://x/api/orders/create", { tableIds: ["t1"], items: [{ id: "m1", quantity: 1 }] }));
    expect(res.status).toBe(401);
  });

  it("400 when tableIds missing", async () => {
    mockState.user = { id: "u1" };
    const res = await createOrder(post("http://x/api/orders/create", { items: [{ id: "m1", quantity: 1 }] }));
    expect(res.status).toBe(400);
  });

  it("400 when items empty", async () => {
    mockState.user = { id: "u1" };
    const res = await createOrder(post("http://x/api/orders/create", { tableIds: ["t1"], items: [] }));
    expect(res.status).toBe(400);
  });

  it("403 when user has no staff rows", async () => {
    mockState.user = { id: "u1" };
    mockState.adminData.staff_users = { data: [] };
    const res = await createOrder(post("http://x/api/orders/create", { tableIds: ["t1"], items: [{ id: "m1", quantity: 1 }] }));
    expect(res.status).toBe(403);
  });

  it("400 on item quantity 0 (validated server-side, never trusted)", async () => {
    mockState.user = { id: "u1" };
    mockState.adminData.staff_users = { data: [{ org_id: "org1" }] };
    mockState.adminData.tables = { data: [{ id: "t1", label: "Table 1" }] };
    mockState.adminData.menu_items = { data: [{ id: "m1", name: "Pizza", price: 50 }] };
    const res = await createOrder(
      post("http://x/api/orders/create", { tableIds: ["t1"], items: [{ id: "m1", quantity: 0 }] })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/quantity/i);
  });

  it("404 when table not in org", async () => {
    mockState.user = { id: "u1" };
    mockState.adminData.staff_users = { data: [{ org_id: "org1" }] };
    mockState.adminData.tables = { data: [] }; // length mismatch
    const res = await createOrder(
      post("http://x/api/orders/create", { tableIds: ["ghost"], items: [{ id: "m1", quantity: 1 }] })
    );
    expect(res.status).toBe(404);
  });
});

describe("orders/status", () => {
  it("400 on invalid JSON", async () => {
    const res = await updateStatus(new Request("http://x/api/orders/status", { method: "POST", body: "{{" }));
    expect(res.status).toBe(400);
  });

  it("401 when not signed in", async () => {
    const res = await updateStatus(post("http://x/api/orders/status", { orderId: "o1", status: "ready" }));
    expect(res.status).toBe(401);
  });

  it("400 when fields missing", async () => {
    mockState.user = { id: "u1" };
    const res = await updateStatus(post("http://x/api/orders/status", { orderId: "o1" }));
    expect(res.status).toBe(400);
  });

  it("400 on invalid status value", async () => {
    mockState.user = { id: "u1" };
    const res = await updateStatus(post("http://x/api/orders/status", { orderId: "o1", status: "served" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid status/i);
  });

  it("404 when order not found", async () => {
    mockState.user = { id: "u1" };
    mockState.adminData.orders = { data: null };
    const res = await updateStatus(post("http://x/api/orders/status", { orderId: "ghost", status: "ready" }));
    expect(res.status).toBe(404);
  });

  it("403 when not staff of the order's org", async () => {
    mockState.user = { id: "u1" };
    mockState.adminData.orders = { data: { id: "o1", org_id: "orgA", customer_name: "Table 1", parent_order_id: null } };
    mockState.serverData.staff_users = { data: [{ org_id: "orgB" }] };
    const res = await updateStatus(post("http://x/api/orders/status", { orderId: "o1", status: "ready" }));
    expect(res.status).toBe(403);
  });

  it("200 happy path frees tables (no tables found → success with warning)", async () => {
    mockState.user = { id: "u1" };
    mockState.adminData.orders = { data: { id: "o1", org_id: "orgA", customer_name: "Table 1", parent_order_id: null } };
    mockState.serverData.staff_users = { data: [{ org_id: "orgA" }] };
    mockState.adminData.tables = { data: [] };
    const res = await updateStatus(post("http://x/api/orders/status", { orderId: "o1", status: "cancelled" }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

describe("orders/update + orders/delete", () => {
  it("update: 400 on invalid JSON", async () => {
    const res = await updateOrder(new Request("http://x/api/orders/update", { method: "POST", body: "{{" }));
    expect(res.status).toBe(400);
  });

  it("update: 401 when not signed in", async () => {
    const res = await updateOrder(post("http://x/api/orders/update", { orderId: "o1", items: [] }));
    expect(res.status).toBe(401);
  });

  it("update: 400 when items missing", async () => {
    mockState.user = { id: "u1" };
    const res = await updateOrder(post("http://x/api/orders/update", { orderId: "o1" }));
    expect(res.status).toBe(400);
  });

  it("delete: 400 on invalid JSON", async () => {
    const res = await deleteOrder(new Request("http://x/api/orders/delete", { method: "DELETE", body: "{{" }));
    expect(res.status).toBe(400);
  });

  it("delete: 401 when not signed in", async () => {
    const res = await deleteOrder(
      new Request("http://x/api/orders/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "o1" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("delete: 400 when orderId missing", async () => {
    mockState.user = { id: "u1" };
    const res = await deleteOrder(
      new Request("http://x/api/orders/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it("delete: 404 when order not found", async () => {
    mockState.user = { id: "u1" };
    mockState.adminData.orders = { data: null };
    const res = await deleteOrder(
      new Request("http://x/api/orders/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "ghost" }),
      })
    );
    expect(res.status).toBe(404);
  });
});
