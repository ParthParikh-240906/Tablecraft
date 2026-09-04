"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { AddOrderModal } from "./add-order-modal";
import { EditOrderModal } from "./edit-order-modal";
import { OrdersDashboard } from "./orders-dashboard";

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

type FilterKey = "dashboard" | "pending" | "preparing" | "ready" | "completed" | "paid" | "cancelled";

const TABS: { key: FilterKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "pending", label: "Pending", icon: "⏳" },
  { key: "preparing", label: "Preparing", icon: "🍳" },
  { key: "ready", label: "Ready", icon: "🔔" },
  { key: "completed", label: "Completed", icon: "📦" },
  { key: "paid", label: "Paid", icon: "💰" },
  { key: "cancelled", label: "Cancelled", icon: "❌" },
];

export function OrdersList({
  orgId,
  initialOrders,
}: {
  orgId: string;
  initialOrders: OrderRecord[];
}) {
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [filter, setFilter] = useState<FilterKey>("dashboard");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);

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
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
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
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
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

  const refreshOrders = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("id, customer_name, total, status, created_at, stripe_session_id, items")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    setOrders((data ?? []) as OrderRecord[]);
  }, [orgId]);

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

  const renderListView = () => {
    const filteredOrders = orders.filter((order) => order.status === filter);

    return (
      <>
        {filteredOrders.length === 0 ? (
          <div className="ticket p-12 text-center text-[var(--ink-soft)]">
            <p className="font-display text-lg mb-1">No orders found</p>
            <p className="text-xs">No {filter} orders.</p>
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
              const isCancelable = order.status !== "completed" && order.status !== "cancelled" && order.status !== "paid";

              return (
                <div
                  key={order.id}
                  className="ticket p-5 flex flex-col justify-between space-y-4 border border-[var(--rule)] bg-[var(--paper-raised)]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isTable
                              ? "bg-amber-500/15 text-amber-700 border border-amber-500/30"
                              : "bg-blue-500/15 text-blue-700 border border-blue-500/30"
                          }`}>
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
                      <div className="text-right">{getStatusBadge(order.status)}</div>
                    </div>

                    <div className="border-t border-b border-[var(--rule)] py-3 my-2 space-y-1.5 text-xs">
                      {itemsList.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[var(--ink)]">
                          <span className="font-medium">
                            <span className="text-[var(--accent)] font-bold mr-1.5">{item.quantity}x</span>
                            {item.name}
                          </span>
                          <span className="text-[var(--ink-soft)]">
                            AED {(Number(item.price) * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center text-xs mt-3">
                      <span className="text-[var(--ink-faint)] font-mono text-[10px]">
                        ID: {order.id.slice(0, 8)}…
                      </span>
                      <span className="font-bold text-sm text-[var(--ink)]">
                        Total: AED {Number(order.total).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-[var(--rule)] pt-3 flex flex-wrap gap-2 items-center justify-end">
                    <span className="text-[10px] text-[var(--ink-faint)] uppercase tracking-wider mr-auto">
                      Update Status:
                    </span>
                    {order.status === "ready" && (
                      <button disabled={updatingId === order.id}
                        onClick={() => updateStatus(order.id, "completed")}
                        className="px-2.5 py-1 text-xs rounded border border-orange-600/30 text-orange-800 bg-orange-500/10 hover:bg-orange-500/20 font-medium">
                        ✓ Complete
                      </button>
                    )}
                    {order.status === "completed" && (
                      <button disabled={updatingId === order.id}
                        onClick={() => updateStatus(order.id, "paid")}
                        className="px-2.5 py-1 text-xs rounded border border-orange-600/30 text-orange-800 bg-orange-500/10 hover:bg-orange-500/20 font-medium">
                        Mark Paid
                      </button>
                    )}
                    {isCancelable && (
                      <button disabled={updatingId === order.id}
                        onClick={() => updateStatus(order.id, "cancelled")}
                        className="px-2.5 py-1 text-xs rounded border border-orange-600/30 text-orange-800 bg-orange-500/10 hover:bg-orange-500/20 font-medium">
                        Cancel
                      </button>
                    )}
                    {order.status !== "preparing" && order.status !== "ready" && (
                      <button disabled={deletingId === order.id}
                        onClick={() => handleDelete(order.id)}
                        className="px-2.5 py-1 text-xs rounded border border-red-600/30 text-red-400 hover:bg-red-500/20 ml-2"
                        title="Permanently delete order">
                        {deletingId === order.id ? "Deleting…" : "🗑 Delete"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">Orders</h1>
          <p className="text-sm text-[var(--ink-soft)]">
            Live orders received from storefront online checkout and in-restaurant tables.
          </p>
        </div>

        {/* Tab filters */}
        <div className="flex flex-wrap items-center gap-1 border border-[var(--rule)] rounded-md p-1 bg-[var(--paper-raised)]">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${
                filter === key
                  ? "bg-[var(--ink)] text-[var(--paper)]"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              {icon} {label}
              {key !== "dashboard" && (
                <span className="ml-1 opacity-70">({orders.filter((o) => o.status === key).length})</span>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5 text-xs font-medium bg-[var(--accent)] text-[var(--paper)] rounded-sm hover:bg-opacity-90 transition-colors"
        >
          + Add Table Order
        </button>
      </div>

      {filter === "dashboard"
        ? <OrdersDashboard initialOrders={orders} orgId={orgId} onEdit={setEditingOrder} />
        : renderListView()
      }

      {showAddModal && (
        <AddOrderModal
          orgId={orgId}
          onOrderCreated={refreshOrders}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          orgId={orgId}
          onOrderUpdated={refreshOrders}
          onClose={() => setEditingOrder(null)}
        />
      )}
    </div>
  );
}
