"use client";

import { useState } from "react";
import { useTableRealtime, type TableStatus } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";

const STATUS_STYLES: Record<TableStatus, string> = {
  open: "bg-green-900/40 text-green-300 border-green-800",
  occupied: "bg-red-900/40 text-red-300 border-red-800",
  reserved: "bg-amber-900/40 text-amber-300 border-amber-800",
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
        <h1 className="font-display text-xl">Tables</h1>
        <span className="text-xs text-[var(--ink-faint)]">
          {connected ? "● Live" : "○ Connecting…"}
        </span>
      </div>
      <p className="text-sm text-[var(--ink-faint)] mb-4">
        Click a table to cycle its status: open → occupied → reserved.
      </p>

        {sorted.length === 0 ? (
          <div className="rounded-sm border border-dashed border-[var(--rule)] p-10 text-center text-[var(--ink-faint)]">
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
                className={`rounded-sm border p-4 text-left transition-colors ${STATUS_STYLES[t.status]} ${
                  updating === t.id ? "opacity-50 cursor-wait" : "hover:opacity-90"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg">{t.label}</span>
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