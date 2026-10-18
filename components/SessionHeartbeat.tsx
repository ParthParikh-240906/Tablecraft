"use client";

import { useEffect } from "react";

/**
 * Keeps the Free-plan session lease alive while a tab is open, and releases it
 * on pagehide. Mounted only when the server knows the org is on Free.
 */
export function SessionHeartbeat({
  kind,
  orgId,
  orgSlug,
  enabled,
}: {
  kind: "site" | "console";
  orgId?: string;
  orgSlug?: string;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;
    if (!orgId && !orgSlug) return;

    const payload = JSON.stringify({ kind, orgId, orgSlug });
    let stopped = false;

    const ping = async () => {
      if (stopped) return;
      try {
        await fetch("/api/session/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      } catch {
        // Network hiccups are fine; the lease expires after 120s.
      }
    };

    void ping();
    const timer = setInterval(ping, 30_000);

    const onHide = () => {
      try {
        navigator.sendBeacon(
          "/api/session/release",
          new Blob([payload], { type: "application/json" }),
        );
      } catch {
        // best effort
      }
    };
    window.addEventListener("pagehide", onHide);

    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("pagehide", onHide);
    };
  }, [enabled, kind, orgId, orgSlug]);

  return null;
}
