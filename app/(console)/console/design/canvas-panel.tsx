"use client";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { useDesign } from "./use-design";
import { ResizableBox } from "./resizable-box";
import { PreviewShell } from "./preview-shell";
import { DesignNav } from "./design-nav";
import { ColorField, DesignField, OpacityField } from "./design-fields";
import { AnimationBuilder } from "@/components/AnimationBuilder";
import { type OrgView } from "@/components/OrgPageView";
import {
  LOCAL_FONTS,
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
  const [previewHeight, setPreviewHeight] = useState(640);
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem("tablecraft_preview_height"));
      if ([640, 960, 1280].includes(stored)) setPreviewHeight(stored);
    } catch {}
  }, []);

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
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">
              Page Colors
            </h3>
            <ColorField label="Page Background" value={settings.background_color} onChange={(v) => updateSettings({ background_color: v })} />
            <ColorField label="Page Text" value={settings.text_color} onChange={(v) => updateSettings({ text_color: v })} />
            <ColorField label="Accent (buttons, links)" value={settings.accent_color} onChange={(v) => updateSettings({ accent_color: v })} />
          </section>

          {/* Header */}
          <section className="ticket p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">Header</h3>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">
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
                  {logoUploading ? "Uploading…" : "Upload logo"}
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
                  <button
                    type="button"
                    disabled={logoUploading}
                    onClick={async () => {
                      setLogoUploading(true);
                      try {
                        const res = await fetch("/api/design/logo", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ org_id: orgId }),
                        });
                        if (res.ok) {
                          router.refresh();
                        } else {
                          const data = await res.json();
                          alert(data.error ?? "Failed to clear logo");
                        }
                      } finally {
                        setLogoUploading(false);
                      }
                    }}
                    className="text-xs text-red-500 underline"
                  >
                    Clear logo
                  </button>
                )}
              </div>
            </div>
            <ColorField label="Logo border color" value={settings.header.logo_border_color} onChange={(v) => updateSettings({ header: { ...settings.header, logo_border_color: v } })} />
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">
                Logo border thickness · {settings.header.logo_border_width}px
              </label>
              <input
                type="range"
                min={0}
                max={8}
                value={settings.header.logo_border_width}
                onChange={(e) => updateSettings({ header: { ...settings.header, logo_border_width: parseInt(e.target.value, 10) } })}
                className="w-full accent-[var(--accent)]"
              />
            </div>
            <ColorField label="Header Background" value={settings.header.background_color} onChange={(v) => updateSettings({ header: { ...settings.header, background_color: v } })} />
            <OpacityField label="Header Background Opacity (on scroll)" value={settings.header.opacity} onChange={(v) => updateSettings({ header: { ...settings.header, opacity: v } })} />
            <ColorField label="Logo color" value={settings.header.logo_color} onChange={(v) => updateSettings({ header: { ...settings.header, logo_color: v } })} />
            <div>
              <p className="text-xs text-[var(--ink-soft)] mb-1">Restaurant name</p>
              <DesignField customFonts={settings.custom_fonts}
                label=""
                design={settings.header.design}
                onChange={(d) => updateSettings({ header: { ...settings.header, design: d } })}
              />
              <AnimationBuilder design={settings.header.design} onChange={(d) => updateSettings({ header: { ...settings.header, design: d } })} />
            </div>
            <div>
              <p className="text-xs text-[var(--ink-soft)] mb-1">Nav text (Menu / Cart)</p>
              <div className="grid grid-cols-3 gap-2 items-end">
                <select
                  value={settings.header.nav_design.fontFamily}
                  onChange={(e) => updateSettings({ header: { ...settings.header, nav_design: { ...settings.header.nav_design, fontFamily: e.target.value } } })}
                  className="col-span-1 w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-xs"
                >
                  {[...LOCAL_FONTS, ...(settings.custom_fonts || [])].map((f) => (
                    <option key={f.value} value={f.value}>{f.name}</option>
                  ))}
                </select>
                <input
                  type="number" min={8} max={160}
                  value={settings.header.nav_design.fontSize}
                  onChange={(e) => updateSettings({ header: { ...settings.header, nav_design: { ...settings.header.nav_design, fontSize: parseInt(e.target.value, 10) || 14 } } })}
                  className="col-span-1 w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-sm"
                />
                <div className="col-span-1">
                  <ColorField label="" value={settings.header.nav_design.color} onChange={(v) => updateSettings({ header: { ...settings.header, nav_design: { ...settings.header.nav_design, color: v } } })} />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--ink-soft)] mb-1">Book a table button</p>
              <div className="grid grid-cols-3 gap-2 items-end">
                <select
                  value={settings.header.cta_design.fontFamily}
                  onChange={(e) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, fontFamily: e.target.value } } })}
                  className="col-span-1 w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-xs"
                >
                  {[...LOCAL_FONTS, ...(settings.custom_fonts || [])].map((f) => (
                    <option key={f.value} value={f.value}>{f.name}</option>
                  ))}
                </select>
                <input
                  type="number" min={8} max={160}
                  value={settings.header.cta_design.fontSize}
                  onChange={(e) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, fontSize: parseInt(e.target.value, 10) || 14 } } })}
                  className="col-span-1 w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-sm"
                />
                <div className="col-span-1">
                  <ColorField label="Text" value={settings.header.cta_design.textColor} onChange={(v) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, textColor: v } } })} />
                </div>
                <div className="col-span-1">
                  <ColorField label="BG" value={settings.header.cta_design.bgColor} onChange={(v) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, bgColor: v } } })} />
                </div>
                <div className="col-span-1">
                  <ColorField label="Border" value={settings.header.cta_design.borderColor} onChange={(v) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, borderColor: v } } })} />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] text-[var(--ink-soft)] mb-1">Radius: {settings.header.cta_design.borderRadius}</label>
                  <input type="range" min={0} max={9999} value={settings.header.cta_design.borderRadius}
                    onChange={(e) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, borderRadius: parseInt(e.target.value, 10) } } })}
                    className="w-full accent-[var(--accent)]" />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] text-[var(--ink-soft)] mb-1">Width: {settings.header.cta_design.borderWidth}</label>
                  <input type="range" min={0} max={8} value={settings.header.cta_design.borderWidth}
                    onChange={(e) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, borderWidth: parseInt(e.target.value, 10) } } })}
                    className="w-full accent-[var(--accent)]" />
                </div>
              </div>
            </div>

            {/* Header element order */}
            <div className="pt-2 border-t border-[var(--rule)]">
              <p className="text-xs font-medium text-[var(--ink-soft)] mb-2">Header layout order</p>
              <ul className="space-y-1">
                {(settings.header.header_elements ?? [
                  { id: "h-logo", kind: "logo" as const },
                  { id: "h-name", kind: "name" as const },
                  { id: "h-menu", kind: "menu_link" as const },
                  { id: "h-book", kind: "book_button" as const },
                ]).map((el, i, arr) => (
                  <li key={el.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => {
                        const next = [...(settings.header.header_elements ?? arr)];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        updateSettings({ header: { ...settings.header, header_elements: next } });
                      }}
                      className="px-1.5 py-0.5 text-xs rounded border border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-25 disabled:cursor-not-allowed"
                    >↑</button>
                    <span className="text-xs text-[var(--ink)] flex-1 capitalize">
                      {el.kind === "logo" && "🖼 Logo"}
                      {el.kind === "name" && "🏷 Restaurant name"}
                      {el.kind === "menu_link" && "📋 Menu link"}
                      {el.kind === "book_button" && "📅 Book a table button"}
                    </span>
                    <button
                      type="button"
                      disabled={i === arr.length - 1}
                      onClick={() => {
                        const next = [...(settings.header.header_elements ?? arr)];
                        [next[i], next[i + 1]] = [next[i + 1], next[i]];
                        updateSettings({ header: { ...settings.header, header_elements: next } });
                      }}
                      className="px-1.5 py-0.5 text-xs rounded border border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-25 disabled:cursor-not-allowed"
                    >↓</button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {selectedIsHero && (
            <section className="ticket p-5 space-y-3">
              <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">
                Hero section
              </h3>
              <label className="block text-xs text-[var(--ink-soft)] mb-1">
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
            <span className="text-[10px] text-[var(--ink-faint)]">{previewHeight}px</span>
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