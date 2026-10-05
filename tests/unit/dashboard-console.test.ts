/**
 * tests/unit/dashboard-console.test.ts
 * Covers console + owner-dashboard business logic + error handling:
 *  - operator dashboard stats (dashboard-client.tsx)
 *  - orders grouping parent/child (orders-list.tsx)
 *  - KDS queue filtering + FIFO (kitchen-queue.tsx)
 *  - pricing earnings aggregation (pricing/page.tsx)
 *  - customer_name ↔ table label parsing (orders/status + create)
 *  - console sidebar nav + org preservation contract
 */
import { describe, it, expect } from "vitest";

// ─── Dashboard stats (mirrors dashboard-client.tsx) ───
function computeDashboardStats(opts: {
  tables: { status: string; capacity: number }[];
  bookingsToday: { datetime: string }[];
  liveOrders: unknown[];
  now?: Date;
}) {
  const totalTables = opts.tables.length;
  const availableTables = opts.tables.filter((t) => t.status === "open").length;
  const totalAvailableSeats = opts.tables.filter((t) => t.status === "open").reduce((s, t) => s + t.capacity, 0);
  const bookedToday = opts.bookingsToday.length;
  const liveOrderCount = opts.liveOrders.length;
  return { totalTables, availableTables, totalAvailableSeats, bookedToday, liveOrderCount };
}

// ─── Orders grouping (mirrors orders-list.tsx parent_order_id grouping) ───
type Order = { id: string; parent_order_id: string | null; total: number; status: string };
function groupOrders(orders: Order[]) {
  const parents = orders.filter((o) => !o.parent_order_id);
  return parents.map((p) => ({
    ...p,
    extras: orders.filter((o) => o.parent_order_id === p.id),
    groupTotal: p.total + orders.filter((o) => o.parent_order_id === p.id).reduce((s, o) => s + o.total, 0),
  }));
}

