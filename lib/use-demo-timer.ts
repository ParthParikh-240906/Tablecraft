"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const INACTIVITY_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Hook to track demo session inactivity and auto-logout on timeout.
 * Call this in the console layout or a root console component.
 */
export function useDemoTimer(isDemo: boolean, orgId: string) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (!isDemo) return;

    function resetTimer() {
      hasRestoredRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (hasRestoredRef.current) return;
        hasRestoredRef.current = true;

        try {
          // Try to restore from snapshot
          await fetch("/api/demo/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orgId }),
          });
        } catch {
          // Ignore restore errors
        } finally {
          // Always logout on timeout
          await fetch("/api/demo/logout", { method: "POST" });
          router.push("/");
          router.refresh();
        }
      }, INACTIVITY_MS);
    }

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((evt) => window.addEventListener(evt, resetTimer));
    resetTimer();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isDemo, orgId, router]);
}
