"use client";

import { useEffect, useState } from "react";
import type { InventoryItem, InventoryUnit } from "@/types/inventory";
import { DEFAULT_LOW_STOCK_PERCENT } from "@/lib/inventory";

type Props = {
  orgId: string;
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: () => void;
};

const EMPTY = {
  name: "",
  category: "",
  base_unit: "g" as InventoryUnit,
  quantity_on_hand: "0",
  par_level: "",
  low_stock_percent: String(DEFAULT_LOW_STOCK_PERCENT),
  unit_cost: "",
  storage_location: "pantry",
  track_stock: true,
};

export function InventoryItemModal({ orgId, item, onClose, onSaved }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unitChanged = !!item && form.base_unit !== item.base_unit;

  useEffect(() => {
    if (!item) {
      setForm(EMPTY);
      return;
    }
    setForm({
      name: item.name,
      category: item.category ?? "",
      base_unit: item.base_unit,
      quantity_on_hand: String(item.quantity_on_hand),
      par_level: item.par_level == null ? "" : String(item.par_level),
      low_stock_percent: String(item.low_stock_percent ?? DEFAULT_LOW_STOCK_PERCENT),
      unit_cost: item.unit_cost == null ? "" : String(item.unit_cost),
      storage_location: item.storage_location ?? "",
      track_stock: item.track_stock,
    });
  }, [item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      org_id: orgId,
      name: form.name.trim(),
      category: form.category.trim() || null,
      par_level: form.par_level.trim() === "" ? null : Number(form.par_level),
      low_stock_percent: Number(form.low_stock_percent),
      unit_cost: form.unit_cost.trim() === "" ? null : Number(form.unit_cost),
      storage_location: form.storage_location.trim() || null,
      track_stock: form.track_stock,
      base_unit: form.base_unit,
    };

    if (!item) {
      payload.quantity_on_hand = Number(form.quantity_on_hand) || 0;
    }

    if (unitChanged) {
      const ok = window.confirm(
        `Change the base unit from "${item.base_unit}" to "${form.base_unit}"?\n\n` +
          `Existing stock, par level, and recipe quantities will be reinterpreted as the new unit. ` +
          `They are NOT converted automatically. Review the recipes after saving.`,
      );
      if (!ok) {
        setSaving(false);
        return;
      }
      payload.confirm_base_unit_change = true;
    }

    if (!payload.name) {
      setError("Name is required.");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(Number(payload.low_stock_percent))) {
      setError("Low-stock percentage must be a number.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(
        item ? `/api/inventory/items/${item.id}` : "/api/inventory/items",
        {
          method: item ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not save the ingredient.");
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
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl ticket p-5 space-y-4 my-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">{item ? "Edit ingredient" : "New ingredient"}</h2>
            <p className="text-xs text-[var(--ink-faint)] mt-1">
              Par level is the target quantity you want on hand, not a maximum.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost text-xs py-1">
            Close
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs sm:col-span-2">
            <span className="block mb-1 text-[var(--ink-soft)]">Name</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Basmati rice"
              required
            />
          </label>

          <label className="text-xs">
            <span className="block mb-1 text-[var(--ink-soft)]">Category</span>
            <input
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Produce, Dairy, Dry Goods…"
            />
          </label>

          <label className="text-xs">
            <span className="block mb-1 text-[var(--ink-soft)]">Base unit</span>
            <select
              className="input"
              value={form.base_unit}
              onChange={(e) => setForm({ ...form, base_unit: e.target.value as InventoryUnit })}
            >
              <option value="g">g (mass)</option>
              <option value="ml">ml (volume)</option>
              <option value="each">each (count)</option>
            </select>
            {unitChanged && (
              <span className="block mt-1 text-[10px] text-amber-700">
                Changing the unit reinterprets existing stock, par, and recipe quantities. Values are
                not converted automatically.
              </span>
            )}
          </label>

          {!item && (
            <label className="text-xs">
              <span className="block mb-1 text-[var(--ink-soft)]">Opening stock ({form.base_unit})</span>
              <input
                type="number"
                step="any"
                min="0"
                className="input"
                value={form.quantity_on_hand}
                onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })}
              />
            </label>
          )}

          <label className="text-xs">
            <span className="block mb-1 text-[var(--ink-soft)]">Par level ({form.base_unit}, target on hand)</span>
            <input
              type="number"
              step="any"
              min="0"
              className="input"
              value={form.par_level}
              onChange={(e) => setForm({ ...form, par_level: e.target.value })}
              placeholder="e.g. 5000"
            />
          </label>

          <label className="text-xs">
            <span className="block mb-1 text-[var(--ink-soft)]">Low-stock threshold (%)</span>
            <input
              type="number"
              step="1"
              min="1"
              max="100"
              className="input"
              value={form.low_stock_percent}
              onChange={(e) => setForm({ ...form, low_stock_percent: e.target.value })}
            />
          </label>

          <label className="text-xs">
            <span className="block mb-1 text-[var(--ink-soft)]">Unit cost (optional)</span>
            <input
              type="number"
              step="any"
              min="0"
              className="input"
              value={form.unit_cost}
              onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
            />
          </label>

          <label className="text-xs">
            <span className="block mb-1 text-[var(--ink-soft)]">Storage location</span>
            <input
              className="input"
              value={form.storage_location}
              onChange={(e) => setForm({ ...form, storage_location: e.target.value })}
              placeholder="pantry, fridge, freezer, bar"
            />
          </label>
        </div>

        <label className="flex items-start gap-2 text-xs rounded-sm border border-[var(--rule)] p-3">
          <input
            type="checkbox"
            checked={form.track_stock}
            onChange={(e) => setForm({ ...form, track_stock: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Track this ingredient&apos;s stock</span>
            <span className="block text-[10px] text-[var(--ink-faint)] mt-0.5">
              Turn off for items you never count. Untracked ingredients never alert or deduct.
            </span>
          </span>
        </label>

        {error && (
          <p className="text-sm rounded-sm bg-red-600 text-white px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn btn-accent">
            {saving ? "Saving…" : "Save ingredient"}
          </button>
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
