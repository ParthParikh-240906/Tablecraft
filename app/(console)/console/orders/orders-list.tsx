"use client";

import { useState } from "react";

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderRecord {
  id: string;
  customer_name: string;
  total: number;
  status: string;
  created_at: string;
  stripe_session_id?: string | null;
  items: OrderItem[];
}

export function OrdersList({
  initialOrders,
}: {
  initialOrders: OrderRecord[];
}) {
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [filter, setFilter] = useState<"all" | "table" | "online">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredOrders = orders.filter((order) => {
    const isTable = order.customer_name.startsWith("Table ");
    if (filter === "table") return isTable;
    if (filter === "online") return !isTable;
    return true;
  });

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdatingId(orderId);
    try {
      const res = await fetch("/api/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <span className="status-badge bg-green-500/10 text-green-700 border border-green-500/20">Paid</span>;
      case "preparing":
        return <span className="status-badge bg-amber-500/10 text-amber-700 border border-amber-500/20">Preparing</span>;
      case "ready":
        return <span className="status-badge bg-blue-500/10 text-blue-700 border border-blue-500/20">Ready for Pickup</span>;
      case "completed":
        return <span className="status-badge bg-purple-500/10 text-purple-700 border border-purple-500/20">Completed</span>;
      case "cancelled":
        return <span className="status-badge bg-red-500/10 text-red-700 border border-red-500/20">Cancelled</span>;
      default:
        return <span className="status-badge bg-gray-500/10 text-gray-700 border border-gray-500/20">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">Kitchen & Online Orders</h1>
          <p className="text-sm text-[var(--ink-soft)]">
            Live orders received from storefront online checkout and in-restaurant table QR codes.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 border border-[var(--rule)] rounded-md p-1 bg-[var(--paper-raised)]">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${
              filter === "all"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            All Orders ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("table")}
            className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${
              filter === "table"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            🍽️ Table Orders ({orders.filter((o) => o.customer_name.startsWith("Table ")).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("online")}
            className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${
              filter === "online"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            🛍️ Online Orders ({orders.filter((o) => !o.customer_name.startsWith("Table ")).length})
          </button>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="ticket p-12 text-center text-[var(--ink-soft)]">
          <p className="font-display text-lg mb-1">No orders found</p>
          <p className="text-xs">
            {filter === "all"
              ? "When guests place orders online or at their tables, they will show up here."
              : `No ${filter} orders found.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map((order) => {
            const isTable = order.customer_name.startsWith("Table ");
            const itemsList: OrderItem[] = Array.isArray(order.items) ? order.items : [];
            const timeAgo = new Date(order.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            const dateStr = new Date(order.created_at).toLocaleDateString();

            return (
              <div
                key={order.id}
                className="ticket p-5 flex flex-col justify-between space-y-4 border border-[var(--rule)] bg-[var(--paper-raised)]"
              >
                <div>
                  {/* Top Bar: Type Badge, Name/Table, and Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isTable
                              ? "bg-amber-500/15 text-amber-700 border border-amber-500/30"
                              : "bg-blue-500/15 text-blue-700 border border-blue-500/30"
                          }`}
                        >
                          {isTable ? "🍽️ Dine-in Table" : "🛍️ Online Order"}
                        </span>
                        <span className="text-xs text-[var(--ink-faint)]">
                          {dateStr} at {timeAgo}
                        </span>
                      </div>
                      <h3 className="font-display text-base font-bold text-[var(--ink)]">
                        {order.customer_name}
                      </h3>
                    </div>

                    <div className="text-right">
                      {getStatusBadge(order.status)}
                    </div>
                  </div>

                  {/* Order Items Table / List */}
                  <div className="border-t border-b border-[var(--rule)] py-3 my-2 space-y-1.5 text-xs">
                    {itemsList.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[var(--ink)]">
                        <span className="font-medium">
                          <span className="text-[var(--accent)] font-bold mr-1.5">
                            {item.quantity}x
                          </span>
                          {item.name}
                        </span>
                        <span className="text-[var(--ink-soft)]">
                          AED {(Number(item.price) * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Order Total & ID */}
                  <div className="flex justify-between items-center text-xs mt-3">
                    <span className="text-[var(--ink-faint)] font-mono text-[10px]">
                      ID: {order.id.slice(0, 8)}…
                    </span>
                    <span className="font-bold text-sm text-[var(--ink)]">
                      Total: AED {Number(order.total).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Status action buttons */}
                <div className="border-t border-[var(--rule)] pt-3 flex flex-wrap gap-2 items-center justify-end">
                  <span className="text-[10px] text-[var(--ink-faint)] uppercase tracking-wider mr-auto">
                    Update Status:
                  </span>
                  {order.status === "pending" && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={() => updateStatus(order.id, "paid")}
                      className="px-2.5 py-1 text-xs rounded border border-green-600/30 text-green-700 bg-green-500/10 hover:bg-green-500/20 font-medium"
                    >
                      Mark Paid
                    </button>
                  )}
                  {(order.status === "pending" || order.status === "paid") && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={() => updateStatus(order.id, "preparing")}
                      className="px-2.5 py-1 text-xs rounded border border-amber-600/30 text-amber-700 bg-amber-500/10 hover:bg-amber-500/20 font-medium"
                    >
                      🍳 Preparing
                    </button>
                  )}
                  {order.status === "preparing" && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={() => updateStatus(order.id, "ready")}
                      className="px-2.5 py-1 text-xs rounded border border-blue-600/30 text-blue-700 bg-blue-500/10 hover:bg-blue-500/20 font-medium"
                    >
                      🔔 Ready
                    </button>
                  )}
                  {(order.status === "ready" || order.status === "preparing" || order.status === "paid") && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={() => updateStatus(order.id, "completed")}
                      className="px-2.5 py-1 text-xs rounded border border-purple-600/30 text-purple-700 bg-purple-500/10 hover:bg-purple-500/20 font-medium"
                    >
                      ✓ Completed
                    </button>
                  )}
                  {order.status !== "cancelled" && order.status !== "completed" && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={() => updateStatus(order.id, "cancelled")}
                      className="px-2.5 py-1 text-xs rounded border border-red-600/30 text-red-600 bg-red-500/10 hover:bg-red-500/20"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}