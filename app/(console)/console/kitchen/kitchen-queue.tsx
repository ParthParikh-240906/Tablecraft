"use client";

import { useState } from "react";
import { useOrdersRealtime } from "@/lib/orders-realtime";
import type { OrderRecord } from "../orders/orders-list";

interface Item {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  customer_name: string;
  items: Item[];
  total: number;
  status: string;
  created_at: string;
}

// Bridge: filter out completed/paid/cancelled for kitchen display
function filterKitchenOrders(orders: OrderRecord[]): Order[] {
  return orders
    .filter((o) => !["completed", "paid", "cancelled"].includes(o.status))
    .map((o) => ({
      id: o.id,
      customer_name: o.customer_name,
      items: Array.isArray(o.items) ? o.items : [],
      total: o.total,
      status: o.status,
      created_at: o.created_at,
    }));
}

export function KitchenQueue({ initialOrders, orgId }: { initialOrders: Order[]; orgId: string }) {
  const initialOrdersRecord: OrderRecord[] = initialOrders.map((o) => ({
    id: o.id,
    customer_name: o.customer_name,
    total: o.total,
    status: o.status,
    created_at: o.created_at,
    items: o.items,
  }));
  const { orders: realtimeOrders } = useOrdersRealtime(orgId, initialOrdersRecord);
  const orders = filterKitchenOrders(realtimeOrders);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdatingId(orderId);
    setActionError(null);
    try {
      const res = await fetch("/api/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      if (res.ok) {
        // Hook will pick up the change via realtime/polling
        if (newStatus === "cancelled") {
          setExpandedId(null);
        }
      } else {
        const data = await res.json().catch(() => null);
        setActionError(data?.error || `Failed to update order status (${res.status}). Try again.`);
      }
    } catch {
      setActionError("Network error updating status — check connection and retry.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(orderId: string) {
    if (!confirm("Delete this order permanently?")) return;
    setDeletingId(orderId);
    setActionError(null);
    try {
      const res = await fetch("/api/orders/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (res.ok) {
        // Hook will pick up the change via realtime/polling
        setExpandedId(null);
      } else {
        const data = await res.json().catch(() => null);
        setActionError(data?.error || `Failed to delete order (${res.status}). Try again.`);
      }
    } catch {
      setActionError("Network error deleting order — check connection and retry.");
    } finally {
      setDeletingId(null);
    }
  }

  const getStatusBorder = (status: string) => {
    switch (status) {
      case "pending":
      case "paid": return "border-l-amber-500";
      case "preparing": return "border-l-blue-500";
      case "ready": return "border-l-green-500";
      default: return "border-l-[var(--rule)]";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
      case "paid": return "text-amber-400";
      case "preparing": return "text-blue-400";
      case "ready": return "text-green-400";
      default: return "text-[var(--ink-faint)]";
    }
  };

  if (orders.length === 0) {
    return (
      <div className="ticket p-12 text-center text-[var(--ink-soft)]">
        <p className="font-display text-lg mb-1">No open tickets</p>
        <p className="text-xs">Kitchen is quiet — all orders completed.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] text-[var(--ink-faint)]">{orders.length} open ticket{orders.length > 1 ? "s" : ""}</span>
      </div>
      {actionError && (
        <div className="mb-3 rounded-sm border border-red-800 bg-red-950/40 p-2 text-xs text-red-300 flex items-center justify-between gap-2">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="underline shrink-0">Dismiss</button>
        </div>
      )}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {orders.map((order) => {
        const isExpanded = expandedId === order.id;
        const createdDate = new Date(order.created_at);
        const validDate = !isNaN(createdDate.getTime());
        const timeStr = validDate ? createdDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
        const ageMinutes = validDate ? Math.floor((Date.now() - createdDate.getTime()) / 60000) : null;

        return (
          <div key={order.id}>
            {/* Ticket card — clickable to expand */}
            <div
              className={`ticket p-4 cursor-pointer transition-all border-l-4 ${
                isExpanded
                  ? `border-[var(--accent)] bg-[var(--paper-overlay)]`
                  : `border-[var(--rule)] bg-[var(--paper-raised)] hover:border-[var(--rule-strong)] ${getStatusBorder(order.status)}`
              }`}
              onClick={() => setExpandedId(isExpanded ? null : order.id)}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-bold text-[var(--ink)] truncate">
                    {order.customer_name.replace(/\s+Edit$/, "").replace(/^Table\s+/i, "")}
                  </p>
                  <p className="text-[10px] text-[var(--ink-faint)] mt-0.5">
                    {timeStr} &middot; {ageMinutes === null ? "time unknown" : `${ageMinutes}m ago`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                  {order.customer_name.trimEnd().endsWith(" Edit") && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/15 text-amber-400">
                      Edited
                    </span>
                  )}
                </div>
              </div>

              {/* Items preview (collapsed) */}
              <div className="space-y-1 text-xs text-[var(--ink-soft)]">
                {order.items.length === 0 && (
                  <p className="text-[var(--ink-faint)]">No items on this ticket.</p>
                )}
                {order.items.slice(0, 3).map((item, i) => (
                  <p key={i}><span className="text-[var(--accent)] font-bold">{item.quantity}x</span> {item.name}</p>
                ))}
                {order.items.length > 3 && (
                  <p className="text-[var(--ink-faint)]">+{order.items.length - 3} more items</p>
                )}
              </div>

              {/* Expand hint */}
              <p className="text-[10px] text-[var(--ink-faint)] mt-2 text-right">
                {isExpanded ? "click to collapse" : "click to manage"}
              </p>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="mt-2 ticket p-4 border border-[var(--accent)] bg-[var(--paper-overlay)] space-y-3">
                {/* Full items list */}
                <div className="border-t border-b border-[var(--rule)] py-2 space-y-1.5 text-xs">
                  {order.items.length === 0 && (
                    <p className="text-[var(--ink-faint)]">No items on this ticket.</p>
                  )}
                  {order.items.map((item, i) => {
                    const priceNum = Number(item.price);
                    const line = Number.isFinite(priceNum) ? (priceNum * item.quantity).toFixed(2) : "0.00";
                    return (
                      <div key={i} className="flex justify-between text-[var(--ink)]">
                        <span>
                          <span className="text-[var(--accent)] font-bold mr-1.5">{item.quantity}x</span>
                          {item.name}
                        </span>
                        <span className="text-[var(--ink-soft)]">AED {line}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--ink-faint)] font-mono">ID: {order.id.slice(0, 8)}…</span>
                  <span className="font-bold text-[var(--ink)]">AED {(() => { const n = Number(order.total); return Number.isFinite(n) ? n.toFixed(2) : "0.00"; })()}</span>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-[var(--rule)]">
                  <span className="text-[10px] text-[var(--ink-faint)] uppercase tracking-wider mr-auto">Actions:</span>
                  {(order.status === "pending" || order.status === "paid") && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "preparing"); }}
                      className="px-3 py-1.5 text-xs rounded border border-amber-600/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 font-medium transition-colors"
                    >
                      Start Preparing
                    </button>
                  )}
                  {order.status === "preparing" && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "ready"); }}
                      className="px-3 py-1.5 text-xs rounded border border-blue-600/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 font-medium transition-colors"
                    >
                      Mark Ready
                    </button>
                  )}
                  {order.status !== "cancelled" && order.status !== "completed" && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "cancelled"); }}
                      className="px-3 py-1.5 text-xs rounded border border-red-600/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  {(order.status === "completed" || order.status === "cancelled") && (
                    <button
                      type="button"
                      disabled={deletingId === order.id}
                      onClick={(e) => { e.stopPropagation(); handleDelete(order.id); }}
                      className="px-3 py-1.5 text-xs rounded border border-red-600/30 text-red-400 hover:bg-red-500/20 transition-colors"
                      title="Permanently delete"
                    >
                      {deletingId === order.id ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}
