"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { InventoryUnit } from "@/types/inventory";

export type InventoryOption = {
  id: string;
  name: string;
  base_unit: InventoryUnit;
  archived?: boolean;
};

type Row = {
  inventory_item_id: string;
  quantity: string;
  ai_estimated: boolean;
};

export function IngredientEditor({
  orgId,
  menuItem,
  inventoryItems,
  onClose,
  onSaved,
}: {
  orgId: string;
  menuItem: { id: string; name: string; deducts_stock: boolean };
  inventoryItems: InventoryOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("menu_item_ingredients")
      .select("inventory_item_id, quantity, ai_estimated")
      .eq("org_id", orgId)
      .eq("menu_item_id", menuItem.id)
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setError("Could not load this recipe.");
        } else {
          setRows(
            ((data ?? []) as Array<{
              inventory_item_id: string;
              quantity: number | string;
              ai_estimated: boolean;
            }>).map((r) => ({
              inventory_item_id: r.inventory_item_id,
              quantity: String(r.quantity),
              ai_estimated: r.ai_estimated,
            })),
          );
        }
        setLoading(false);
      });
  }, [menuItem.id, orgId]);

  function addRow() {
    const used = new Set(rows.map((r) => r.inventory_item_id));
    const next = inventoryItems.find((i) => !used.has(i.id));
    if (!next) return;
    setRows((prev) => [...prev, { inventory_item_id: next.id, quantity: "1", ai_estimated: false }]);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);

    const payload = rows
      .filter((r) => r.inventory_item_id && Number(r.quantity) > 0)
      .map((r) => ({
        inventory_item_id: r.inventory_item_id,
        quantity: Number(r.quantity),
        ai_estimated: r.ai_estimated,
      }));

    if (payload.length !== rows.length) {
      setError("Every ingredient needs a quantity greater than zero.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/menu/items/${menuItem.id}/ingredients`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, ingredients: payload }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not save the recipe.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-2xl ticket p-5 my-auto">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="font-display text-lg">Recipe — {menuItem.name}</h2>
            <p className="text-xs text-[var(--ink-faint)] mt-1">
              Quantities are for one serving, in the ingredient&apos;s base unit.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost text-xs py-1">
            Close
          </button>
        </div>

        {!menuItem.deducts_stock && (
          <div className="rounded-sm border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 mb-3">
            This item is marked third-party/outsourced. The recipe is for reference and costing
            only — it will not deduct stock.
          </div>
        )}

        {inventoryItems.length === 0 ? (
          <div className="rounded-sm border border-dashed border-[var(--rule)] p-6 text-sm text-[var(--ink-faint)]">
            No ingredients exist yet.{" "}
            <Link href={`/console/inventory?org=${orgId}`} className="underline">
              Add ingredients first
            </Link>
            , then come back to build this recipe.
          </div>
        ) : loading ? (
          <p className="text-sm text-[var(--ink-faint)]">Loading recipe…</p>
        ) : (
          <div className="space-y-2">
            {rows.length === 0 && (
              <p className="text-sm text-[var(--ink-faint)]">
                No ingredients linked yet. Add the first one below.
              </p>
            )}
            {rows.map((row, index) => {
              const selected = inventoryItems.find((i) => i.id === row.inventory_item_id);
              return (
                <div key={`${row.inventory_item_id}-${index}`} className="flex flex-wrap items-center gap-2 rounded-sm border border-[var(--rule)] p-2">
                  <select
                    className="input flex-1 min-w-[180px]"
                    value={row.inventory_item_id}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, inventory_item_id: e.target.value } : r)),
                      )
                    }
                  >
                    {inventoryItems.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name} ({inv.base_unit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input w-28"
                    value={row.quantity}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, quantity: e.target.value } : r)),
                      )
                    }
                  />
                  <span className="text-xs text-[var(--ink-faint)] w-10">{selected?.base_unit ?? ""}</span>
                  {row.ai_estimated && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-purple-300 bg-purple-50 text-purple-700">
                      AI
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                    className="btn btn-ghost text-xs py-1 text-red-600"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            <button type="button" onClick={addRow} className="btn btn-outline text-xs">
              + Add ingredient
            </button>
          </div>
        )}

        {error && <p className="text-sm rounded-sm bg-red-600 text-white px-3 py-2 mt-3">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || inventoryItems.length === 0}
            className="btn btn-accent"
          >
            {saving ? "Saving…" : "Save recipe"}
          </button>
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
