"use client";

import { useEffect, useState } from "react";
import { useTableRealtime, type TableStatus } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";

const STATUS_BADGE: Record<TableStatus, { label: string; style: string }> = {
  open: {
    label: "Open",
    style: "bg-emerald-950/60 text-emerald-300 border-emerald-800",
  },
  occupied: {
    label: "Occupied",
    style: "bg-red-950/60 text-red-300 border-red-800",
  },
  reserved: {
    label: "Reserved",
    style: "bg-amber-950/60 text-amber-300 border-amber-800",
  },
};

export function TableGrid({ orgId }: { orgId: string }) {
  const { tables, connected } = useTableRealtime(orgId);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newCapacity, setNewCapacity] = useState("4");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch upcoming confirmed bookings so tables auto-show as reserved
  // starting 2 hours before their booking time (computed, not stored).
  // Also pulls booking_tables junction to get ALL tables involved in each booking.
  const [upcomingTableIds, setUpcomingTableIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    supabase
      .from("bookings")
      .select("id, table_id, datetime, status")
      .eq("org_id", orgId)
      .eq("status", "confirmed")
      .gte("datetime", twoHoursAgo)
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Failed to fetch upcoming bookings:", error);
          return;
        }
        const ids = new Set<string>();
        for (const b of data ?? []) ids.add(b.table_id);
        // Also collect tables from the booking_tables junction
        if (ids.size > 0) {
          const { data: jt } = await supabase
            .from("booking_tables")
            .select("table_id")
            .in("booking_id", [...ids]);
          for (const row of jt ?? []) ids.add(row.table_id);
        }
        setUpcomingTableIds(ids);
      });

    return () => {
      active = false;
    };
  }, [orgId, supabase]);

  async function handleAddTable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const capacityNum = parseInt(newCapacity, 10);
    if (!newLabel.trim() || isNaN(capacityNum) || capacityNum <= 0) {
      setError("Please provide a valid table name/number and capacity.");
      return;
    }

    setAdding(true);
    const { error: insertError } = await supabase.from("tables").insert({
      org_id: orgId,
      label: newLabel.trim(),
      capacity: capacityNum,
      status: "open",
    });

    if (insertError) {
      setError(insertError.message);
      setAdding(false);
      return;
    }

    setNewLabel("");
    setNewCapacity("4");
    setShowAddForm(false);
    setAdding(false);
  }

  async function setTableStatus(tableId: string, status: TableStatus) {
    setUpdating(tableId);
    const { error } = await supabase
      .from("tables")
      .update({ status })
      .eq("id", tableId);

    if (error) {
      console.error("setTableStatus failed:", error);
    }
    setUpdating(null);
  }

  async function handleDeleteTable(tableId: string, label: string) {
    if (!confirm(`Are you sure you want to delete ${label}?`)) {
      return;
    }

    setUpdating(tableId);
    const { error } = await supabase
      .from("tables")
      .delete()
      .eq("id", tableId);

    if (error) {
      console.error("handleDeleteTable failed:", error);
    }
    setUpdating(null);
  }

  const sorted = [...tables].sort((a, b) => a.label.localeCompare(b.label));

  // Compute derived status: a table is "reserved" if it's in an upcoming
  // booking (checked via booking_tables junction for multi-table bookings).
  function getDerivedStatus(t: { id: string; status: TableStatus }) {
    if (upcomingTableIds.has(t.id)) {
      return { status: "reserved" as TableStatus, booking: null };
    }
    return { status: t.status, booking: null };
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-xl">Tables</h1>
          <p className="text-xs text-[var(--ink-soft)] mt-0.5">
            Monitor floor state in real time and switch table statuses instantly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--ink-faint)]">
            {connected ? "● Live" : "○ Connecting…"}
          </span>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="btn btn-accent text-xs"
          >
            {showAddForm ? "Cancel" : "+ Add table"}
          </button>
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddTable} className="ticket p-5 mb-6 space-y-4">
          <h2 className="font-medium text-sm text-[var(--ink)]">Add New Table</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="tableLabel" className="block text-xs uppercase tracking-wider font-semibold mb-1 text-[var(--ink-soft)]">
                Table Name / Number
              </label>
              <input
                id="tableLabel"
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Table 1, Patio 4, Bar 2"
                required
                className="input"
              />
            </div>
            <div>
              <label htmlFor="tableCapacity" className="block text-xs uppercase tracking-wider font-semibold mb-1 text-[var(--ink-soft)]">
                Capacity (Seats)
              </label>
              <input
                id="tableCapacity"
                type="number"
                min="1"
                max="50"
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value)}
                required
                className="input"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 border border-red-800 bg-red-950/40 p-2 rounded-sm">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={adding} className="btn btn-accent text-xs">
              {adding ? "Adding…" : "Save table"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="btn btn-outline text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-sm border border-dashed border-[var(--rule)] p-10 text-center text-[var(--ink-faint)]">
          No tables yet. Add your first table above.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {sorted.map((t) => {
          const derived = getDerivedStatus(t);
          const effectiveStatus = derived.status;
          const badge = STATUS_BADGE[effectiveStatus];
          const isUpdating = updating === t.id;

            return (
              <div
                key={t.id}
                className="ticket p-4 flex flex-col justify-between space-y-4 bg-[var(--paper-raised)] border border-[var(--rule)] rounded-sm"
              >
          <div>
            <div className="flex items-center justify-between">
              <span className="font-display text-lg text-[var(--ink)]">{t.label}</span>
              <span
                className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${badge.style}`}
              >
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-[var(--ink-faint)] mt-1">
              Seats {t.capacity} {t.capacity === 1 ? "guest" : "guests"}
            </p>
          </div>

                <div className="pt-2 border-t border-[var(--rule)] flex flex-col gap-2">
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-[var(--ink-soft)]">
                    Change Status:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      disabled={isUpdating || t.status === "open"}
                      onClick={() => setTableStatus(t.id, "open")}
                      className={`text-xs py-1 px-1.5 text-center font-medium rounded-sm border transition-colors ${
                        t.status === "open"
                          ? "bg-emerald-900/50 text-emerald-300 border-emerald-700 shadow-inner"
                          : "border-[var(--rule)] text-[var(--ink-soft)] hover:bg-emerald-950/20 hover:text-emerald-300"
                      }`}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating || t.status === "occupied"}
                      onClick={() => setTableStatus(t.id, "occupied")}
                      className={`text-xs py-1 px-1.5 text-center font-medium rounded-sm border transition-colors ${
                        t.status === "occupied"
                          ? "bg-red-900/50 text-red-300 border-red-700 shadow-inner"
                          : "border-[var(--rule)] text-[var(--ink-soft)] hover:bg-red-950/20 hover:text-red-300"
                      }`}
                    >
                      Occupied
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating || t.status === "reserved"}
                      onClick={() => setTableStatus(t.id, "reserved")}
                      className={`text-xs py-1 px-1.5 text-center font-medium rounded-sm border transition-colors ${
                        t.status === "reserved"
                          ? "bg-amber-900/50 text-amber-300 border-amber-700 shadow-inner"
                          : "border-[var(--rule)] text-[var(--ink-soft)] hover:bg-amber-950/20 hover:text-amber-300"
                      }`}
                    >
                      Reserved
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleDeleteTable(t.id, t.label)}
                    disabled={isUpdating}
                    className="text-[11px] text-[var(--ink-faint)] hover:text-red-400 underline transition-colors"
                  >
                    Delete Table
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}