import type { InventoryItem, InventoryUnit, StockStatus } from "@/types/inventory";

export const DEFAULT_LOW_STOCK_PERCENT = 75;
export const BASE_UNITS: InventoryUnit[] = ["g", "ml", "each"];
export const MAX_INGREDIENTS_PER_MENU_ITEM = 50;
export const MAX_INVENTORY_NAME_LEN = 200;
export const MAX_INVENTORY_CATEGORY_LEN = 100;
export const MAX_INVENTORY_NOTE_LEN = 500;

type Dimension = "mass" | "volume" | "count";

type UnitInfo = { dimension: Dimension; factor: number };

/**
 * Every unit the UI accepts, normalised to a base unit:
 * mass → g, volume → ml, count → each.
 */
const UNIT_TABLE: Record<string, UnitInfo> = {
  g: { dimension: "mass", factor: 1 },
  gram: { dimension: "mass", factor: 1 },
  grams: { dimension: "mass", factor: 1 },
  kg: { dimension: "mass", factor: 1000 },
  kilogram: { dimension: "mass", factor: 1000 },
  kilograms: { dimension: "mass", factor: 1000 },
  mg: { dimension: "mass", factor: 0.001 },

  ml: { dimension: "volume", factor: 1 },
  milliliter: { dimension: "volume", factor: 1 },
  millilitre: { dimension: "volume", factor: 1 },
  milliliters: { dimension: "volume", factor: 1 },
  millilitres: { dimension: "volume", factor: 1 },
  l: { dimension: "volume", factor: 1000 },
  liter: { dimension: "volume", factor: 1000 },
  litre: { dimension: "volume", factor: 1000 },
  liters: { dimension: "volume", factor: 1000 },
  litres: { dimension: "volume", factor: 1000 },
  cl: { dimension: "volume", factor: 10 },
  dl: { dimension: "volume", factor: 100 },
  tsp: { dimension: "volume", factor: 5 },
  teaspoon: { dimension: "volume", factor: 5 },
  teaspoons: { dimension: "volume", factor: 5 },
  tbsp: { dimension: "volume", factor: 15 },
  tablespoon: { dimension: "volume", factor: 15 },
  tablespoons: { dimension: "volume", factor: 15 },
  cup: { dimension: "volume", factor: 240 },
  cups: { dimension: "volume", factor: 240 },

  each: { dimension: "count", factor: 1 },
  unit: { dimension: "count", factor: 1 },
  units: { dimension: "count", factor: 1 },
  piece: { dimension: "count", factor: 1 },
  pieces: { dimension: "count", factor: 1 },
  pc: { dimension: "count", factor: 1 },
  pcs: { dimension: "count", factor: 1 },
  packet: { dimension: "count", factor: 1 },
  packets: { dimension: "count", factor: 1 },
  pkt: { dimension: "count", factor: 1 },
  bottle: { dimension: "count", factor: 1 },
  bottles: { dimension: "count", factor: 1 },
  can: { dimension: "count", factor: 1 },
  cans: { dimension: "count", factor: 1 },
  box: { dimension: "count", factor: 1 },
  boxes: { dimension: "count", factor: 1 },
  loaf: { dimension: "count", factor: 1 },
  loaves: { dimension: "count", factor: 1 },
};

