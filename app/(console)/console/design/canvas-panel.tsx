"use client";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { useDesign } from "./use-design";
import { ResizableBox } from "./resizable-box";
import { PreviewShell } from "./preview-shell";
import { DesignNav } from "./design-nav";
import { ColorField, DesignField, OpacityField } from "./design-fields";
import { type OrgView } from "@/components/OrgPageView";
import {
  GOOGLE_FONTS,
  type DesignSettingsV2,
} from "@/lib/design";

function useOverlaySlot(name: string) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const q = () => setEl(document.querySelector(`[data-panel-overlays="${name}"]`) as HTMLElement | null);
    q();
    const t = setInterval(q, 500);
    return () => clearInterval(t);
  }, [name]);
  return el;
}

function CanvasOverlay({
  heroRect,
  selected,
  onSelect,
  onHeroRectChange,
}: {
  heroRect: { y: number; h: number };
  selected: string | "hero" | null;
  onSelect: (id: string | "hero") => void;
  onHeroRectChange: (h: number) => void;
}) {
  const bandSlot = useOverlaySlot("hero-band");

  return (
    <>
      {bandSlot &&
        createPortal(
          <div className="absolute inset-0 z-20 pointer-events-none">
            <ResizableBox
              rect={{ x: 0, y: heroRect.y, w: 100, h: heroRect.h }}
              onChange={(r) => onHeroRectChange(Math.min(90, Math.max(10, r.h)))}
              selected={selected === "hero"}
              onSelect={() => onSelect("hero")}
              zIndex={21}
              label="Hero section"
              lockMove
              className="pointer-events-auto border border-dashed border-white/30"
            />
          </div>,
          bandSlot,
        )}
    </>
  );
}

