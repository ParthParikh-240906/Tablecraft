"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderRecord, OrderItem } from "./orders-list";

interface OrdersDashboardProps {
  initialOrders: OrderRecord[];
  orgId: string;
  onEdit?: (order: OrderRecord) => void;
}

export function OrdersDashboard({ initialOrders, orgId, onEdit }: OrdersDashboardProps) {
  const [orders, setOrders] = useState<OrderRecord[]>(
    initialOrders.filter((o) => o.status !== "paid" && o.status !== "cancelled"),
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const supabase = createClient();

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
            .not("status", "eq", "paid")
            .not("status", "eq", "cancelled")
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
          <p class="meta">${order.customer_name}</p>
          <table>${itemsHtml}</table>
          <p class="total">Total: AED ${Number(order.total).toFixed(2)}</p>
          <p class="meta">Tablecraft</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  // Status color classes
  const statusCls: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    preparing: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    ready: "bg-purple-500/15 text-purple-700 border-purple-500/30",
    completed: "bg-green-500/15 text-green-700 border-green-500/30",
  };
  const statusLabel: Record<string, string> = {
    pending: "Pending",
    preparing: "Preparing",
    ready: "Ready",
    completed: "Completed",
  };

  const btn = "px-2.5 py-1 text-xs rounded border border-orange-600/30 text-orange-800 bg-orange-500/10 hover:bg-orange-500/20 font-medium";
  const ghostBtn = "px-2 py-0.5 text-xs rounded border border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--rule-strong)]";
  const delBtn = "px-2 py-0.5 text-xs rounded border border-red-600/30 text-red-400 hover:bg-red-500/20";

  function renderCard(order: OrderRecord) {
    const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
    const label = order.customer_name; // e.g. "Table 1, 2, 3"
    const total = Number(order.total).toFixed(0);
    const sc = statusCls[order.status] ?? "bg-gray-500/15 text-gray-700 border-gray-500/30";
    const sl = statusLabel[order.status] ?? order.status;

    const actionsRow = () => {
      switch (order.status) {
        case "pending":
          return (
            <div className="flex items-center gap-1.5">
              <button onClick={() => handleDelete(order.id)} className={delBtn}>Delete</button>
              {onEdit && <button onClick={() => onEdit(order)} className={ghostBtn}>Edit</button>}
              <button onClick={() => handlePrint(order)} className={ghostBtn}>Print</button>
            </div>
          );
        case "preparing":
          return (
            <div className="flex items-center gap-1.5">
              <button onClick={() => handleDelete(order.id)} className={delBtn}>Delete</button>
              {onEdit && <button onClick={() => onEdit(order)} className={ghostBtn}>Edit</button>}
            </div>
          );
        case "ready":
          return (
            <div className="flex items-center gap-1.5">
              <button onClick={() => updateStatus(order.id, "completed")} disabled={updatingId === order.id} className={btn}>✓ Complete</button>
              <button onClick={() => handleDelete(order.id)} className={delBtn}>Delete</button>
              {onEdit && <button onClick={() => onEdit(order)} className={ghostBtn}>Edit</button>}
            </div>
          );
        case "completed":
          return (
            <div className="flex flex-col gap-1.5 items-end">
              <button onClick={() => updateStatus(order.id, "paid")} disabled={updatingId === order.id} className={btn}>Paid</button>
              <div className="flex items-center gap-1.5">
                <button onClick={() => handleDelete(order.id)} className={delBtn}>Delete</button>
                <button onClick={() => handlePrint(order)} className={ghostBtn}>Print</button>
                {onEdit && <button onClick={() => onEdit(order)} className={ghostBtn}>Edit</button>}
              </div>
            </div>
          );
        default:
          return null;
      }
    };

    return (
      <div key={order.id} className="flex items-start gap-4 px-4 py-3 border border-[var(--rule)] bg-[var(--paper-raised)] rounded-sm">
        {/* Left: table label */}
        <div className="flex-shrink-0 w-24 pt-0.5">
          <p className="text-sm font-bold text-[var(--ink)]">{label}</p>
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
          <p className="text-xs text-[var(--ink-faint)] mt-1">AED {total}</p>
        </div>

        {/* Divider */}
        <div className="w-px bg-[var(--rule)] flex-shrink-0" />

        {/* Right: badge + actions */}
        <div className="flex-shrink-0 py-1 flex flex-col items-end gap-1.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${sc}`}>{sl}</span>
          {actionsRow()}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)] italic">No active orders.</p>
      ) : (
        orders.map((o) => renderCard(o))
      )}
    </div>
  );
}
