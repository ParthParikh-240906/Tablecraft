"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const INACTIVITY_MS = 3 * 60 * 1000; // 3 minutes

interface DemoModeProviderProps {
  isDemo: boolean;
  orgId: string;
  orgSlug: string;
}

/**
 * Client-side provider that manages demo session inactivity timeout.
 * Shows a countdown banner and auto-logs out after 3 minutes of no activity.
 */
export function DemoModeProvider({ isDemo, orgId, orgSlug }: DemoModeProviderProps) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(INACTIVITY_MS / 1000);
  const [isRestoring, setIsRestoring] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRestoredRef = useRef(false);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  function resetActivity() {
    hasRestoredRef.current = false;
    setTimeLeft(INACTIVITY_MS / 1000);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (hasRestoredRef.current) return;
      hasRestoredRef.current = true;
      setIsRestoring(true);

      try {
        await fetch("/api/demo/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId }),
        });
      } catch {
        // ignore restore errors
      } finally {
        await fetch("/api/demo/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }
    }, INACTIVITY_MS);
  }

  useEffect(() => {
    if (!isDemo) return;

    countdownRef.current = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((evt) => window.addEventListener(evt, resetActivity));
    resetActivity();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isDemo, orgId, router]);

  async function handleExitDemo() {
    setIsRestoring(true);
    try {
      await fetch("/api/demo/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
    } catch {
      // ignore restore errors
    } finally {
      await fetch("/api/demo/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    }
  }

  if (!isDemo) return null;

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-lg">🧪</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-yellow-800">
            Demo Mode — {orgSlug}
          </span>
          <span className="text-xs text-yellow-600">
            Changes reset after {timeStr} of inactivity
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {isRestoring && (
          <span className="text-xs text-yellow-600 animate-pulse">Restoring data…</span>
        )}
        <button
          onClick={handleExitDemo}
          className="text-xs text-yellow-700 hover:text-yellow-900 underline font-medium"
        >
          Exit Demo
        </button>
      </div>
    </div>
  );
}
