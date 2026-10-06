/**
 * tests/unit/table-labels.test.ts
 * Covers lib/table-labels.ts — normalization for freeing tables from
 * order customer_name values ("Table 1, 2"). Prevents stuck-occupied tables
 * when labels are renamed, cased differently, or carry an " Edit" suffix.
 */
import { describe, it, expect } from "vitest";
import {
  normalizeTableLabel,
  parseTableLabelsFromCustomerName,
  isTableOrderName,
  stripEditSuffix,
} from "@/lib/table-labels";

describe("normalizeTableLabel", () => {
  it.each([
    ["Table 7", "7"],
    ["table 7", "7"],
    ["  TABLE  A1 ", "a1"],
    ["1", "1"],
    ["Table 1 Edit", "1"],
  ])("normalizes %p → %p", (input, expected) => {
    expect(normalizeTableLabel(input)).toBe(expected);
  });
});

describe("parseTableLabelsFromCustomerName", () => {
  it('splits "Table 1, 2, 3" into parts', () => {
    expect(parseTableLabelsFromCustomerName("Table 1, 2, 3")).toEqual(["1", "2", "3"]);
  });

  it("handles case/whitespace variants", () => {
    expect(parseTableLabelsFromCustomerName("  table 1 ,  2 ")).toEqual(["1", "2"]);
  });

  it("strips trailing Edit marker", () => {
    expect(parseTableLabelsFromCustomerName("Table 1 Edit")).toEqual(["1"]);
  });

  it("returns [] for walk-in names (non-table orders)", () => {
    expect(parseTableLabelsFromCustomerName("Jane Doe")).toEqual([]);
    expect(parseTableLabelsFromCustomerName("Tablewater Cafe")).toEqual([]);
  });
});

describe("isTableOrderName", () => {
  it("detects dine-in table orders", () => {
    expect(isTableOrderName("Table 1")).toBe(true);
    expect(isTableOrderName("table 1, 2")).toBe(true);
    expect(isTableOrderName("Table 1 Edit")).toBe(true);
  });

  it("rejects walk-ins, including Table% prefix collisions", () => {
    expect(isTableOrderName("Jane")).toBe(false);
    expect(isTableOrderName("Tablewater")).toBe(false);
  });
});

describe("stripEditSuffix", () => {
  it("removes trailing Edit only", () => {
    expect(stripEditSuffix("Table 1 Edit")).toBe("Table 1");
    expect(stripEditSuffix("Editor")).toBe("Editor");
  });
});