const BASE_DIMENSION: Record<InventoryUnit, Dimension> = {
  g: "mass",
  ml: "volume",
  each: "count",
};

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Lowercase, strip punctuation, collapse whitespace, and remove simple plurals. */
export function normalizeIngredientName(raw: string): string {
  let s = raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Light singularisation. Keep words ending in "ss" (e.g. "glass") intact.
  s = s
    .split(" ")
    .map((word) => {
      if (word.endsWith("us") || word.endsWith("is") || word.endsWith("ous")) return word;
      if (word.length > 3 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
      if (word.length > 3 && word.endsWith("es") && !word.endsWith("ses")) return word.slice(0, -2);
      if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
      return word;
    })
    .join(" ");

  return s;
}

export function normalizeUnit(raw: string): string {
  return raw.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
}

export function unitDimension(unit: string): Dimension | null {
  return UNIT_TABLE[normalizeUnit(unit)]?.dimension ?? null;
}

/**
 * Convert a quantity to an inventory item's base unit.
 * Returns an error when the units are incompatible (e.g. g → ml).
 */
export function convertToBaseUnit(
  quantity: number,
  fromUnit: string,
  baseUnit: InventoryUnit,
): { ok: true; value: number } | { ok: false; error: string } {
  if (!Number.isFinite(quantity) || quantity < 0) {
    return { ok: false, error: "Quantity must be a positive number." };
  }
  const from = UNIT_TABLE[normalizeUnit(fromUnit)];
  if (!from) return { ok: false, error: `Unsupported unit: ${fromUnit}` };

  const target = BASE_DIMENSION[baseUnit];
  if (from.dimension !== target) {
    return {
      ok: false,
      error: `Cannot convert ${fromUnit} to ${baseUnit} — choose a compatible unit.`,
    };
  }

  const baseFactor = target === "mass" ? 1 : target === "volume" ? 1 : 1;
  return { ok: true, value: (quantity * from.factor) / baseFactor };
}

export function baseUnitForDimension(dimension: Dimension): InventoryUnit {
  if (dimension === "mass") return "g";
  if (dimension === "volume") return "ml";
  return "each";
}

export type StockStatusInput = {
  quantity_on_hand: number | string | null;
  par_level: number | string | null;
  low_stock_percent?: number | string | null;
  track_stock?: boolean | null;
  archived?: boolean | null;
};

export function getStockStatus(item: StockStatusInput): StockStatus {
  if (item.archived || item.track_stock === false) return "untracked";

  const qty = toFiniteNumber(item.quantity_on_hand) ?? 0;
  if (qty <= 0) return "out";

  const par = toFiniteNumber(item.par_level);
  if (par == null || par <= 0) return "untracked";

  const pct = toFiniteNumber(item.low_stock_percent) ?? DEFAULT_LOW_STOCK_PERCENT;
  if (qty <= par * (pct / 100)) return "low";
  return "ok";
}

export function isLowOrOut(status: StockStatus): boolean {
  return status === "low" || status === "out";
}

export function stockPercent(item: StockStatusInput): number | null {
  const qty = toFiniteNumber(item.quantity_on_hand);
  const par = toFiniteNumber(item.par_level);
  if (qty == null || par == null || par <= 0) return null;
  return Math.max(0, Math.min(100, (qty / par) * 100));
}

export function formatQuantity(quantity: number, unit: InventoryUnit | string): string {
  const n = Number(quantity);
  if (!Number.isFinite(n)) return `0 ${unit}`;
  const rounded = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100;
  return `${rounded} ${unit}`;
}

export function statusLabel(status: StockStatus): string {
  if (status === "out") return "Out of stock";
  if (status === "low") return "Low stock";
  if (status === "untracked") return "Not tracked";
  return "In stock";
}

export function stockStatusTone(status: StockStatus): string {
  if (status === "out") return "border-red-300 bg-red-50 text-red-700";
  if (status === "low") return "border-amber-300 bg-amber-50 text-amber-700";
  if (status === "untracked") return "border-neutral-300 bg-neutral-100 text-neutral-600";
  return "border-emerald-300 bg-emerald-50 text-emerald-700";
}

export function isInventoryUnit(value: unknown): value is InventoryUnit {
  return value === "g" || value === "ml" || value === "each";
}

export function clampLowStockPercent(value: unknown): number {
  const n = toFiniteNumber(value);
  if (n == null) return DEFAULT_LOW_STOCK_PERCENT;
  return Math.min(100, Math.max(1, n));
}

export function inventoryItemStatus(item: InventoryItem): StockStatus {
  return getStockStatus(item);
}
