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
  const { orders: realtimeOrders, connected } = useOrdersRealtime(orgId, initialOrdersRecord);
  const orders = filterKitchenOrders(realtimeOrders);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdatingId(orderId);
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
        const data = await res.json();
        alert(data.error || "Failed to update order status");
      }
    } catch {
      alert("Network error updating status");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(orderId: string) {
    if (!confirm("Delete this order permanently?")) return;
    setDeletingId(orderId);
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
        const data = await res.json();
        alert(data.error || "Failed to delete order");
      }
    } catch {
      alert("Network error deleting order");
    } finally {
      setDeletingId(null);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">Pending</span>;
      case "paid":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/20 text-green-400 border border-green-500/30">Paid</span>;
      case "preparing":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">Preparing</span>;
      case "ready":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">Ready</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">{status}</span>;
    }
  };

  if (orders.length === 0) {
    return (
      <div className="ticket p-12 text-center text-[var(--ink-soft)]">
        <p className="font-display text-lg mb-1">No open tickets</p>
        <p className="text-xs">Kitchen is quiet — all orders completed.</p>
        <p className={`text-[10px] mt-2 ${connected ? "text-green-400" : "text-amber-400"}`}>
          {connected ? "● Live sync" : "◐ Polling…"}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Connection status bar */}
      <div className="mb-3 flex items-center gap-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${connected ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}`}>
          {connected ? "● Live" : "◐ Polling"}
        </span>
        <span className="text-[10px] text-[var(--ink-faint)]">{orders.length} open ticket{orders.length > 1 ? "s" : ""}</span>
      </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {orders.map((order) => {
        const isExpanded = expandedId === order.id;
        const timeStr = new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const ageMinutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);

        return (
          <div key={order.id}>
            {/* Ticket card — clickable to expand */}
            <div
              className={`ticket p-4 cursor-pointer transition-all border ${
                isExpanded
                  ? "border-[var(--accent)] bg-[var(--paper-overlay)]"
                  : "border-[var(--rule)] bg-[var(--paper-raised)] hover:border-[var(--rule-strong)]"
              }`}
              onClick={() => setExpandedId(isExpanded ? null : order.id)}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="font-display text-base font-bold text-[var(--ink)]">{order.customer_name.replace(/^Table\s+/i, "")}</p>
                  <p className="text-[10px] text-[var(--ink-faint)] mt-0.5">{timeStr} &middot; {ageMinutes}m ago</p>
                </div>
                {getStatusBadge(order.status)}
              </div>

              {/* Items preview (collapsed) */}
              <div className="space-y-1 text-xs text-[var(--ink-soft)]">
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
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-[var(--ink)]">
                      <span>
                        <span className="text-[var(--accent)] font-bold mr-1.5">{item.quantity}x</span>
                        {item.name}
                      </span>
                      <span className="text-[var(--ink-soft)]">AED {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--ink-faint)] font-mono">ID: {order.id.slice(0, 8)}…</span>
                  <span className="font-bold text-[var(--ink)]">AED {Number(order.total).toFixed(2)}</span>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-[var(--rule)]">
                  <span className="text-[10px] text-[var(--ink-faint)] uppercase tracking-wider mr-auto">Actions:</span>
                  {(order.status === "pending" || order.status === "paid") && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "preparing"); }}
                      className="px-2.5 py-1 text-xs rounded border border-amber-600/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 font-medium"
                    >
                      🍳 Preparing
                    </button>
                  )}
                  {order.status === "preparing" && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "ready"); }}
                      className="px-2.5 py-1 text-xs rounded border border-blue-600/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 font-medium"
                    >
                      🔔 Ready
                    </button>
                  )}
                  {order.status !== "cancelled" && order.status !== "completed" && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "cancelled"); }}
                      className="px-2.5 py-1 text-xs rounded border border-red-600/30 text-red-400 bg-red-500/10 hover:bg-red-500/20"
                    >
                      Cancel
                    </button>
                  )}
                  {(order.status === "completed" || order.status === "cancelled") && (
                    <button
                      type="button"
                      disabled={deletingId === order.id}
                      onClick={(e) => { e.stopPropagation(); handleDelete(order.id); }}
                      className="px-2.5 py-1 text-xs rounded border border-red-600/30 text-red-400 hover:bg-red-500/20"
                      title="Permanently delete"
                    >
                      {deletingId === order.id ? "Deleting…" : "🗑 Delete"}
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