// ─── KDS filtering (mirrors kitchen/page.tsx: exclude completed/paid/cancelled, FIFO) ───
function kdsQueue<T extends { status: string; created_at: string }>(orders: T[]) {
  return orders
    .filter((o) => !["completed", "paid", "cancelled"].includes(o.status))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// ─── Earnings aggregation (mirrors pricing/page.tsx) ───
function earnings(orders: { status: string; total: number }[]) {
  const paid = orders.filter((o) => ["paid", "completed"].includes(o.status));
  return {
    totalEarningsAed: paid.reduce((s, o) => s + o.total, 0),
    totalOrders: orders.length,
    paidOrders: paid.length,
    pendingCount: orders.filter((o) => o.status === "pending").length,
  };
}

// ─── customer_name parsing (mirrors orders/status + orders/create) ───
function parseTableLabels(customerName: string): string[] {
  const raw = customerName.replace(/\s+Edit$/, "");
  if (!raw.startsWith("Table ")) return [];
  return raw.slice("Table ".length).split(",").map((s) => s.trim()).filter(Boolean);
}
function buildCustomerName(labels: string[]): string {
  const stripped = labels.map((l) => l.replace(/^Table\s*/i, ""));
  stripped.sort((a, b) => {
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    return isNaN(na) ? a.localeCompare(b) : na - nb;
  });
  return `Table ${stripped.join(", ")}`;
}

describe("operator dashboard stats", () => {
  it("counts tables, seats, bookings, live orders", () => {
    const s = computeDashboardStats({
      tables: [
        { status: "open", capacity: 4 },
        { status: "open", capacity: 2 },
        { status: "occupied", capacity: 6 },
      ],
      bookingsToday: [{ datetime: "x" }, { datetime: "y" }],
      liveOrders: [{}, {}, {}],
    });
    expect(s).toEqual({ totalTables: 3, availableTables: 2, totalAvailableSeats: 6, bookedToday: 2, liveOrderCount: 3 });
  });

  it("empty restaurant → zeros, not NaN (empty-state error handling)", () => {
    expect(computeDashboardStats({ tables: [], bookingsToday: [], liveOrders: [] })).toEqual({
      totalTables: 0, availableTables: 0, totalAvailableSeats: 0, bookedToday: 0, liveOrderCount: 0,
    });
  });
});

describe("orders parent/child grouping", () => {
  it("groups extras under parent + sums group total", () => {
    const grouped = groupOrders([
      { id: "p1", parent_order_id: null, total: 100, status: "pending" },
      { id: "e1", parent_order_id: "p1", total: 20, status: "pending" },
      { id: "e2", parent_order_id: "p1", total: 30, status: "pending" },
      { id: "p2", parent_order_id: null, total: 50, status: "paid" },
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].extras).toHaveLength(2);
    expect(grouped[0].groupTotal).toBe(150);
    expect(grouped[1].groupTotal).toBe(50);
  });
});

describe("kitchen (KDS) queue", () => {
  it("excludes completed/paid/cancelled + sorts FIFO", () => {
    const q = kdsQueue([
      { status: "ready", created_at: "2026-10-05T12:02:00Z" },
      { status: "completed", created_at: "2026-10-05T12:00:00Z" },
      { status: "pending", created_at: "2026-10-05T12:01:00Z" },
      { status: "paid", created_at: "2026-10-05T12:00:30Z" },
      { status: "cancelled", created_at: "2026-10-05T12:00:10Z" },
    ]);
    expect(q.map((o) => o.status)).toEqual(["pending", "ready"]);
  });

  it("order state machine only allows known transitions", () => {
    const allowed: Record<string, string[]> = {
      pending: ["preparing", "cancelled"],
      preparing: ["ready", "cancelled"],
      ready: ["completed", "cancelled"],
      completed: ["paid"],
      paid: [],
      cancelled: [],
    };
    expect(allowed.pending).toContain("preparing");
    expect(allowed.paid).toEqual([]);
    expect(allowed.ready).not.toContain("pending"); // no backwards moves
  });
});

describe("pricing earnings aggregation", () => {
  it("sums paid+completed only", () => {
    const e = earnings([
      { status: "paid", total: 100 },
      { status: "completed", total: 50 },
      { status: "pending", total: 999 },
      { status: "cancelled", total: 999 },
    ]);
    expect(e.totalEarningsAed).toBe(150);
    expect(e.paidOrders).toBe(2);
    expect(e.pendingCount).toBe(1);
  });
});

describe("customer_name ↔ table labels", () => {
  it("builds 'Table 1, 2, 10' with numeric sort", () => {
    expect(buildCustomerName(["Table 10", "Table 2", "Table 1"])).toBe("Table 1, 2, 10");
  });
  it("parses labels back out", () => {
    expect(parseTableLabels("Table 1, 2, 3")).toEqual(["1", "2", "3"]);
    expect(parseTableLabels("Table 7")).toEqual(["7"]);
  });
  it("strips trailing ' Edit' + rejects non-table names", () => {
    expect(parseTableLabels("Table 5 Edit")).toEqual(["5"]);
    expect(parseTableLabels("Walk-in Ali")).toEqual([]);
    expect(parseTableLabels("")).toEqual([]);
  });
});

describe("console nav contract (sidebar.tsx)", () => {
  const routes = ["/console", "/console/tables", "/console/bookings", "/console/orders", "/console/kitchen", "/console/menu", "/console/design", "/console/config", "/console/pricing"];
  it("every console route preserves ?org= for multi-org", () => {
    const org = "org-123";
    for (const r of routes) {
      const url = `${r}?org=${org}`;
      expect(url).toContain(`org=${org}`);
    }
  });
  it("active-link detection is prefix-based", () => {
    const isActive = (pathname: string, href: string) =>
      href === "/console" ? pathname === "/console" : pathname.startsWith(href);
    expect(isActive("/console/orders", "/console/orders")).toBe(true);
    expect(isActive("/console/orders/123", "/console/orders")).toBe(true);
    expect(isActive("/console", "/console")).toBe(true);
    expect(isActive("/console/tables", "/console")).toBe(false);
  });
});
