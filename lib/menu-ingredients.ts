import type { SupabaseClient } from "@supabase/supabase-js";
import { callHaikuLow } from "@/lib/ai-models";
import { parseModelJson } from "@/lib/ai-json";
import {
  MAX_INGREDIENTS_PER_MENU_ITEM,
  MAX_INVENTORY_CATEGORY_LEN,
  MAX_INVENTORY_NAME_LEN,
  baseUnitForDimension,
  convertToBaseUnit,
  DEFAULT_LOW_STOCK_PERCENT,
  normalizeIngredientName,
  toFiniteNumber,
  unitDimension,
} from "@/lib/inventory";
import type { IngredientEstimate, InventoryUnit } from "@/types/inventory";

export const MAX_ESTIMATED_MENU_ITEMS = 120;
export const INGREDIENT_BATCH_SIZE = 40;

type EstimateInput = { name: string; category?: string | null; description?: string | null };

const PROMPT_PREFIX = `You are a restaurant recipe estimator. For each menu item, make a brief, realistic guess of the ingredients needed to make ONE SERVING of that dish at a mid-size restaurant.

Return ONLY valid JSON with this exact structure:
{
  "items": [
    {
      "index": 0,
      "name": "Chicken Biryani",
      "ingredients": [
        { "name": "Basmati rice", "quantity": 120, "unit": "g", "par_level": 5000, "storage": "pantry", "confidence": "high" },
        { "name": "Chicken", "quantity": 180, "unit": "g", "par_level": 8000, "storage": "fridge", "confidence": "medium" }
      ]
    }
  ]
}

Rules:
- quantity is for ONE serving of the dish.
- unit must be exactly g, ml, or each.
- max 8 ingredients per dish. Consolidate duplicates.
- Do not include water, ice, or free condiments.
- par_level is a target quantity on hand for a one-week ordering cycle, in the same unit. It is a rough default the user can edit.
- storage is pantry, fridge, freezer, bar, or null.
- confidence must be low, medium, or high.
- Return one object per input item, using the supplied index.
- Return ONLY JSON, no other text.

Menu items:
`;

export type EstimateResult = {
  byIndex: Map<number, IngredientEstimate[]>;
  error?: string;
};

export async function estimateMenuIngredients(
  restaurantName: string,
  items: EstimateInput[],
): Promise<EstimateResult> {
  const byIndex = new Map<number, IngredientEstimate[]>();
  if (items.length === 0) return { byIndex };

  const limited = items.slice(0, MAX_ESTIMATED_MENU_ITEMS);
  let error: string | undefined;

  for (let start = 0; start < limited.length; start += INGREDIENT_BATCH_SIZE) {
    const batch = limited.slice(start, start + INGREDIENT_BATCH_SIZE);
    const payload = batch.map((item, i) => ({
      index: start + i,
      name: item.name,
      category: item.category ?? null,
      description: item.description ?? null,
    }));

    const prompt = `${PROMPT_PREFIX}${JSON.stringify({ restaurant: restaurantName, items: payload })}`;

    try {
      const text = await callHaikuLow(prompt, {
        maxTokens: 6000,
        effort: "low",
        disableThinking: true,
      });
      const parsed = parseModelJson<{ items?: unknown }>(text);
      if (!parsed || !Array.isArray(parsed.items)) {
        error = "Ingredient estimate returned an unexpected format.";
        continue;
      }

      for (const raw of parsed.items) {
        if (!raw || typeof raw !== "object") continue;
        const r = raw as Record<string, unknown>;
        const index = toFiniteNumber(r.index);
        if (index == null) continue;
        const estimates = sanitizeEstimates(r.ingredients);
        if (estimates.length > 0) byIndex.set(index, estimates);
      }
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 200) : "Ingredient estimate failed.";
    }
  }

  return { byIndex, error };
}

function sanitizeEstimates(raw: unknown): IngredientEstimate[] {
  if (!Array.isArray(raw)) return [];
  const out: IngredientEstimate[] = [];

  for (const entry of raw.slice(0, 8)) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, MAX_INVENTORY_NAME_LEN) : "";
    const quantity = toFiniteNumber(r.quantity);
    const unit = r.unit === "g" || r.unit === "ml" || r.unit === "each" ? r.unit : null;
    if (!name || quantity == null || quantity <= 0 || !unit) continue;

    out.push({
      name,
      quantity,
      unit,
      par_level: toFiniteNumber(r.par_level),
      storage: typeof r.storage === "string" ? r.storage.slice(0, 40) : null,
      confidence:
        r.confidence === "low" || r.confidence === "medium" || r.confidence === "high"
          ? r.confidence
          : undefined,
    });
  }

  return out;
}

export type InsertedMenuItem = { id: string; name: string };

