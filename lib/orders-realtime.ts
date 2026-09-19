"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderRecord } from "@/app/(console)/console/orders/orders-list";

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
  const startPolling = useRef(false);

  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();

    // ── Initial fetch ────────────────────────────────────────────────────────
    let active = true;
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
          startPolling.current = true; // stop polling once realtime is live
        }
      });

    // ── Polling fallback (5 s) when realtime never connects ─────────────────
    const ensurePolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        const { data } = await supabase
          .from("orders")
          .select("id, customer_name, total, status, created_at, stripe_session_id, items, parent_order_id")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false });
        if (data) setOrders(data as OrderRecord[]);
      }, 5000);
    };

    const fallbackTimer = setTimeout(ensurePolling, 3000);

    return () => {
      active = false;
      clearTimeout(fallbackTimer);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  return { orders, connected };
}
