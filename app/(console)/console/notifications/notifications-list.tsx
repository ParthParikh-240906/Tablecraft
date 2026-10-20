"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { InventoryNotification } from "@/types/inventory";

export function NotificationsList({
  orgId,
  initial,
}: {
  orgId: string;
  initial: InventoryNotification[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<InventoryNotification[]>(initial);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    const res = await fetch(`/api/inventory/notifications?org_id=${encodeURIComponent(orgId)}`);
    const data = await res.json().catch(() => null);
    if (res.ok && Array.isArray(data?.notifications)) {
      setRows(data.notifications as InventoryNotification[]);
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`inventory-notifications-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_notifications",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, refresh]);

  async function clearAll() {
    if (!orgId || clearing) return;
    setClearing(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/notifications/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not clear notifications.");
        return;
      }
      setRows([]);
      window.dispatchEvent(new CustomEvent("inventory:notifications-cleared", { detail: { orgId } }));
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-xl">Notifications</h1>
          <p className="text-xs text-[var(--ink-faint)] mt-1">
            Low and out-of-stock alerts for this restaurant.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/console/inventory${orgId ? `?org=${orgId}` : ""}`} className="btn btn-outline">
            Open inventory
          </Link>
          <button
            type="button"
            onClick={clearAll}
            disabled={clearing || rows.length === 0}
            className="btn btn-accent"
          >
            {clearing ? "Clearing…" : "Clear all"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-red-300 bg-red-50 p-3 text-xs text-red-800">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-sm border border-dashed border-[var(--rule)] p-10 text-center text-sm text-[var(--ink-faint)]">
          No notifications. Stock alerts will appear here when an ingredient goes low or runs out.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`rounded-sm border p-3 ${
                row.type === "out"
                  ? "border-red-300 bg-red-50"
                  : "border-amber-300 bg-amber-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex w-2 h-2 rounded-full shrink-0 ${
                    row.type === "out" ? "bg-red-500" : "bg-amber-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${row.type === "out" ? "text-red-900" : "text-amber-900"}`}>
                    {row.title}
                  </p>
                  {row.body && (
                    <p className={`text-xs mt-0.5 ${row.type === "out" ? "text-red-800" : "text-amber-800"}`}>
                      {row.body}
                    </p>
                  )}
                  <p className="text-[10px] text-[var(--ink-faint)] mt-1">
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                    row.type === "out"
                      ? "border-red-300 bg-white/60 text-red-800"
                      : "border-amber-300 bg-white/60 text-amber-800"
                  }`}
                >
                  {row.type === "out" ? "Out of stock" : "Low stock"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
