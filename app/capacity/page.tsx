import type { Metadata } from "next";
import { CapacityRetry } from "./capacity-retry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Temporarily at capacity",
  robots: { index: false, follow: false },
};

export default async function CapacityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const kind = params.kind === "console" ? "console" : "site";
  const isConsole = kind === "console";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--paper)] text-[var(--ink)]">
      <div className="max-w-md text-center ticket p-8 border border-[var(--rule)] bg-[var(--paper-raised)]">
        <p className="text-4xl mb-4" aria-hidden="true">⏳</p>
        <p className="label-caps text-[color:var(--accent)] mb-2">Free plan capacity</p>
        <h1 className="font-display text-xl mb-2">
          {isConsole ? "Console is at capacity" : "This site is at capacity"}
        </h1>
        <p className="text-sm text-[var(--ink-soft)] mb-6">
          {isConsole
            ? "This restaurant is using both of its Free-plan sessions. Close another console tab or wait a minute, then try again."
            : "Two people are currently using this restaurant's Free-plan website or console. Please try again in a minute."}
        </p>
        <div className="flex flex-col items-center gap-2">
          <CapacityRetry />
          <p className="text-[10px] text-[var(--ink-faint)]">
            This page refreshes automatically every 30 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
