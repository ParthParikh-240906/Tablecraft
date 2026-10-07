"use client";

import { useState } from "react";
import { LOCAL_FONTS } from "@/lib/design";
import type { TextDesign } from "@/lib/design";
import { useDesignDevice } from "./design-device";

function parseHexColor(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast hint: warns when fg-on-bg text falls below AA (4.5:1). Renders nothing when passing or when colors are unknown/invalid. */
export function ContrastHint({ fg, bg }: { fg?: string; bg?: string }) {
  if (!fg || !bg) return null;
  const f = parseHexColor(fg);
  const b = parseHexColor(bg);
  if (!f || !b) return null;
  const l1 = relativeLuminance(f);
  const l2 = relativeLuminance(b);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  if (ratio >= 4.5) return null;
  return (
    <p className="text-[11px] text-amber-400 mt-1">
      Low contrast ({ratio.toFixed(1)}:1) — text may be hard to read.
    </p>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  bgColor,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Background the color is rendered on — enables the contrast hint. Omit to hide it. */
  bgColor?: string;
}) {
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [hexError, setHexError] = useState(false);

  const commitHex = (raw: string) => {
    const t = raw.trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t)) {
      // Expand 3-digit shorthand (#abc → #aabbcc) for the native picker
      const full = t.length === 4
        ? "#" + t.slice(1).split("").map((c) => c + c).join("")
        : t.toLowerCase();
      onChange(full);
      setHexDraft(null);
      setHexError(false);
    } else if (t === "") {
      setHexDraft(null);
      setHexError(false);
    } else {
      setHexError(true);
    }
  };

  return (
    <div>
      <label className="block label-caps mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded cursor-pointer border-0 bg-transparent shrink-0"
        />
        <input
          type="text"
          value={hexDraft ?? value}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={(e) => commitHex(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commitHex((e.target as HTMLInputElement).value); }}
          placeholder="#000000"
          className="w-24 bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1 text-xs text-[var(--ink)]"
        />
      </div>
      {bgColor ? <ContrastHint fg={value} bg={bgColor} /> : null}
      {hexError && (
        <p className="text-[10px] text-amber-400 mt-1">Invalid hex — use #RGB or #RRGGBB.</p>
      )}
    </div>
  );
}

export function OpacityField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block label-caps mb-1">
        {label} · {value}%
      </label>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-[var(--accent)]"
      />
    </div>
  );
}

export function DesignField({
  label,
  design,
  customFonts = [],
  onChange,
  fontKey,
  overrideValue,
  onOverrideFontSize,
}: {
  label: string;
  design: TextDesign;
  customFonts?: { name: string; value: string; url?: string; weight?: number }[];
  onChange: (d: TextDesign) => void;
  /**
   * Per-device font-size editing (v1: size only). Pass the exact font key
   * (e.g. `hero:${id}`, `header.brand`, `menu.item_name`) to enable it.
   * Omit for today's base-only behavior.
   */
  fontKey?: string;
  /**
   * Resolved size override for the current non-desktop device, or
   * null/undefined when inheriting the desktop base size. Computed by the
   * owning panel from `settings.responsive`.
   */
  overrideValue?: number | null;
  /** Called with the new size, or `undefined` to reset to inherit. */
  onOverrideFontSize?: (v: number | undefined) => void;
}) {
  const fonts = [...LOCAL_FONTS, ...customFonts];
  const { device } = useDesignDevice();
  // Only SIZE is per-device in v1, and only off desktop. Family / color /
  // align always edit the shared base. Without a fontKey (or without the
  // panel's override handler) this is exactly today's base editor.
  const perDevice = fontKey !== undefined && device !== "desktop" && onOverrideFontSize !== undefined;
  const isCustom = perDevice && overrideValue != null;
  const shownSize = perDevice ? (overrideValue ?? design.fontSize) : design.fontSize;
  const deviceLabel = device === "tablet" ? "Tablet" : "Mobile";
  return (
    <div className="space-y-2">
      {label && (
        <label className="block label-caps">
          {label}
        </label>
      )}
      <div className="grid grid-cols-4 gap-2 items-end">
        <div className="col-span-1">
          <select
            value={design.fontFamily}
            onChange={(e) => onChange({ ...design, fontFamily: e.target.value })}
            className="w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-xs"
          >
            {fonts.map((f) => (
              <option key={f.name} value={f.value}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-1">
          <input
            type="number"
            min={8}
            max={160}
            value={shownSize}
            onChange={(e) => {
              const next = parseInt(e.target.value, 10) || 12;
              if (perDevice && onOverrideFontSize) onOverrideFontSize(next);
              else onChange({ ...design, fontSize: next });
            }}
            className="w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div className="col-span-1">
          <div className="flex items-center gap-1">
            <input
              type="color"
              value={design.color}
              onChange={(e) => onChange({ ...design, color: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="text-[10px] text-[var(--ink-soft)]">{design.color}</span>
          </div>
        </div>
        <div className="col-span-1">
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => onChange({ ...design, textAlign: a })}
                className={`flex-1 py-1 text-xs border rounded transition-colors ${
                  design.textAlign === a
                    ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                    : "border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--ink)]"
                }`}
              >
                {a[0].toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-[var(--ink-soft)] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={design.gradient ?? false}
          onChange={(e) => onChange({ ...design, gradient: e.target.checked ? true : undefined })}
          className="accent-[var(--accent)]"
        />
        Accent gradient
      </label>
      {perDevice && (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[10px] text-[var(--ink-faint)]">
            {deviceLabel}: {isCustom ? "custom" : `inherits desktop (${design.fontSize}px)`}
          </p>
          {isCustom && onOverrideFontSize && (
            <button
              type="button"
              onClick={() => onOverrideFontSize(undefined)}
              className="text-[10px] underline text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              Reset (inherits)
            </button>
          )}
        </div>
      )}
      {perDevice && (
        <p className="text-[10px] text-[var(--ink-faint)]">
          Font family &amp; color are shared across devices — only size varies per device.
        </p>
      )}
    </div>
  );
}