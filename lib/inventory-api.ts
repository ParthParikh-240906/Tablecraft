import {
  BASE_UNITS,
  MAX_INGREDIENTS_PER_MENU_ITEM,
  MAX_INVENTORY_CATEGORY_LEN,
  MAX_INVENTORY_NAME_LEN,
  MAX_INVENTORY_NOTE_LEN,
  clampLowStockPercent,
  normalizeIngredientName,
  toFiniteNumber,
} from "@/lib/inventory";
import type { InventoryReason, InventoryUnit } from "@/types/inventory";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s.slice(0, max) : null;
}

export function optionalNumber(value: unknown): number | null {
  const n = toFiniteNumber(value);
  return n == null ? null : n;
}

export type InventoryItemInput = {
  name: string;
  normalized_name: string;
  category: string | null;
  base_unit: InventoryUnit;
  quantity_on_hand: number;
  par_level: number | null;
  low_stock_percent: number;
  unit_cost: number | null;
  storage_location: string | null;
  track_stock: boolean;
};

export function parseInventoryItemInput(
  body: unknown,
  opts: { requireName: boolean },
): { ok: true; value: InventoryItemInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;

  const name = cleanText(b.name, MAX_INVENTORY_NAME_LEN);
  if (opts.requireName && !name) return { ok: false, error: "Name is required" };

  const baseUnit = b.base_unit;
  if (opts.requireName && !BASE_UNITS.includes(baseUnit as InventoryUnit)) {
    return { ok: false, error: "Base unit must be g, ml, or each" };
  }

  const par = optionalNumber(b.par_level);
  if (par != null && par < 0) return { ok: false, error: "Par level must be zero or more" };

  const qty = optionalNumber(b.quantity_on_hand) ?? 0;
  if (qty < 0) return { ok: false, error: "Quantity must be zero or more" };

  const cost = optionalNumber(b.unit_cost);
  if (cost != null && cost < 0) return { ok: false, error: "Unit cost must be zero or more" };

  return {
    ok: true,
    value: {
      name: name ?? "",
      normalized_name: normalizeIngredientName(name ?? ""),
      category: cleanText(b.category, MAX_INVENTORY_CATEGORY_LEN),
      base_unit: (baseUnit as InventoryUnit) ?? "each",
      quantity_on_hand: qty,
      par_level: par,
      low_stock_percent: clampLowStockPercent(b.low_stock_percent),
      unit_cost: cost,
      storage_location: cleanText(b.storage_location, 60),
      track_stock: b.track_stock !== false,
    },
  };
}

export const ADJUST_REASONS: InventoryReason[] = [
  "purchase",
  "usage",
  "waste",
  "adjustment",
];

export function parseAdjustInput(body: unknown):
  | { ok: true; mode: "delta" | "set"; quantity: number; reason: InventoryReason; note: string | null }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;
  const mode = b.mode === "set" ? "set" : "delta";
  const quantity = toFiniteNumber(b.quantity);
  const reason = b.reason;

  if (quantity == null || !Number.isFinite(quantity)) {
    return { ok: false, error: "Quantity is required" };
  }
  if (mode === "delta" && quantity === 0) {
    return { ok: false, error: "Quantity cannot be zero" };
  }
  if (mode === "set" && quantity < 0) {
    return { ok: false, error: "Quantity must be zero or more" };
  }
  if (!ADJUST_REASONS.includes(reason as InventoryReason)) {
    return { ok: false, error: "Invalid reason" };
  }

  return {
    ok: true,
    mode,
    quantity,
    reason: reason as InventoryReason,
    note: cleanText(b.note, MAX_INVENTORY_NOTE_LEN),
  };
}

export type RecipeInput = {
  inventory_item_id: string;
  quantity: number;
  ai_estimated: boolean;
};

export function parseRecipeInput(body: unknown):
  | { ok: true; items: RecipeInput[] }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.ingredients)) {
    return { ok: false, error: "ingredients must be an array" };
  }
  if (b.ingredients.length > MAX_INGREDIENTS_PER_MENU_ITEM) {
    return { ok: false, error: `A recipe can have at most ${MAX_INGREDIENTS_PER_MENU_ITEM} ingredients` };
  }

  const seen = new Set<string>();
  const items: RecipeInput[] = [];

  for (const raw of b.ingredients) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (!isUuid(r.inventory_item_id)) {
      return { ok: false, error: "Invalid inventory item id" };
    }
    if (seen.has(r.inventory_item_id)) {
      return { ok: false, error: "Duplicate ingredient" };
    }
    seen.add(r.inventory_item_id);
    const qty = toFiniteNumber(r.quantity);
    if (qty == null || qty <= 0) {
      return { ok: false, error: "Ingredient quantity must be greater than zero" };
    }
    items.push({
      inventory_item_id: r.inventory_item_id,
      quantity: qty,
      ai_estimated: r.ai_estimated === true,
    });
  }

  return { ok: true, items };
}
