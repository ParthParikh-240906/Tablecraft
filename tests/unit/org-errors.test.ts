/**
 * tests/unit/org-errors.test.ts
 * Covers lib/org.ts error contract:
 *  OrgFetchError must bubble to error.tsx (never mapped to notFound),
 *  getOrgs/getMenuByOrg throw OrgFetchError on DB failure,
 *  getMenuByOrg groups by category with "Other" fallback.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockState = vi.hoisted(() => ({
  table: "",
  result: { data: null as unknown, error: null as unknown },
}));

function chain() {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order"]) {
    q[m] = vi.fn(() => q);
  }
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(mockState.result).then(resolve);
  return q;
}

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
  headers: vi.fn(async () => ({ get: () => null })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      mockState.table = table;
      return chain();
    }),
  })),
}));

import { OrgFetchError, getOrgs, getMenuByOrg } from "@/lib/org";

beforeEach(() => {
  mockState.result = { data: null, error: null };
});

describe("OrgFetchError", () => {
  it("has code ORG_FETCH_FAILED + name + default message", () => {
    const e = new OrgFetchError();
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("OrgFetchError");
    expect(e.code).toBe("ORG_FETCH_FAILED");
    expect(e.message).toMatch(/could not load/i);
  });

  it("accepts custom message", () => {
    expect(new OrgFetchError("Custom").message).toBe("Custom");
  });
});

describe("getOrgs", () => {
  it("returns org list on success", async () => {
    mockState.result = { data: [{ id: "1", slug: "a" }], error: null };
    const data = await getOrgs();
    expect(data).toHaveLength(1);
    expect(mockState.table).toBe("organizations");
  });

  it("throws OrgFetchError (not null, not empty) on DB failure", async () => {
    mockState.result = { data: null, error: { message: "db down" } };
    await expect(getOrgs()).rejects.toBeInstanceOf(OrgFetchError);
  });
});

describe("getMenuByOrg", () => {
  it("groups items by category", async () => {
    mockState.result = {
      data: [
        { id: "1", name: "Pizza", category: "Mains", price: 50 },
        { id: "2", name: "Pasta", category: "Mains", price: 40 },
        { id: "3", name: "Cake", category: "Desserts", price: 20 },
      ],
      error: null,
    };
    const grouped = await getMenuByOrg("org1");
    expect(grouped).toHaveLength(2);
    expect(grouped.find((g) => g.category === "Mains")?.items).toHaveLength(2);
  });

  it("null category falls back to 'Other' (never crashes the menu page)", async () => {
    mockState.result = { data: [{ id: "1", name: "Soup", category: null, price: 10 }], error: null };
    const grouped = await getMenuByOrg("org1");
    expect(grouped[0].category).toBe("Other");
  });

  it("throws OrgFetchError on DB failure so menu shows error, not empty state", async () => {
    mockState.result = { data: null, error: { message: "db down" } };
    await expect(getMenuByOrg("org1")).rejects.toBeInstanceOf(OrgFetchError);
  });
});
