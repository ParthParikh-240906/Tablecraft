"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  formatQuantity,
  getStockStatus,
  stockPercent,
  stockStatusTone,
  statusLabel,
} from "@/lib/inventory";
import type { InventoryItem } from "@/types/inventory";
import { AdjustStockModal } from "./adjust-stock-modal";
import { InventoryItemModal } from "./inventory-item-modal";
import { InventoryScanModal } from "./inventory-scan-modal";

type Filter = "all" | "low" | "out" | "untracked";

type HistoryRow = {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  note: string | null;
  created_at: string;
};

export function InventoryManager({
  orgId,
  initialFilter,
}: {
  orgId: string;
  initialFilter: string;
}) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>(normalizeFilter(initialFilter));

  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [adjust, setAdjust] = useState<{ item: InventoryItem; mode: "add" | "remove" | "set" } | null>(null);
  const [showScan, setShowScan] = useState(false);

  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("org_id", orgId)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      setLoadError(
        "Could not load inventory. If this is the first run, apply migration 0040_inventory.sql.",
      );
      setItems([]);
    } else {
      setLoadError(null);
      setItems((data ?? []) as InventoryItem[]);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`inventory-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_items",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, refresh]);

  const activeItems = useMemo(() => items.filter((i) => !i.archived), [items]);
  const counts = useMemo(() => {
    let low = 0;
    let out = 0;
    let untracked = 0;
    for (const item of activeItems) {
      const status = getStockStatus(item);
      if (status === "low") low++;
      if (status === "out") out++;
      if (status === "untracked") untracked++;
    }
    return { low, out, untracked };
  }, [activeItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      // Legacy rows: archive is no longer exposed. Migration 0041 clears it.
      if (item.archived) return false;

      const status = getStockStatus(item);
      if (filter === "low" && status !== "low") return false;
      if (filter === "out" && status !== "out") return false;
      if (filter === "untracked" && status !== "untracked") return false;

      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.category ?? "").toLowerCase().includes(q) ||
        (item.storage_location ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, InventoryItem[]>();
    for (const item of filtered) {
      const cat = item.category || "Uncategorized";
      const list = map.get(cat) ?? [];
      list.push(item);
      map.set(cat, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function afterMutation() {
    setActionError(null);
    void refresh();
    window.dispatchEvent(new CustomEvent("inventory:changed", { detail: { orgId } }));
  }

  async function deleteItem(item: InventoryItem) {
    const ok = window.confirm(
      `Delete "${item.name}"?\n\n` +
        `This removes the ingredient from every recipe and deletes its stock history. ` +
        `This cannot be undone.`,
    );
    if (!ok) return;

    setActionError(null);
    try {
      const res = await fetch(`/api/inventory/items/${item.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setActionError(data?.error ?? "Could not delete the ingredient.");
        return;
      }
      afterMutation();
    } catch {
      setActionError("Network error — please try again.");
    }
  }

  async function openHistory(item: InventoryItem) {
    setHistoryItem(item);
    setHistoryRows([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/inventory/items/${item.id}/history?org_id=${encodeURIComponent(orgId)}`,
      );
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.transactions)) {
        setHistoryRows(data.transactions as HistoryRow[]);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--ink-faint)]">Loading inventory…</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-xl">Inventory</h1>
          <p className="text-xs text-[var(--ink-faint)] mt-1">
            Ingredient stock, recipes, and purchase scans for this restaurant.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowScan(true)} className="btn btn-outline">
            Scan bill / list
          </button>
          <button type="button" onClick={() => setShowAdd(true)} className="btn btn-accent">
            + Add ingredient
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-sm border border-red-300 bg-red-50 p-3 text-xs text-red-800 flex items-start justify-between gap-2">
          <span>{loadError}</span>
          <button type="button" onClick={() => void refresh()} className="underline shrink-0">
            Retry
          </button>
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-sm border border-red-300 bg-red-50 p-3 text-xs text-red-800 flex items-start justify-between gap-2">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Active" value={activeItems.length} sub="ingredients" />
        <SummaryCard label="Low stock" value={counts.low} sub="at or below 75% of par" tone={counts.low > 0 ? "amber" : undefined} />
        <SummaryCard label="Out of stock" value={counts.out} sub="needs reorder" tone={counts.out > 0 ? "red" : undefined} />
        <SummaryCard label="Untracked" value={counts.untracked} sub="reference only" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-4">
        <input
          className="input sm:max-w-xs"
          placeholder="Search ingredients, category, storage…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {(["all", "low", "out", "untracked"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`btn text-xs py-1 ${filter === f ? "btn-accent" : "btn-outline"}`}
            >
              {f === "all" ? "All" : f === "low" ? "Low" : f === "out" ? "Out" : "Untracked"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-sm border border-dashed border-[var(--rule)] p-10 text-center text-sm text-[var(--ink-faint)]">
          {items.length === 0
            ? "No ingredients yet. Scan a supplier bill or add your first ingredient."
            : "No ingredients match this filter."}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([category, categoryItems]) => (
            <section key={category} className="rounded-sm border border-[var(--rule)] overflow-hidden">
              <header className="flex items-center justify-between gap-3 bg-[var(--paper)] px-3 py-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                  {category}
                </h2>
                <span className="text-[10px] text-[var(--ink-faint)]">{categoryItems.length}</span>
              </header>
              <div className="divide-y divide-[var(--rule)]">
                {categoryItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onAdd={() => setAdjust({ item, mode: "add" })}
                    onRemove={() => setAdjust({ item, mode: "remove" })}
                    onSet={() => setAdjust({ item, mode: "set" })}
                    onEdit={() => setEditItem(item)}
                    onHistory={() => void openHistory(item)}
                    onDelete={() => void deleteItem(item)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {showAdd && (
        <InventoryItemModal
          orgId={orgId}
          item={null}
          onClose={() => setShowAdd(false)}
          onSaved={afterMutation}
        />
      )}
      {editItem && (
        <InventoryItemModal
          orgId={orgId}
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={afterMutation}
        />
      )}
      {adjust && (
        <AdjustStockModal
          orgId={orgId}
          item={adjust.item}
          initialMode={adjust.mode}
          onClose={() => setAdjust(null)}
          onSaved={afterMutation}
        />
      )}
      {showScan && (
        <InventoryScanModal
          orgId={orgId}
          onClose={() => setShowScan(false)}
          onDone={afterMutation}
        />
      )}

      {historyItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-2xl ticket p-5 my-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="font-display text-lg">Stock history</h2>
                <p className="text-xs text-[var(--ink-faint)]">{historyItem.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryItem(null)}
                className="btn btn-ghost text-xs py-1"
              >
                Close
              </button>
            </div>
            {historyLoading ? (
              <p className="text-sm text-[var(--ink-faint)]">Loading…</p>
            ) : historyRows.length === 0 ? (
              <p className="text-sm text-[var(--ink-faint)]">No stock movements yet.</p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-left text-[var(--ink-soft)] border-b border-[var(--rule)]">
                      <th className="py-2 pr-2">When</th>
                      <th className="py-2 pr-2">Reason</th>
                      <th className="py-2 pr-2 text-right">Change</th>
                      <th className="py-2 pr-2 text-right">Balance</th>
                      <th className="py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row) => (
                      <tr key={row.id} className="border-b border-[var(--rule)]">
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="py-2 pr-2 capitalize">{row.reason.replace(/_/g, " ")}</td>
                        <td className={`py-2 pr-2 text-right tabular-nums ${row.delta < 0 ? "text-red-600" : "text-emerald-700"}`}>
                          {row.delta > 0 ? "+" : ""}
                          {row.delta}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">{row.balance_after}</td>
                        <td className="py-2 text-[var(--ink-soft)]">{row.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone?: "amber" | "red";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-300 bg-red-50 text-red-800"
      : tone === "amber"
        ? "border-amber-300 bg-amber-50 text-amber-800"
        : "border-[var(--rule)] bg-[var(--paper-raised)] text-[var(--ink)]";
  return (
    <div className={`rounded-sm border p-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="font-display text-2xl leading-tight mt-1 tabular-nums">{value}</p>
      <p className="text-[10px] opacity-70 mt-0.5">{sub}</p>
    </div>
  );
}

function ItemRow({
  item,
  onAdd,
  onRemove,
  onSet,
  onEdit,
  onHistory,
  onDelete,
}: {
  item: InventoryItem;
  onAdd: () => void;
  onRemove: () => void;
  onSet: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onDelete: () => void;
}) {
  const status = getStockStatus(item);
  const pct = stockPercent(item);

  return (
    <div className="p-3">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-sm truncate">{item.name}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${stockStatusTone(status)}`}>
              {statusLabel(status)}
            </span>
            {item.ai_estimated && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-purple-300 bg-purple-50 text-purple-700">
                AI estimate
              </span>
            )}
            {!item.track_stock && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-300 bg-neutral-100 text-neutral-600">
                Not tracked
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--ink-faint)] mt-0.5">
            {item.category ?? "Uncategorized"}
            {item.storage_location ? ` · ${item.storage_location}` : ""}
          </p>
          <div className="mt-2 max-w-sm">
            <div className="h-1.5 rounded-full bg-[var(--rule)] overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  status === "out" ? "bg-red-500" : status === "low" ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${pct ?? 0}%` }}
              />
            </div>
            <p className="text-[10px] text-[var(--ink-faint)] mt-1">
              {formatQuantity(item.quantity_on_hand, item.base_unit)}
              {item.par_level != null
                ? ` of ${formatQuantity(item.par_level, item.base_unit)} par`
                : " · no par set"}
              {pct != null ? ` · ${Math.round(pct)}%` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={onRemove} className="btn btn-outline text-xs py-1 px-2" title="Remove stock">
            −
          </button>
          <button type="button" onClick={onAdd} className="btn btn-outline text-xs py-1 px-2" title="Add stock">
            +
          </button>
          <button type="button" onClick={onSet} className="btn btn-outline text-xs py-1 px-2">
            Count
          </button>
          <button type="button" onClick={onHistory} className="btn btn-ghost text-xs py-1 px-2">
            History
          </button>
          <button type="button" onClick={onEdit} className="btn btn-ghost text-xs py-1 px-2">
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="btn btn-ghost text-xs py-1 px-2 text-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeFilter(value: string): Filter {
  return value === "low" || value === "out" || value === "untracked" ? value : "all";
}
