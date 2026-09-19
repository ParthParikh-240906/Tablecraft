"use client";

import { useState } from "react";
import { LOCAL_FONTS } from "@/lib/design";
import type { TextDesign } from "@/lib/design";

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [hexDraft, setHexDraft] = useState<string | null>(null);

  const commitHex = (raw: string) => {
    const t = raw.trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t)) {
      // Expand 3-digit shorthand (#abc → #aabbcc) for the native picker
      const full = t.length === 4
        ? "#" + t.slice(1).split("").map((c) => c + c).join("")
        : t.toLowerCase();
      onChange(full);
      setHexDraft(null);
    } else if (t === "") {
      setHexDraft(null);
    }
  };

  return (
    <div>
      <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1">
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
          className="w-24 bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1 text-xs font-mono text-[var(--ink)]"
        />
      </div>
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
      <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1">
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
  onChange,
}: {
  label: string;
  design: TextDesign;
  onChange: (d: TextDesign) => void;
}) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)]">
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
            {LOCAL_FONTS.map((f) => (
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
            value={design.fontSize}
            onChange={(e) =>
              onChange({ ...design, fontSize: parseInt(e.target.value, 10) || 12 })
            }
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
            <span className="text-[10px] font-mono text-[var(--ink-soft)]">{design.color}</span>
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
    </div>
  );
}