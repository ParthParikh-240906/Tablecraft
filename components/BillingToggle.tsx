"use client";

import type { BillingInterval } from "@/lib/pricing";

export function BillingToggle({
  value,
  onChange,
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Billing period"
      className="inline-flex items-center gap-1 rounded-full border border-[var(--rule-strong)] bg-[var(--paper)] p-1"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "monthly"}
        onClick={() => onChange("monthly")}
        className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
          value === "monthly"
            ? "bg-[var(--accent)] text-white"
            : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "annual"}
        onClick={() => onChange("annual")}
        className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
          value === "annual"
            ? "bg-[var(--accent)] text-white"
            : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
        }`}
      >
        Annual
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold leading-none ${
            value === "annual"
              ? "bg-white/20 text-white"
              : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          }`}
        >
          2 months free
        </span>
      </button>
    </div>
  );
}
