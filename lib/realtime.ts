"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TableStatus = "open" | "occupied" | "reserved";

export interface TableRow {
  id: string;
  org_id: string;
  label: string;
  capacity: number;
  status: TableStatus;
  table_type: "movable" | "non-movable";
}

/**
 * Subscribe to realtime changes on the `tables` table for a given org.
 *
 * Used by BOTH the operator console (to broadcast status changes) and the
 * public site (to reflect them live without a page reload).
 *
 * Returns the current list of tables, kept in sync via the Realtime channel.
 * The channel is scoped to the org via a Postgres filter on org_id.
 */
export function useTableRealtime(orgId: string | null) {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();

    // Initial fetch so we render data immediately, then stay in sync.
    let active = true;
    supabase
      .from("tables")
      .select("id, org_id, label, capacity, status, table_type")
      .eq("org_id", orgId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("useTableRealtime: initial fetch failed", error);
          return;
        }
        setTables((data ?? []) as TableRow[]);
      });

    const channel = supabase
      .channel(`tables-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tables",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const row = payload.new as TableRow | null;
          const oldRow = payload.old as TableRow | null;

          setTables((prev) => {
            switch (payload.eventType) {
              case "INSERT":
                return row && !prev.some((t) => t.id === row.id)
                  ? [...prev, row]
                  : prev;
              case "UPDATE":
                return row
                  ? prev.map((t) => (t.id === row.id ? row : t))
                  : prev;
              case "DELETE":
                return oldRow
                  ? prev.filter((t) => t.id !== oldRow.id)
                  : prev;
              default:
                return prev;
            }
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnected(true);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnected(false);
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  return { tables, connected };
}