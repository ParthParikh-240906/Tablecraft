"use client";

import { useState } from "react";
import { OrdersDashboard } from "./orders/orders-dashboard";
import { AddOrderModal } from "./orders/add-order-modal";
import { EditOrderModal } from "./orders/edit-order-modal";
import type { OrderRecord } from "./orders/orders-list";

interface ConsoleOrdersSectionProps {
  orgId: string;
  initialOrders: OrderRecord[];
}

export function ConsoleOrdersSection({ orgId, initialOrders }: ConsoleOrdersSectionProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="label-caps text-[var(--ink-faint)]">Order Dashboard</h2>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5 text-xs font-medium bg-[var(--accent)] text-white rounded-sm hover:bg-opacity-90 transition-colors"
        >
          + Add Table Order
        </button>
      </div>
      <OrdersDashboard initialOrders={initialOrders} orgId={orgId} onEdit={setEditingOrder} />

      {showAddModal && (
        <AddOrderModal
          orgId={orgId}
          onOrderCreated={() => setTimeout(() => setShowAddModal(false), 400)}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          orgId={orgId}
          onOrderUpdated={() => {
            setEditingOrder(null);
            setTimeout(() => setShowAddModal(false), 400);
          }}
          onClose={() => setEditingOrder(null)}
        />
      )}
    </div>
  );
}
