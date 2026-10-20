"use client";

import { useEffect, useState } from "react";
import type { InventoryItem, InventoryReason } from "@/types/inventory";
import { formatQuantity } from "@/lib/inventory";

type Props = {
  orgId: string;
  item: InventoryItem;
  initialMode?: "add" | "remove" | "set";
  onClose: () => void;
  onSaved: () => void;
};

export function AdjustStockModal({ orgId, item, initialMode = "add", onClose, onSaved }: Props) {
  const [mode, setMode] = useState<"add" | "remove" | "set">(initialMode);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<InventoryReason>(
    initialMode === "remove" ? "usage" : initialMode === "set" ? "adjustment" : "purchase",
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setReason(initialMode === "remove" ? "usage" : initialMode === "set" ? "adjustment" : "purchase");
    setQuantity("");
    setNote("");
    setError(null);
  }, [initialMode, item.id]);

  const numeric = Number(quantity);
  const preview =
    Number.isFinite(numeric) && quantity !== ""
      ? mode === "set"
        ? numeric
        : item.quantity_on_hand + (mode === "remove" ? -numeric : numeric)
      : item.quantity_on_hand;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!Number.isFinite(numeric) || numeric < 0 || (mode !== "set" && numeric === 0)) {
      setError("Enter a positive quantity.");
      return;
    }
    setSaving(true);

    const payloadQuantity = mode === "set" ? numeric : mode === "remove" ? -numeric : numeric;

    try {
      const res = await fetch(`/api/inventory/items/${item.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          mode: mode === "set" ? "set" : "delta",
          quantity: payloadQuantity,
          reason,
          note: note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not update stock.");
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
      <form onSubmit={handleSubmit} className="w-full max-w-md ticket p-5 space-y-4 my-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">Adjust stock</h2>
            <p className="text-xs text-[var(--ink-faint)] mt-1">{item.name}</p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost text-xs py-1">
            Close
          </button>
        </div>

        <div className="rounded-sm border border-[var(--rule)] bg-[var(--paper)] p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--ink-soft)]">Current</span>
            <span className="font-medium">{formatQuantity(item.quantity_on_hand, item.base_unit)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[var(--ink-soft)]">After</span>
            <span className="font-medium">{formatQuantity(preview, item.base_unit)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(["add", "remove", "set"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setReason(m === "remove" ? "usage" : m === "set" ? "adjustment" : "purchase");
              }}
              className={`btn text-xs py-1.5 ${mode === m ? "btn-accent" : "btn-outline"}`}
            >
              {m === "add" ? "Add" : m === "remove" ? "Remove" : "Set exact"}
            </button>
          ))}
        </div>

        <label className="text-xs block">
          <span className="block mb-1 text-[var(--ink-soft)]">
            Quantity ({item.base_unit})
          </span>
          <input
            type="number"
            step="any"
            min="0"
            className="input"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={mode === "set" ? "Counted quantity" : "Amount"}
            required
          />
        </label>

        <label className="text-xs block">
          <span className="block mb-1 text-[var(--ink-soft)]">Reason</span>
          <select
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value as InventoryReason)}
          >
            <option value="purchase">Purchase / delivery</option>
            <option value="usage">Used in service</option>
            <option value="waste">Waste / spoilage</option>
            <option value="adjustment">Stocktake correction</option>
          </select>
        </label>

        <label className="text-xs block">
          <span className="block mb-1 text-[var(--ink-soft)]">Note (optional)</span>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Friday delivery, spilled prep"
          />
        </label>

        {error && <p className="text-sm rounded-sm bg-red-600 text-white px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn btn-accent">
            {saving ? "Saving…" : "Save adjustment"}
          </button>
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
