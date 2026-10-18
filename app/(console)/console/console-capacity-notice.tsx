"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function ConsoleCapacityNotice({ orgId }: { orgId: string }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--paper)] text-[var(--ink)]">
      <div className="max-w-md text-center ticket p-8 border border-[var(--rule)] bg-[var(--paper-raised)]">
        <p className="text-4xl mb-4" aria-hidden="true">⏳</p>
        <p className="label-caps text-[color:var(--accent)] mb-2">Free plan capacity</p>
        <h1 className="font-display text-xl mb-2">Console is at capacity</h1>
        <p className="text-sm text-[var(--ink-soft)] mb-6">
          This restaurant has 2 active sessions across its website and console.
          Close another tab or wait a minute, then try again.
        </p>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="btn btn-accent text-xs"
          >
            Try again
          </button>
          <Link href={`/console?org=${orgId}`} className="text-[11px] text-[var(--ink-faint)] hover:underline">
            Retry console
          </Link>
          <p className="text-[10px] text-[var(--ink-faint)]">
            This page refreshes automatically every 30 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
