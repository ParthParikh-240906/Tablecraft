"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderRecord, OrderItem } from "./orders-list";

interface TableGroup {
  tableName: string;
  isTable: boolean;
  orders: OrderRecord[];
}

interface OrdersDashboardProps {
  initialOrders: OrderRecord[];
  orgId: string;
  onEdit?: (order: OrderRecord) => void;
}

export function OrdersDashboard({ initialOrders, orgId, onEdit }: OrdersDashboardProps) {
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const supabase = createClient();

  // Realtime: keep dashboard in sync
  useEffect(() => {
    const channel = supabase
      .channel("orders-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `org_id=eq.${orgId}` },
        () => {
          supabase
            .from("orders")
            .select("id, customer_name, total, status, created_at, stripe_session_id, items")
            .eq("org_id", orgId)
            .order("created_at", { ascending: false })
            .then(({ data }) => setOrders(data ?? []));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdatingId(orderId);
    try {
      const res = await fetch("/api/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      if (res.ok) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(orderId: string) {
    if (!confirm("Delete this order permanently?")) return;
    try {
      const res = await fetch("/api/orders/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (res.ok) setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch {}
  }

  function handlePrint(order: OrderRecord) {
    const itemsHtml = order.items
      .map((item) => `<tr><td>${item.quantity}x ${item.name}</td><td style="text-align:right">AED ${(item.price * item.quantity).toFixed(2)}</td></tr>`)
      .join("");
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>Order Receipt</title>
        <style>
          body { font-family: monospace; font-size: 14px; padding: 20px; max-width: 300px; margin: 0 auto; }
          h1 { font-size: 18px; text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          td { padding: 4px 0; }
          .total { border-top: 2px dashed #000; padding-top: 10px; font-weight: bold; text-align: right; }
          .meta { font-size: 12px; color: #666; text-align: center; }
        </style>
        </head>
        <body>
          <h1>ORDER RECEIPT</h1>
          <p class="meta">${order.customer_name} &mdash; ${new Date(order.created_at).toLocaleTimeString()}</p>
          <table>${itemsHtml}</table>
          <p class="total">Total: AED ${Number(order.total).toFixed(2)}</p>
          <p class="meta">Tablecraft</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  // Group orders by status
  const activeByTable = new Map<string, OrderRecord>();
  const completedOrders: OrderRecord[] = [];
  const paidOrders: OrderRecord[] = [];
  const cancelledOrders: OrderRecord[] = [];

  for (const order of orders) {
    if (order.status === "paid") {
      paidOrders.push(order);
    } else if (order.status === "completed") {
      completedOrders.push(order);
    } else if (order.status === "cancelled") {
      cancelledOrders.push(order);
    } else {
      const key = order.customer_name;
      const existing = activeByTable.get(key);
      if (!existing || new Date(order.created_at) > new Date(existing.created_at)) {
        activeByTable.set(key, order);
      }
    }
  }

  const tableGroups: TableGroup[] = Array.from(activeByTable.entries()).map(([tableName, order]) => ({
    tableName,
    isTable: tableName.startsWith("Table "),
    orders: [order],
  }));

  const getStatusBadge = (status: string) => {
    const cls: Record<string, string> = {
      pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
      paid: "bg-green-500/15 text-green-700 border-green-500/30",
      preparing: "bg-blue-500/15 text-blue-700 border-blue-500/30",
      ready: "bg-purple-500/15 text-purple-700 border-purple-500/30",
    };
    const labels: Record<string, string> = {
      pending: "Pending",
      paid: "Paid",
      preparing: "Preparing",
      ready: "Ready",
    };
    const c = cls[status] ?? "bg-gray-500/15 text-gray-700 border-gray-500/30";
    const l = labels[status] ?? status;
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${c}`}>{l}</span>;
  };

  const btn = "px-2.5 py-1 text-xs rounded border border-orange-600/30 text-orange-800 bg-orange-500/10 hover:bg-orange-500/20 font-medium";

  const renderActions = (order: OrderRecord) => {
    const isDone = order.status === "completed" || order.status === "cancelled" || order.status === "paid";
    return (
      <div className="flex flex-col gap-1.5 items-end">
        {order.status === "ready" && (
          <button onClick={() => updateStatus(order.id, "completed")} disabled={updatingId === order.id}
            className={btn}>✓ Complete</button>
        )}
        {order.status === "completed" && (
          <button onClick={() => updateStatus(order.id, "paid")} disabled={updatingId === order.id}
            className={btn}>Mark Paid</button>
        )}
        {!isDone && (
          <button onClick={() => updateStatus(order.id, "cancelled")} disabled={updatingId === order.id}
            className={btn}>Cancel</button>
        )}
        {isDone && (
          <button onClick={() => handleDelete(order.id)}
            className="px-2 py-0.5 text-xs rounded border border-red-600/30 text-red-400 hover:bg-red-500/20">🗑 Delete</button>
        )}
        {onEdit && !isDone && (
          <button onClick={() => onEdit(order)}
            className="px-2 py-0.5 text-xs rounded border border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--rule-strong)]">✏️ Edit</button>
        )}
        <button onClick={() => handlePrint(order)}
          className="px-2 py-0.5 text-xs rounded border border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--rule-strong)]">🖨 Print</button>
      </div>
    );
  };

  // Active order card — height adapts to item count
  const renderActiveCard = (order: OrderRecord) => {
    const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
    const timeStr = new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const label = order.customer_name.startsWith("Table ")
      ? order.customer_name.replace("Table ", "")
      : order.customer_name;

    return (
      <div key={order.id} className="flex items-start gap-4 px-4 py-3 border border-[var(--rule)] bg-[var(--paper-raised)] rounded-sm">
        {/* Left: table label */}
        <div className="flex-shrink-0 w-20 pt-0.5">
          <p className="text-sm font-bold text-[var(--ink)]">{label}</p>
          <p className="text-xs text-[var(--ink-faint)] mt-0.5">{timeStr}</p>
        </div>

        {/* Divider */}
        <div className="w-px bg-[var(--rule)] flex-shrink-0" />

        {/* Center: items */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {items.map((item, i) => (
              <span key={i} className="text-sm text-[var(--ink-soft)] whitespace-nowrap">
                <span className="text-[var(--accent)] font-semibold">{item.quantity}x</span> {item.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-[var(--ink-faint)] mt-1">
            AED {Number(order.total).toFixed(0)}
          </p>
        </div>

        {/* Divider */}
        <div className="w-px bg-[var(--rule)] flex-shrink-0" />

        {/* Right: badge + actions, stacked vertically */}
        <div className="flex-shrink-0 py-1">
          {getStatusBadge(order.status)}
          {renderActions(order)}
        </div>
      </div>
    );
  };

  // Completed / paid card — no actions except print
  const renderCompletedCard = (order: OrderRecord) => {
    const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
    const label = order.customer_name.startsWith("Table ")
      ? order.customer_name.replace("Table ", "")
      : order.customer_name;

    return (
      <div key={order.id} className="flex items-center gap-4 px-4 py-3 border border-[var(--rule)] bg-[var(--paper)] rounded-sm opacity-70 hover:opacity-100 transition-opacity">
        <div className="flex-shrink-0 w-20">
          <p className="text-sm font-bold text-[var(--ink)] truncate">{label}</p>
          <p className="text-xs text-[var(--ink-faint)] mt-0.5">
            {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="w-px h-10 bg-[var(--rule)] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {items.map((item, i) => (
              <span key={i} className="text-sm text-[var(--ink-soft)] whitespace-nowrap">
                <span className="text-[var(--accent)] font-semibold">{item.quantity}x</span> {item.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-[var(--ink-faint)] mt-1">
            AED {Number(order.total).toFixed(0)}
          </p>
        </div>
        <div className="w-px h-10 bg-[var(--rule)] flex-shrink-0" />
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0 py-1">
          {getStatusBadge(order.status)}
          <button onClick={() => handlePrint(order)}
            className="px-2 py-0.5 text-xs rounded border border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--rule-strong)]">🖨 Print</button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Active tables */}
      <div>
        <h2 className="font-display text-sm text-[var(--ink-faint)] uppercase tracking-wider mb-2">
          Active Orders
          {tableGroups.length > 0 && (
            <span className="ml-1.5 font-normal text-[var(--ink-soft)]">({tableGroups.length})</span>
          )}
        </h2>
        {tableGroups.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)] italic">No active orders.</p>
        ) : (
          <div className="space-y-2">
            {tableGroups.map((group) =>
              group.orders.map((o) => renderActiveCard(o))
            )}
          </div>
        )}
      </div>

      {/* Completed orders */}
      {completedOrders.length > 0 && (
        <div>
          <h2 className="font-display text-sm text-[var(--ink-faint)] uppercase tracking-wider mb-2">
            Completed
            <span className="ml-1.5 font-normal text-[var(--ink-soft)]">({completedOrders.length})</span>
          </h2>
          <div className="space-y-1.5">
            {completedOrders.slice(0, 4).map((o) => renderCompletedCard(o))}
          </div>
        </div>
      )}

      {/* Cancelled orders */}
      {cancelledOrders.length > 0 && (
        <div>
          <h2 className="font-display text-sm text-[var(--ink-faint)] uppercase tracking-wider mb-2">
            Cancelled
            <span className="ml-1.5 font-normal text-[var(--ink-soft)]">({cancelledOrders.length})</span>
          </h2>
          <div className="space-y-1.5">
            {cancelledOrders.slice(0, 4).map((o) => renderCompletedCard(o))}
          </div>
        </div>
      )}
    </div>
  );
}
