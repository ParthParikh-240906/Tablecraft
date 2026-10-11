"use client";

import { useEffect, useState, useRef } from "react";
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
 * Falls back to polling every 5s if the realtime channel never reaches
 * SUBSCRIBED, so the UI always shows current data even when the realtime
 * WebSocket can't be established.
 */
export function useTableRealtime(orgId: string | null) {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const setTablesRef = useRef(setTables);
  setTablesRef.current = setTables;

  // Poll interval ref so we can clear it on unmount.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tracks whether realtime is actually live. The 3s fallback timer must NOT
  // start polling once SUBSCRIBED fired — otherwise every tab polls forever
  // alongside realtime and load grows without bound.
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();

    // ── Initial fetch ────────────────────────────────────────────────────────
    let active = true;
    subscribedRef.current = false;
    async function refresh() {
      const { data, error } = await supabase
        .from("tables")
        .select("id, org_id, label, capacity, status, table_type")
        .eq("org_id", orgId);
      if (!active) return;
      if (error) {
        console.error("[realtime] initial fetch failed:", error);
        return;
      }
      setTables((data ?? []) as TableRow[]);
    }
    refresh();

    // ── Polling fallback (15 s) when realtime never connects ─────────────────
    // Skipped while the tab is hidden so background tabs don't burn quota.
    // Never starts once SUBSCRIBED fired.
    const ensurePolling = () => {
      if (!active || subscribedRef.current || pollRef.current) return;
      pollRef.current = setInterval(async () => {
        if (document.hidden) return;
        const { data } = await supabase
          .from("tables")
          .select("id, org_id, label, capacity, status, table_type")
          .eq("org_id", orgId);
        if (data) setTables(data as TableRow[]);
      }, 15000);
    };

    let fallbackTimer: ReturnType<typeof setTimeout> | null = setTimeout(ensurePolling, 3000);

    // ── Realtime channel ─────────────────────────────────────────────────────
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
        if (!active) return;
        if (process.env.NODE_ENV === "development") {
          console.log("[realtime] channel status:", status);
        }
        if (status === "SUBSCRIBED") {
          setConnected(true);
          setConnectError(null);
          subscribedRef.current = true;
          // Realtime is live — cancel the pending fallback and any polling
          // so we don't run a redundant request loop forever.
          if (fallbackTimer) {
            clearTimeout(fallbackTimer);
            fallbackTimer = null;
          }
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnected(false);
          setConnectError(
            status === "CHANNEL_ERROR"
              ? "WebSocket connection failed — check Supabase Realtime settings"
              : "Connection timed out",
          );
          // Realtime is down — fall back to polling.
          subscribedRef.current = false;
          ensurePolling();
        }
      });

    return () => {
      active = false;
      subscribedRef.current = false;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  return { tables, connected, setTables: setTablesRef, setTablesState: setTables, connectError };
}