import { describe, it, expect } from "vitest";
import { calculateOrderIngredientUsage } from "@/lib/inventory-orders";

describe("calculateOrderIngredientUsage", () => {
  const ingredients = [
    { id: "rice", track_stock: true, archived: false },
    { id: "chicken", track_stock: true, archived: false },
    { id: "salt", track_stock: false, archived: false },
    { id: "old-stock", track_stock: true, archived: true },
  ];

  it("multiplies recipe quantity by order quantity", () => {
    const usage = calculateOrderIngredientUsage(
      [{ id: "biryani", quantity: 3 }],
      [
        { menu_item_id: "biryani", inventory_item_id: "rice", quantity: 120 },
        { menu_item_id: "biryani", inventory_item_id: "chicken", quantity: 180 },
      ],
      [{ id: "biryani", deducts_stock: true }],
      ingredients,
    );
    expect(usage.get("rice")).toBe(360);
    expect(usage.get("chicken")).toBe(540);
  });

  it("aggregates shared ingredients across dishes", () => {
    const usage = calculateOrderIngredientUsage(
      [
        { id: "biryani", quantity: 2 },
        { id: "pulao", quantity: 1 },
      ],
      [
        { menu_item_id: "biryani", inventory_item_id: "rice", quantity: 120 },
        { menu_item_id: "pulao", inventory_item_id: "rice", quantity: 100 },
      ],
      [
        { id: "biryani", deducts_stock: true },
        { id: "pulao", deducts_stock: true },
      ],
      ingredients,
    );
    expect(usage.get("rice")).toBe(340);
  });

  it("skips third-party dishes, untracked ingredients, and archived ingredients", () => {
    const usage = calculateOrderIngredientUsage(
      [
        { id: "cake", quantity: 2 },
        { id: "biryani", quantity: 1 },
      ],
      [
        { menu_item_id: "cake", inventory_item_id: "rice", quantity: 50 },
        { menu_item_id: "biryani", inventory_item_id: "salt", quantity: 2 },
        { menu_item_id: "biryani", inventory_item_id: "old-stock", quantity: 10 },
      ],
      [
        { id: "cake", deducts_stock: false },
        { id: "biryani", deducts_stock: true },
      ],
      ingredients,
    );
    expect(usage.size).toBe(0);
  });
});
