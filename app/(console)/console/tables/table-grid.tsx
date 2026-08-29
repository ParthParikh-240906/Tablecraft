"use client";

import { useState } from "react";
import { useTableRealtime, type TableStatus } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";

const STATUS_STYLES: Record<TableStatus, string> = {
  open: "bg-green-100 text-green-800 border-green-300",
  occupied: "bg-red-100 text-red-800 border-red-300",
  reserved: "bg-amber-100 text-amber-800 border-amber-300",
};

const NEXT_STATUS: Record<TableStatus, TableStatus> = {
  open: "occupied",
  occupied: "reserved",
  reserved: "open",
};

export function TableGrid({ orgId }: { orgId: string }) {
  const { tables, connected } = useTableRealtime(orgId);
  const [updating, setUpdating] = useState<string | null>(null);

  async function toggleStatus(tableId: string, current: TableStatus) {
    const next = NEXT_STATUS[current];
    setUpdating(tableId);

    // Direct update with the authenticated client — RLS scopes this to the
    // staff member's own org, so no API route is needed.
    const supabase = createClient();
    const { error } = await supabase
      .from("tables")
      .update({ status: next })
      .eq("id", tableId);

    if (error) {
      console.error("toggleStatus failed:", error);
    }
    setUpdating(null);
  }

  const sorted = [...tables].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Tables</h1>
        <span className="text-xs text-gray-400">
          {connected ? "● Live" : "○ Connecting…"}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Click a table to cycle its status: open → occupied → reserved.
      </p>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-gray-500">
          No tables yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {sorted.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleStatus(t.id, t.status)}
              disabled={updating === t.id}
              className={`rounded-2xl border p-4 text-left transition-colors ${STATUS_STYLES[t.status]} ${
                updating === t.id ? "opacity-50 cursor-wait" : "hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-lg">{t.label}</span>
                <span className="text-xs font-medium uppercase tracking-wide">
                  {t.status}
                </span>
              </div>
              <p className="text-sm mt-1 opacity-75">Seats {t.capacity}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}