export function CanvasPanel({
  orgId,
  orgName,
  initialSettings,
  org,
  paragraphs,
}: {
  orgId: string;
  orgName: string;
  initialSettings: DesignSettingsV2;
  org: OrgView;
  paragraphs: { id: string; title: string | null; content: string | null }[];
}) {
  const router = useRouter();
  const { settings, updateSettings, saving, saved } = useDesign(initialSettings, orgId);
  const [selected, setSelected] = useState<string | "hero" | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(() => {
    try {
      const stored = Number(localStorage.getItem("tablecraft_preview_height"));
      return [640, 960, 1280].includes(stored) ? stored : 640;
    } catch { return 640; }
  });

  const heroRect = settings.canvas.hero_rect;

  const selectedIsHero = selected === "hero";

  return (
    <div>
      <DesignNav />
      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* ── Controls ─────────────────────────────────────────── */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Design</h2>
            <span className="text-xs text-[var(--ink-faint)]">
              {saving ? "Saving…" : saved ? "✓ Saved" : ""}
            </span>
          </div>

          {/* Page colors */}
          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
              Page Colors
            </h3>
            <ColorField label="Page Background" value={settings.background_color} onChange={(v) => updateSettings({ background_color: v })} />
            <ColorField label="Page Text" value={settings.text_color} onChange={(v) => updateSettings({ text_color: v })} />
            <ColorField label="Accent (buttons, links)" value={settings.accent_color} onChange={(v) => updateSettings({ accent_color: v })} />
          </section>

          {/* Header */}
          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Header</h3>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1">
                Logo
              </label>
              <div className="flex items-center gap-2">
                {org.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logo_url} alt="Logo" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: settings.header.cta_design.bgColor, color: settings.header.logo_color }}>
                    {orgName.charAt(0).toUpperCase()}
                  </span>
                )}
                <label className="btn btn-outline text-xs cursor-pointer inline-block">
                  {logoUploading ? "Uploading…" : org.logo_url ? "Replace logo" : "Upload logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={logoUploading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setLogoUploading(true);
                      try {
                        const form = new FormData();
                        form.append("file", f);
                        form.append("org_id", orgId);
                        const res = await fetch("/api/design/logo", { method: "POST", body: form });
                        if (res.ok) {
                          router.refresh();
                        } else {
                          const data = await res.json();
                          alert(data.error ?? "Logo upload failed");
                        }
                      } finally {
                        setLogoUploading(false);
                      }
                    }}
                  />
                </label>
                {org.logo_url && (
                  <span className="text-[10px] text-[var(--ink-faint)]">Shown in header & hero</span>
                )}
              </div>
            </div>
            <ColorField label="Header Background" value={settings.header.background_color} onChange={(v) => updateSettings({ header: { ...settings.header, background_color: v } })} />
            <OpacityField label="Header Background Opacity (on scroll)" value={settings.header.opacity} onChange={(v) => updateSettings({ header: { ...settings.header, opacity: v } })} />
            <ColorField label="Logo color" value={settings.header.logo_color} onChange={(v) => updateSettings({ header: { ...settings.header, logo_color: v } })} />
            <div>
              <p className="text-xs font-mono text-[var(--ink-soft)] mb-1">Restaurant name</p>
              <DesignField
                label=""
                design={settings.header.design}
                onChange={(d) => updateSettings({ header: { ...settings.header, design: d } })}
              />
            </div>
            <div>
              <p className="text-xs font-mono text-[var(--ink-soft)] mb-1">Nav text (Menu / Cart)</p>
              <div className="grid grid-cols-3 gap-2 items-end">
                <select
                  value={settings.header.nav_design.fontFamily}
                  onChange={(e) => updateSettings({ header: { ...settings.header, nav_design: { ...settings.header.nav_design, fontFamily: e.target.value } } })}
                  className="col-span-1 w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-xs"
                >
                  {GOOGLE_FONTS.map((f) => (
                    <option key={f.value} value={f.value}>{f.name}</option>
                  ))}
                </select>
                <input
                  type="number" min={8} max={160}
                  value={settings.header.nav_design.fontSize}
                  onChange={(e) => updateSettings({ header: { ...settings.header, nav_design: { ...settings.header.nav_design, fontSize: parseInt(e.target.value, 10) || 14 } } })}
                  className="col-span-1 w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-sm"
                />
                <div className="col-span-1 flex items-center gap-1">
                  <input type="color" value={settings.header.nav_design.color}
                    onChange={(e) => updateSettings({ header: { ...settings.header, nav_design: { ...settings.header.nav_design, color: e.target.value } } })}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                  <span className="text-[10px] font-mono text-[var(--ink-soft)]">{settings.header.nav_design.color}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-mono text-[var(--ink-soft)] mb-1">Book a table button</p>
              <div className="grid grid-cols-3 gap-2 items-end">
                <select
                  value={settings.header.cta_design.fontFamily}
                  onChange={(e) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, fontFamily: e.target.value } } })}
                  className="col-span-1 w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-xs"
                >
                  {GOOGLE_FONTS.map((f) => (
                    <option key={f.value} value={f.value}>{f.name}</option>
                  ))}
                </select>
                <input
                  type="number" min={8} max={160}
                  value={settings.header.cta_design.fontSize}
                  onChange={(e) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, fontSize: parseInt(e.target.value, 10) || 14 } } })}
                  className="col-span-1 w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-sm"
                />
                <div className="col-span-1 flex items-center gap-1">
                  <input type="color" value={settings.header.cta_design.textColor}
                    onChange={(e) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, textColor: e.target.value } } })}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                  <span className="text-[10px] font-mono text-[var(--ink-soft)]">{settings.header.cta_design.textColor}</span>
                </div>
                <div className="col-span-1 flex items-center gap-1">
                  <span className="text-[10px] font-mono text-[var(--ink-soft)]">BG</span>
                  <input type="color" value={settings.header.cta_design.bgColor}
                    onChange={(e) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, bgColor: e.target.value } } })}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                </div>
                <div className="col-span-1 flex items-center gap-1">
                  <span className="text-[10px] font-mono text-[var(--ink-soft)]">Border</span>
                  <input type="color" value={settings.header.cta_design.borderColor}
                    onChange={(e) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, borderColor: e.target.value } } })}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Radius: {settings.header.cta_design.borderRadius}</label>
                  <input type="range" min={0} max={9999} value={settings.header.cta_design.borderRadius}
                    onChange={(e) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, borderRadius: parseInt(e.target.value, 10) } } })}
                    className="w-full accent-[var(--accent)]" />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Width: {settings.header.cta_design.borderWidth}</label>
                  <input type="range" min={0} max={8} value={settings.header.cta_design.borderWidth}
                    onChange={(e) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, borderWidth: parseInt(e.target.value, 10) } } })}
                    className="w-full accent-[var(--accent)]" />
                </div>
              </div>
            </div>
          </section>

          {selectedIsHero && (
            <section className="ticket p-5 space-y-3">
              <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
                Hero section
              </h3>
              <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                Hero band height (%)
              </label>
              <input
                type="number"
                min={10}
                max={90}
                value={heroRect.h}
                onChange={(e) => updateSettings({ canvas: { ...settings.canvas, hero_rect: { ...heroRect, h: Math.min(90, Math.max(10, Number(e.target.value))) } } })}
                className="w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-3 py-2 text-sm"
              />
              <p className="text-xs text-[var(--ink-soft)]">
                Drag the dashed band in the preview to resize. Reach the content
                section or edit the hero band from the Hero page.
              </p>
            </section>
          )}
        </div>

        {/* ── Preview ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Live Preview</h2>
          <div className="flex items-center gap-2 mb-2">
            <button type="button" onClick={() => setPreviewHeight((h) => {
              const next = h === 640 ? 960 : h === 960 ? 1280 : 640;
              try { localStorage.setItem("tablecraft_preview_height", String(next)); } catch {}
              return next;
            })} className="btn btn-outline text-xs px-2">
              {previewHeight === 640 ? "Extend canvas (1.5×)" : previewHeight === 960 ? "Extend canvas (2×)" : "Collapse canvas"}
            </button>
            <span className="text-[10px] font-mono text-[var(--ink-faint)]">{previewHeight}px</span>
          </div>
          <PreviewShell
            settings={settings}
            org={org}
            paragraphs={paragraphs}
            colors={{
              bg: settings.background_color,
              text: settings.text_color,
              accent: settings.accent_color,
            }}
            orgName={orgName}
            previewHeight={previewHeight}
          />
          <p className="text-xs text-[var(--ink-soft)] text-center">
            Drag the hero band in the preview.
          </p>
        </div>
      </div>

      {/* Overlay portals */}
      <CanvasOverlay
        heroRect={heroRect}
        selected={selected ?? null}
        onSelect={(id) => setSelected(id)}
        onHeroRectChange={(h) => updateSettings({ canvas: { ...settings.canvas, hero_rect: { ...heroRect, h } } })}
      />
    </div>
  );
}