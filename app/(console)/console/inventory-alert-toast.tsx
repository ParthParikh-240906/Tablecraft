"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SHOW_MS = 2000;

/**
 * The popup is intentionally tiny: it only announces "!! New Alert !!".
 * The actual list lives at /console/notifications.
 */
export function InventoryAlertToast({
  orgId,
  initialUnread,
}: {
  orgId: string;
  initialUnread: number;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCount = useRef(initialUnread);

  const show = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(true);
    hideTimer.current = setTimeout(() => setVisible(false), SHOW_MS);
  }, []);

  const refreshCount = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/inventory/notifications?org_id=${encodeURIComponent(orgId)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) return;
      const count = Number(data?.unreadCount ?? 0);
      if (count > lastCount.current) show();
      lastCount.current = count;
    } catch {
      // Silent: the toast is non-critical.
    }
  }, [orgId, show]);

  useEffect(() => {
    if (!orgId) return;
    if (initialUnread > 0) show();

    const supabase = createClient();
    const channel = supabase
      .channel(`inventory-alert-toast-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "inventory_notifications",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          show();
          void refreshCount();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "inventory_notifications",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          void refreshCount();
        },
      )
      .subscribe();

    const onChanged = () => void refreshCount();
    const onCleared = () => {
      lastCount.current = 0;
      setVisible(false);
    };
    window.addEventListener("inventory:changed", onChanged);
    window.addEventListener("inventory:notifications-cleared", onCleared);

    // Realtime is best-effort; a slow poll keeps cross-user order deductions
    // from being missed when the channel is unavailable.
    const poll = setInterval(() => void refreshCount(), 60_000);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      clearInterval(poll);
      window.removeEventListener("inventory:changed", onChanged);
      window.removeEventListener("inventory:notifications-cleared", onCleared);
      void supabase.removeChannel(channel);
    };
  }, [orgId, initialUnread, refreshCount, show]);

  if (!visible) return null;

  return (
    <button
      type="button"
      role="status"
      aria-live="polite"
      onClick={() => {
        setVisible(false);
        router.push(`/console/notifications${orgId ? `?org=${orgId}` : ""}`);
      }}
      className="fixed top-4 right-4 z-[60] rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-lg"
    >
      !! New Alert !!
    </button>
  );
}
