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

  useEffect(() => {
    // Filter out paid/cancelled orders from the parent's live feed
    setOrders(initialOrders.filter((o) => o.status !== "paid" && o.status !== "cancelled"));
  }, [initialOrders]);

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
    pending: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    preparing: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    ready: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  };
  const statusLabel: Record<string, string> = {
    pending: "Pending",
    preparing: "Preparing",
    ready: "Ready",
    completed: "Completed",
  };

  const btnPrimary = "px-2.5 py-1 text-xs rounded border border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/15 hover:bg-[var(--accent)]/25 font-semibold transition-colors disabled:opacity-50";
  const ghostBtn = "px-2.5 py-1 text-xs rounded border border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--rule-strong)] hover:bg-[var(--paper)] transition-colors";
  const delBtn = "px-2.5 py-1 text-xs rounded border border-rose-500/30 text-rose-400 hover:bg-rose-500/15 transition-colors";

  function renderCard(order: OrderRecord) {
    const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
    const label = order.customer_name; // e.g. "Table 1, 2, 3"
    const total = Number(order.total).toFixed(2);
    const sc = statusCls[order.status] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30";
    const sl = statusLabel[order.status] ?? order.status;

    const actionsRow = () => {
      switch (order.status) {
        case "pending":
          return (
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button onClick={() => handleDelete(order.id)} className={delBtn}>Delete</button>
              {onEdit && <button onClick={() => onEdit(order)} className={ghostBtn}>Edit</button>}
              <button onClick={() => handlePrint(order)} className={ghostBtn}>Print</button>
            </div>
          );
        case "preparing":
          return (
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button onClick={() => handleDelete(order.id)} className={delBtn}>Delete</button>
              {onEdit && <button onClick={() => onEdit(order)} className={ghostBtn}>Edit</button>}
            </div>
          );
        case "ready":
          return (
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button onClick={() => updateStatus(order.id, "completed")} disabled={updatingId === order.id} className={btnPrimary}>✓ Complete</button>
              <button onClick={() => handleDelete(order.id)} className={delBtn}>Delete</button>
              {onEdit && <button onClick={() => onEdit(order)} className={ghostBtn}>Edit</button>}
            </div>
          );
        case "completed":
          return (
            <div className="flex flex-col gap-1.5 items-end">
              <button onClick={() => updateStatus(order.id, "paid")} disabled={updatingId === order.id} className={btnPrimary}>Mark Paid</button>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
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
      <div key={order.id} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 p-4 border border-[var(--rule)] bg-[var(--paper-raised)] rounded-md shadow-xs">
        {/* Left: Table Identifier & Total */}
        <div className="flex-shrink-0 sm:w-36 flex sm:flex-col justify-between sm:justify-center items-start">
          <div>
            <p className="text-sm font-bold text-[var(--ink)] leading-snug break-words">{label}</p>
            <p className="text-[10px] font-mono text-[var(--ink-faint)] mt-0.5">#{order.id.slice(0, 8)}</p>
          </div>
          <p className="font-mono text-xs font-semibold text-[var(--accent)] mt-1">
            AED {total}
          </p>
        </div>

        {/* Divider for desktop */}
        <div className="hidden sm:block w-px self-stretch bg-[var(--rule)] flex-shrink-0" />

        {/* Middle: Dish Item Capsules (Fluid & Wrapped cleanly) */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 max-h-28 overflow-y-auto pr-1">
            {items.map((item, i) => (
              <span
                key={i}
                className="inline-flex items-start gap-1.5 text-xs px-2.5 py-1 rounded bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink-soft)] font-medium"
              >
                <span className="text-[var(--accent)] font-mono font-bold flex-shrink-0">{item.quantity}x</span>
                <span className="text-[var(--ink)]">{item.name}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Divider for desktop */}
        <div className="hidden sm:block w-px self-stretch bg-[var(--rule)] flex-shrink-0" />

        {/* Right: Status Badge & Actions */}
        <div className="flex-shrink-0 sm:min-w-[150px] flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--rule)]">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${sc}`}>
            {sl}
          </span>
          {actionsRow()}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.length === 0 ? (
        <div className="ticket p-8 text-center text-[var(--ink-soft)] border border-[var(--rule)] bg-[var(--paper-raised)]">
          <p className="font-display text-base mb-1">No active orders</p>
          <p className="text-xs text-[var(--ink-faint)]">New dine-in orders will appear here automatically.</p>
        </div>
      ) : (
        orders.map((o) => renderCard(o))
      )}
    </div>
  );
}
