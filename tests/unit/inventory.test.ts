import { describe, it, expect } from "vitest";
import {
  convertToBaseUnit,
  getStockStatus,
  normalizeIngredientName,
  stockPercent,
} from "@/lib/inventory";

describe("normalizeIngredientName", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeIngredientName("  Fresh   Tomatoes! ")).toBe("fresh tomato");
    expect(normalizeIngredientName("Salt & Pepper")).toBe("salt and pepper");
  });

  it("singularises simple plurals", () => {
    expect(normalizeIngredientName("onions")).toBe("onion");
    expect(normalizeIngredientName("berries")).toBe("berry");
    expect(normalizeIngredientName("glass")).toBe("glass");
    expect(normalizeIngredientName("asparagus")).toBe("asparagus");
    expect(normalizeIngredientName("couscous")).toBe("couscous");
  });
});

describe("convertToBaseUnit", () => {
  it("converts mass units to grams", () => {
    expect(convertToBaseUnit(2, "kg", "g")).toEqual({ ok: true, value: 2000 });
    expect(convertToBaseUnit(500, "g", "g")).toEqual({ ok: true, value: 500 });
  });

  it("converts volume units to millilitres", () => {
    expect(convertToBaseUnit(1.5, "L", "ml")).toEqual({ ok: true, value: 1500 });
    expect(convertToBaseUnit(2, "tbsp", "ml")).toEqual({ ok: true, value: 30 });
    expect(convertToBaseUnit(1, "cup", "ml")).toEqual({ ok: true, value: 240 });
  });

  it("converts count units to each", () => {
    expect(convertToBaseUnit(3, "pieces", "each")).toEqual({ ok: true, value: 3 });
    expect(convertToBaseUnit(2, "bottles", "each")).toEqual({ ok: true, value: 2 });
  });

  it("rejects incompatible dimensions", () => {
    const result = convertToBaseUnit(1, "kg", "ml");
    expect(result.ok).toBe(false);
  });
});

describe("getStockStatus", () => {
  const base = {
    quantity_on_hand: 500,
    par_level: 1000,
    low_stock_percent: 75,
    track_stock: true,
    archived: false,
  };

  it("treats zero and negative as out", () => {
    expect(getStockStatus({ ...base, quantity_on_hand: 0 })).toBe("out");
    expect(getStockStatus({ ...base, quantity_on_hand: -1 })).toBe("out");
  });

  it("flags low at or below 75% of par", () => {
    expect(getStockStatus({ ...base, quantity_on_hand: 750 })).toBe("low");
    expect(getStockStatus({ ...base, quantity_on_hand: 751 })).toBe("ok");
  });

  it("respects per-item threshold and untracked states", () => {
    expect(getStockStatus({ ...base, quantity_on_hand: 600, low_stock_percent: 50 })).toBe("ok");
    expect(getStockStatus({ ...base, track_stock: false })).toBe("untracked");
    expect(getStockStatus({ ...base, archived: true })).toBe("untracked");
    expect(getStockStatus({ ...base, par_level: null })).toBe("untracked");
  });
});

describe("stockPercent", () => {
  it("returns a clamped percentage of par", () => {
    expect(stockPercent({ quantity_on_hand: 500, par_level: 1000 })).toBe(50);
    expect(stockPercent({ quantity_on_hand: 2000, par_level: 1000 })).toBe(100);
    expect(stockPercent({ quantity_on_hand: 0, par_level: 1000 })).toBe(0);
    expect(stockPercent({ quantity_on_hand: 10, par_level: null })).toBeNull();
  });
});
