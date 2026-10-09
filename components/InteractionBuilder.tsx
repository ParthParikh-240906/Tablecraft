"use client";

import type { InteractiveDesign } from "@/lib/design";
import { resolveInteractive } from "@/lib/design";

/**
 * Console editor for guest-facing hover interactivity (lift / shadow /
 * brighten). Same inherit-by-default methodology as the per-device controls:
 * absent = context default (buttons on, everything else off); explicit flags
 * win; Reset removes the key and restores the default. Device-shared like
 * animation/shadow — per-device sizes and colors keep working underneath.
 */
export function InteractionBuilder({
  value,
  defaultOn,
  onChange,
}: {
  value: InteractiveDesign | undefined;
  /** True for buttons (on unless removed), false for text/shapes/images (off unless added). */
  defaultOn: boolean;
  /** Called with the next flags object, or `undefined` to reset to default. */
  onChange: (next: InteractiveDesign | undefined) => void;
}) {
  const eff = resolveInteractive(value, defaultOn);
  const customized = value !== undefined;

  const set = (patch: Partial<InteractiveDesign>) => {
    onChange({ ...(value ?? {}), ...patch });
  };

  const num = (raw: string, fallback: number) => {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  };

  return (
    <div className="space-y-2 pt-2 border-t border-[var(--rule)]">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)]">
          Interactive hover
        </label>
        {customized && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[10px] underline text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            Reset to default
          </button>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={eff.hoverLift}
              onChange={(e) => set({ hoverLift: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            <span className="text-[var(--ink)]">Lift</span>
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-[var(--ink-soft)]">
            Up
            <input
              type="number"
              min={0}
              max={48}
              value={eff.liftPx}
              onChange={(e) => set({ liftPx: num(e.target.value, eff.liftPx) })}
              className="w-14 bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-1.5 py-0.5 text-xs text-[var(--ink)]"
            />
            px
          </label>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={eff.hoverShadow}
              onChange={(e) => set({ hoverShadow: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            <span className="text-[var(--ink)]">Shadow</span>
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-[var(--ink-soft)]">
            Color
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(eff.shadowColor) ? eff.shadowColor : "#000000"}
              onChange={(e) => set({ shadowColor: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-[var(--ink-soft)]">
            Length
            <input
              type="number"
              min={0}
              max={64}
              value={eff.shadowLength}
              onChange={(e) => set({ shadowLength: num(e.target.value, eff.shadowLength) })}
              className="w-14 bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-1.5 py-0.5 text-xs text-[var(--ink)]"
            />
            px
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={eff.hoverBrighten}
            onChange={(e) => set({ hoverBrighten: e.target.checked })}
            className="accent-[var(--accent)]"
          />
          <span className="text-[var(--ink)]">Brighten</span>
          <span className="text-[10px] text-[var(--ink-faint)]">— brightens the whole button, all colors</span>
        </label>
      </div>
      <p className="text-[10px] text-[var(--ink-faint)]">
        {defaultOn
          ? "On by default for buttons — uncheck to remove."
          : "Off by default — check to add."}{" "}
        Same on desktop, tablet and mobile; sizes and colors can still vary per device.
      </p>
    </div>
  );
}
