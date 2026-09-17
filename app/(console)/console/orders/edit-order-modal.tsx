"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderRecord, OrderItem } from "./orders-list";

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

interface EditOrderModalProps {
  order: OrderRecord;
  orgId: string;
  onOrderUpdated: () => void;
  onClose: () => void;
}

export function EditOrderModal({ order, orgId, onOrderUpdated, onClose }: EditOrderModalProps) {
  const supabase = createClient();
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [extraItems, setExtraItems] = useState<OrderedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Parse table label from customer_name for the extra order name
  const tableLabel = (() => {
    const raw = order.customer_name.replace(/\s+Edit$/, "");
    const match = raw.match(/^(?:Table\s+)?(.+)$/);
    return match ? match[1] : raw;
  })();

  useEffect(() => {
    supabase
      .from("menu_items")
      .select("id, name, price")
      .eq("org_id", orgId)
      .eq("available", true)
      .then(({ data }) => setAllMenuItems(data ?? []));
  }, [orgId, supabase]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const filteredMenuItems = allMenuItems.filter((item) =>
    item.name.toLowerCase().startsWith(searchQuery.toLowerCase()),
  );

  function addItem(menuItem: MenuItem) {
    setExtraItems((prev) => {
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
    setExtraItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
      ),
    );
  }

  function removeItem(index: number) {
    setExtraItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (extraItems.length === 0) {
      setError("Add at least one extra item");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Step 1: Update the original order's total (preserve its items)
      const originalTotal = order.items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0);
      const res = await fetch("/api/orders/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          items: order.items.map((i) => ({ id: i.id, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update order");
        return;
      }

      // Step 2: Create the extra order
      const extraRes = await fetch("/api/orders/extra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: data.orderId,
          tableLabel,
          items: extraItems.map((i) => ({ id: i.menuItemId, quantity: i.quantity })),
          orgId,
        }),
      });
      const extraData = await extraRes.json();
      if (!extraRes.ok) {
        setError(extraData.error || "Failed to create extra order");
        return;
      }

      onOrderUpdated();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const extraTotal = extraItems.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg ticket p-6 bg-[var(--paper-raised)] border border-[var(--rule-strong)] rounded-sm shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-xl text-[var(--ink)] mb-1">Edit Order</h2>
        <p className="text-xs text-[var(--ink-faint)] mb-4">
          {tableLabel} &middot; Order #{order.id.slice(0, 8)}
        </p>

        {/* Current items — read only */}
        <div className="mb-4">
          <p className="label-caps text-[var(--ink-faint)] mb-2">Current Items</p>
          <div className="border border-[var(--rule)] rounded-sm bg-[var(--paper)] overflow-hidden opacity-70">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 border-b border-[var(--rule)] last:border-b-0 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-[var(--ink)] font-medium w-24 truncate">{item.name}</span>
                  <span className="text-[var(--accent)] font-mono text-xs">x{item.quantity}</span>
                </div>
                <span className="text-[var(--ink-soft)] font-mono text-xs">
                  AED {(Number(item.price) * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="px-3 py-2 flex justify-between items-center text-sm border-t border-[var(--rule)]">
              <span className="text-[var(--ink-faint)]">Original total</span>
              <span className="font-bold text-[var(--ink)]">AED {Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Add extra items */}
        <div className="mb-4">
          <p className="label-caps text-[var(--ink-faint)] mb-2">Add Extra Items</p>
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

          {/* Selected extras */}
          {extraItems.length > 0 && (
            <div className="mt-2 border border-[var(--rule)] rounded-sm bg-[var(--paper)] overflow-hidden">
              <div className="px-3 py-2 border-b border-[var(--rule)] label-caps text-[var(--ink-faint)] text-[10px] flex justify-between">
                <span>Extra Items</span>
                <span>Total</span>
              </div>
              {extraItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 border-b border-[var(--rule)] last:border-b-0 text-sm">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => updateQuantity(idx, -1)}
                      className="w-6 h-6 rounded-sm border border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] text-xs flex items-center justify-center">−</button>
                    <span className="text-[var(--ink)] font-medium w-24 truncate">{item.name}</span>
                    <button type="button" onClick={() => updateQuantity(idx, 1)}
                      className="w-6 h-6 rounded-sm border border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] text-xs flex items-center justify-center">+</button>
                    <span className="text-[var(--accent)] font-mono text-xs">x{item.quantity}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--ink-soft)] font-mono text-xs">
                      AED {(item.price * item.quantity).toFixed(2)}
                    </span>
                    <button type="button" onClick={() => removeItem(idx)}
                      className="text-[var(--ink-faint)] hover:text-red-400 text-xs transition-colors" title="Remove item">✕</button>
                  </div>
                </div>
              ))}
              <div className="px-3 py-2 flex justify-between items-center text-sm border-t border-[var(--rule)]">
                <span className="text-[var(--ink-faint)]">Extras total</span>
                <span className="font-bold text-[var(--ink)]">AED {extraTotal.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] border border-[var(--rule)] rounded-sm transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting || extraItems.length === 0}
            className="px-3 py-1.5 text-xs font-medium bg-[var(--accent)] text-[var(--paper)] rounded-sm hover:bg-opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {submitting ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
