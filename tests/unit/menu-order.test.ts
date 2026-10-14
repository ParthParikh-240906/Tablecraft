/**
 * tests/unit/menu-order.test.ts
 * Covers lib/menu-order.ts — console↔website order parity + insert defaults.
 */
import { describe, it, expect } from "vitest";
import { defaultSortOrders, compareMenuOrder } from "@/lib/menu-order";

describe("defaultSortOrders (new items go last, never NULL)", () => {
  const existing = [
    { category: "Starters", sort_order: 0, category_sort_order: 0 },
    { category: "Starters", sort_order: 1, category_sort_order: 0 },
    { category: "Mains", sort_order: 0, category_sort_order: 1 },
  ];

  it("appends inside an existing category", () => {
    expect(defaultSortOrders(existing, "Starters")).toEqual({ sort_order: 2, category_sort_order: 0 });
    expect(defaultSortOrders(existing, "Mains")).toEqual({ sort_order: 1, category_sort_order: 1 });
  });

  it("opens a trailing slot for a brand-new category", () => {
    expect(defaultSortOrders(existing, "Drinks")).toEqual({ sort_order: 0, category_sort_order: 2 });
  });

  it("handles an empty menu", () => {
    expect(defaultSortOrders([], "Starters")).toEqual({ sort_order: 0, category_sort_order: 0 });
    expect(defaultSortOrders([], null)).toEqual({ sort_order: 0, category_sort_order: 0 });
  });

  it("ignores NULL positions already in the list", () => {
    const withNulls = [...existing, { category: "Starters", sort_order: null, category_sort_order: null }];
    expect(defaultSortOrders(withNulls, "Starters")).toEqual({ sort_order: 2, category_sort_order: 0 });
  });
});

describe("compareMenuOrder (website All == console sequence)", () => {
  it("groups by category first, then item order", () => {
    const rows = [
      { id: "d1", category: "Desserts", sort_order: 0, category_sort_order: 2 },
      { id: "m1", category: "Mains", sort_order: 1, category_sort_order: 1 },
      { id: "s1", category: "Starters", sort_order: 0, category_sort_order: 0 },
      { id: "m0", category: "Mains", sort_order: 0, category_sort_order: 1 },
    ];
    expect([...rows].sort(compareMenuOrder).map((r) => r.id)).toEqual(["s1", "m0", "m1", "d1"]);
  });

  it("sorts NULL positions last (matches NULLS LAST queries)", () => {
    const rows = [
      { id: "new", category: "Mains", sort_order: null, category_sort_order: null },
      { id: "old", category: "Mains", sort_order: 0, category_sort_order: 1 },
    ];
    expect([...rows].sort(compareMenuOrder).map((r) => r.id)).toEqual(["old", "new"]);
  });
});