/**
 * Create/link inventory items and recipe rows for one menu item.
 * Returns warnings for ingredients that could not be linked (unit mismatch).
 */
export async function persistMenuIngredients(
  admin: SupabaseClient,
  orgId: string,
  menuItemId: string,
  estimates: IngredientEstimate[],
): Promise<string[]> {
  if (estimates.length === 0) return [];
  const warnings: string[] = [];

  const { data: existingItems } = await admin
    .from("inventory_items")
    .select("id, name, normalized_name, base_unit, par_level")
    .eq("org_id", orgId)
    .eq("archived", false);

  const itemByName = new Map<string, { id: string; name: string; base_unit: InventoryUnit; par_level: number | null }>();
  for (const item of (existingItems ?? []) as Array<{
    id: string;
    name: string;
    normalized_name: string;
    base_unit: InventoryUnit;
    par_level: number | null;
  }>) {
    itemByName.set(item.normalized_name, item);
  }

  const { data: aliases } = await admin
    .from("inventory_aliases")
    .select("inventory_item_id, normalized_alias")
    .eq("org_id", orgId);
  for (const alias of (aliases ?? []) as Array<{ inventory_item_id: string; normalized_alias: string }>) {
    const item = (existingItems ?? []).find((i: { id: string }) => i.id === alias.inventory_item_id) as
      | { id: string; name: string; base_unit: InventoryUnit; par_level: number | null }
      | undefined;
    if (item) itemByName.set(alias.normalized_alias, item);
  }

  const seen = new Set<string>();

  for (const estimate of estimates.slice(0, MAX_INGREDIENTS_PER_MENU_ITEM)) {
    const normalized = normalizeIngredientName(estimate.name);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    const dimension = unitDimension(estimate.unit);
    if (!dimension) {
      warnings.push(`${estimate.name}: unsupported unit ${estimate.unit}`);
      continue;
    }
    const baseUnit = baseUnitForDimension(dimension);
    const converted = convertToBaseUnit(estimate.quantity, estimate.unit, baseUnit);
    if (!converted.ok) {
      warnings.push(`${estimate.name}: ${converted.error}`);
      continue;
    }
    const parBase =
      estimate.par_level != null
        ? convertToBaseUnit(estimate.par_level, estimate.unit, baseUnit)
        : null;

    let item = itemByName.get(normalized);
    if (!item) {
      const { data: inserted, error } = await admin
        .from("inventory_items")
        .insert({
          org_id: orgId,
          name: estimate.name.slice(0, MAX_INVENTORY_NAME_LEN),
          normalized_name: normalized,
          category: null as string | null,
          base_unit: baseUnit,
          quantity_on_hand: 0,
          par_level: parBase?.ok ? parBase.value : null,
          low_stock_percent: DEFAULT_LOW_STOCK_PERCENT,
          unit_cost: null,
          storage_location: estimate.storage ?? null,
          track_stock: estimate.track_stock ?? true,
          ai_estimated: true,
          source: "menu_scan",
        })
        .select("id, name, base_unit, par_level")
        .single();

      if (error || !inserted) {
        warnings.push(`${estimate.name}: could not create ingredient`);
        continue;
      }
      item = inserted as { id: string; name: string; base_unit: InventoryUnit; par_level: number | null };
      itemByName.set(normalized, item);
    } else if (item.par_level == null && estimate.par_level != null) {
      // Existing ingredient without a par: let the AI supply the initial
      // target, but never overwrite a user-set value.
      const parForItem =
        estimate.par_level != null
          ? convertToBaseUnit(estimate.par_level, estimate.unit, item.base_unit)
          : null;
      if (parForItem?.ok) {
        const { error: parError } = await admin
          .from("inventory_items")
          .update({ par_level: parForItem.value, updated_at: new Date().toISOString() })
          .eq("id", item.id)
          .eq("org_id", orgId);
        if (!parError) item.par_level = parForItem.value;
      }
    }

    const recipeQty = convertToBaseUnit(estimate.quantity, estimate.unit, item.base_unit);
    if (!recipeQty.ok) {
      warnings.push(`${estimate.name}: ${recipeQty.error}`);
      continue;
    }

    const { error: linkError } = await admin.from("menu_item_ingredients").upsert(
      {
        org_id: orgId,
        menu_item_id: menuItemId,
        inventory_item_id: item.id,
        quantity: recipeQty.value,
        ai_estimated: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "menu_item_id,inventory_item_id" },
    );

    if (linkError) {
      warnings.push(`${estimate.name}: could not link recipe`);
    }
  }

  return warnings;
}

export function normalizeEstimateForPreview(raw: unknown): IngredientEstimate[] {
  return sanitizeEstimates(raw);
}

export function categoryOrDefault(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return raw.trim().slice(0, MAX_INVENTORY_CATEGORY_LEN) || null;
}
