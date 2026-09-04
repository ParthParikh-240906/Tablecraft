"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface MenuItem {
  id: string;
  name: string;
  price: number;
}

interface OrderedItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

interface AddOrderModalProps {
  orgId: string;
  onOrderCreated: () => void;
  onClose: () => void;
}

export function AddOrderModal({ orgId, onOrderCreated, onClose }: AddOrderModalProps) {
  const supabase = createClient();
  const [tables, setTables] = useState<{ id: string; label: string }[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [items, setItems] = useState<OrderedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("tables")
      .select("id, label")
      .eq("org_id", orgId)
      .order("label")
      .then(({ data }) => setTables((data ?? []) as any));

    supabase
      .from("menu_items")
      .select("id, name, price")
      .eq("org_id", orgId)
      .eq("available", true)
      .then(({ data }) => setAllMenuItems(data ?? []));
  }, [orgId, supabase]);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const filteredMenuItems = allMenuItems.filter((item) =>
    item.name.toLowerCase().startsWith(searchQuery.toLowerCase()),
  );

  function addItem(menuItem: MenuItem) {
    setItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === menuItem.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { menuItemId: menuItem.id, name: menuItem.name, price: menuItem.price, quantity: 1 }];
    });
    setSearchQuery("");
  }

  function updateQuantity(index: number, delta: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
      ),
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!selectedTable) {
      setError("Please select a table");
      return;
    }
    if (items.length === 0) {
      setError("Please add at least one item");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTable,
          items: items.map((i) => ({ id: i.menuItemId, quantity: i.quantity })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create order");
        return;
      }

      setItems([]);
      setSelectedTable("");
      onOrderCreated();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg ticket p-6 bg-[var(--paper-raised)] border border-[var(--rule-strong)] rounded-sm shadow-2xl">
        <h2 className="font-display text-xl text-[var(--ink)] mb-5">Add Table Order</h2>

        {/* Table selector */}
        <div className="mb-4">
          <label className="label-caps text-[var(--ink-faint)] mb-1.5 block">Table</label>
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="w-full bg-[var(--paper)] border border-[var(--rule)] rounded-sm px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">Select a table…</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Menu item search */}
        <div className="mb-4">
          <label className="label-caps text-[var(--ink-faint)] mb-1.5 block">Menu Item</label>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type to search…"
            className="w-full bg-[var(--paper)] border border-[var(--rule)] rounded-sm px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)]"
          />
          {searchQuery && filteredMenuItems.length > 0 && (
            <ul className="mt-1 border border-[var(--rule)] border-t-0 rounded-b-sm bg-[var(--paper)] max-h-40 overflow-y-auto">
              {filteredMenuItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => addItem(item)}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--paper-overlay)] flex justify-between items-center transition-colors"
                  >
                    <span>{item.name}</span>
                    <span className="text-[var(--accent)] font-mono text-xs">AED {Number(item.price).toFixed(2)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchQuery && filteredMenuItems.length === 0 && (
            <p className="text-xs text-[var(--ink-faint)] mt-1">No items match &ldquo;{searchQuery}&rdquo;</p>
          )}
        </div>

        {/* Selected items list */}
        {items.length > 0 && (
          <div className="mb-4 border border-[var(--rule)] rounded-sm bg-[var(--paper)] overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--rule)] label-caps text-[var(--ink-faint)] text-[10px] flex justify-between">
              <span>Items</span>
              <span>Total</span>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 border-b border-[var(--rule)] last:border-b-0 text-sm">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => updateQuantity(idx, -1)}
                    className="w-6 h-6 rounded-sm border border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] text-xs flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="text-[var(--ink)] font-medium w-24 truncate">{item.name}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(idx, 1)}
                    className="w-6 h-6 rounded-sm border border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] text-xs flex items-center justify-center"
                  >
                    +
                  </button>
                  <span className="text-[var(--accent)] font-mono text-xs">x{item.quantity}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--ink-soft)] font-mono text-xs">
                    AED {(item.price * item.quantity).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-[var(--ink-faint)] hover:text-red-400 text-xs transition-colors"
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <div className="px-3 py-2 flex justify-between items-center text-sm border-t border-[var(--rule)]">
              <span className="text-[var(--ink-faint)]">Order total</span>
              <span className="font-bold text-[var(--ink)]">AED {total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 mb-3">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] border border-[var(--rule)] rounded-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedTable || items.length === 0}
            className="px-3 py-1.5 text-xs font-medium bg-[var(--accent)] text-[var(--paper)] rounded-sm hover:bg-opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Creating…" : "Create Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
