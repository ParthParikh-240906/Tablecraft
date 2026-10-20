import { parseModelJson } from "@/lib/ai-json";
import {
  MAX_INVENTORY_CATEGORY_LEN,
  MAX_INVENTORY_NAME_LEN,
  normalizeIngredientName,
  toFiniteNumber,
} from "@/lib/inventory";
import type {
  InventoryAlias,
  InventoryItem,
  InventoryScanLine,
  InventoryScanPreview,
} from "@/types/inventory";

export const MAX_SCAN_LINES = 200;

export const INVENTORY_SCAN_PROMPT = `You are a restaurant inventory parser. Read this image of a supplier bill, receipt, invoice, or handwritten shopping list and extract the purchased ingredient lines.

Return ONLY valid JSON with this exact structure:
{
  "document_type": "receipt",
  "currency": "AED",
  "items": [
    {
      "name": "Tomatoes",
      "quantity": 12,
      "unit": "kg",
      "par_level": 10,
      "unit_price": 8.5,
      "total_price": 102,
      "category": "Produce",
      "supplier": "Fresh Farms",
      "expiry_date": null,
      "confidence": "high"
    }
  ]
}

Rules:
- Extract purchased line items only. Ignore subtotal, tax, VAT, delivery, discounts, payment lines, and loyalty text.
- Prefer units g, ml, or each. Keep the readable original unit if it is something else (kg, L, box, packet).
- If a pack size is readable, infer the total quantity (e.g. "2 x 5 kg" → 10 kg).
- par_level is a suggested target quantity on hand for a one-week ordering cycle, in the same unit. It is a rough default the user can edit.
- Do not invent prices. unit_price and total_price are optional and may be null.
- category should be one of: Produce, Dairy, Meat & Seafood, Dry Goods, Bakery, Beverage, Frozen, Packaging, Other.
- Handwritten shorthand is allowed; write the most readable ingredient name.
- confidence must be low, medium, or high.
- Return ONLY JSON, no other text.`;

type RawScan = {
  document_type?: unknown;
  currency?: unknown;
  items?: unknown;
};

export function normalizeInventoryScan(rawText: string): InventoryScanPreview | null {
  const parsed = parseModelJson<RawScan>(rawText);
  if (!parsed || !Array.isArray(parsed.items)) return null;

  const lines: InventoryScanLine[] = [];
  for (const raw of parsed.items.slice(0, MAX_SCAN_LINES)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, MAX_INVENTORY_NAME_LEN) : "";
    const quantity = toFiniteNumber(r.quantity);
    const unit = typeof r.unit === "string" ? r.unit.trim().slice(0, 24) : "each";
    if (!name || quantity == null || quantity <= 0) continue;

    const confidence =
      r.confidence === "low" || r.confidence === "medium" || r.confidence === "high"
        ? r.confidence
        : undefined;

    lines.push({
      name,
      quantity,
      unit: unit || "each",
      par_level: toFiniteNumber(r.par_level),
      unit_price: toFiniteNumber(r.unit_price),
      total_price: toFiniteNumber(r.total_price),
      category:
        typeof r.category === "string"
          ? r.category.trim().slice(0, MAX_INVENTORY_CATEGORY_LEN)
          : null,
      supplier: typeof r.supplier === "string" ? r.supplier.trim().slice(0, 200) : null,
      expiry_date: typeof r.expiry_date === "string" ? r.expiry_date.slice(0, 40) : null,
      confidence,
    });
  }

  if (lines.length === 0) return null;

  return {
    document_type: typeof parsed.document_type === "string" ? parsed.document_type : null,
    currency: typeof parsed.currency === "string" ? parsed.currency : null,
    lines,
  };
}

export type MatchableInventory = Pick<InventoryItem, "id" | "name" | "normalized_name" | "base_unit" | "quantity_on_hand" | "par_level">;

export function matchInventoryLines(
  lines: InventoryScanLine[],
  items: MatchableInventory[],
  aliases: Pick<InventoryAlias, "alias" | "normalized_alias" | "inventory_item_id">[],
): InventoryScanLine[] {
  const byName = new Map<string, MatchableInventory>();
  for (const item of items) byName.set(item.normalized_name, item);
  for (const alias of aliases) {
    const item = items.find((i) => i.id === alias.inventory_item_id);
    if (item) byName.set(alias.normalized_alias, item);
  }

  return lines.map((line) => {
    const normalized = normalizeIngredientName(line.name);
    const match = byName.get(normalized) ?? findFuzzyMatch(normalized, items);
    return {
      ...line,
      matched_item_id: match?.id ?? null,
      matched_name: match?.name ?? null,
      create_new: !match,
    };
  });
}

function findFuzzyMatch(normalized: string, items: MatchableInventory[]): MatchableInventory | null {
  if (normalized.length < 3) return null;

  let best: MatchableInventory | null = null;
  let bestScore = 0;

  for (const item of items) {
    const score = similarity(normalized, item.normalized_name);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore >= 0.86 ? best : null;
}

/** Small Dice-coefficient similarity for names. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const gram = a.slice(i, i + 2);
    bigrams.set(gram, (bigrams.get(gram) ?? 0) + 1);
  }
  let overlap = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const gram = b.slice(i, i + 2);
    const count = bigrams.get(gram) ?? 0;
    if (count > 0) {
      bigrams.set(gram, count - 1);
      overlap++;
    }
  }
  return (2 * overlap) / (a.length - 1 + b.length - 1);
}
