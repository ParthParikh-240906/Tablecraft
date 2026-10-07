"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderRecord } from "@/types/orders";

/**
 * Subscribe to realtime + polling fallback for orders in a given org.
 *
 * Mirrors useTableRealtime pattern — tries Supabase Realtime first,
 * falls back to 5s polling if the WebSocket never reaches SUBSCRIBED.
 */
export function useOrdersRealtime(orgId: string | null, initialOrders: OrderRecord[]) {
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [connected, setConnected] = useState(false);

  const setOrdersRef = useRef(setOrders);
  setOrdersRef.current = setOrders;

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks whether realtime is actually live — see lib/realtime.ts. The 3s
  // fallback must not start polling once SUBSCRIBED fired.
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();

    // ── Initial fetch ────────────────────────────────────────────────────────
    let active = true;
    subscribedRef.current = false;
    async function refresh() {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_name, total, status, created_at, stripe_session_id, items, parent_order_id")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (!active) return;
      setOrders((data ?? []) as OrderRecord[]);
    }
    refresh();

    // ── Polling fallback (15 s) when realtime never connects ────────────────
    // Skipped while the tab is hidden so background tabs don't burn quota.
    // Never starts once SUBSCRIBED fired.
    const ensurePolling = () => {
      if (!active || subscribedRef.current || pollRef.current) return;
      pollRef.current = setInterval(async () => {
        if (document.hidden) return;
        const { data } = await supabase
          .from("orders")
          .select("id, customer_name, total, status, created_at, stripe_session_id, items, parent_order_id")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false });
        if (data) setOrders(data as OrderRecord[]);
      }, 15000);
    };

    let fallbackTimer: ReturnType<typeof setTimeout> | null = setTimeout(ensurePolling, 3000);

    // ── Realtime channel ─────────────────────────────────────────────────────
    const channel = supabase
      .channel(`orders-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const row = payload.new as OrderRecord | null;
          const oldRow = payload.old as OrderRecord | null;
          if (!row && !oldRow) return;

          setOrdersRef.current((prev) => {
            switch (payload.eventType) {
              case "INSERT":
                return row && !prev.some((o) => o.id === row.id)
                  ? [...prev, row].sort(
                      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                    )
                  : prev;
              case "UPDATE":
                return row ? prev.map((o) => (o.id === row.id ? row : o)) : prev;
              case "DELETE":
                return oldRow ? prev.filter((o) => o.id !== oldRow.id) : prev;
              default:
                return prev;
            }
          });
        },
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setConnected(true);
          subscribedRef.current = true;
          // Realtime is live — cancel the pending fallback and any polling.
          if (fallbackTimer) {
            clearTimeout(fallbackTimer);
            fallbackTimer = null;
          }
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnected(false);
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

  return { orders, connected };
}
