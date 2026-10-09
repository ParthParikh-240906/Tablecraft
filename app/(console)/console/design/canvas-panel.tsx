"use client";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { useDesign } from "./use-design";
import { ResizableBox } from "./resizable-box";
import { PreviewShell } from "./preview-shell";
import { DesignNav } from "./design-nav";
import { EditableCard, EditableColumns } from "./editable-card";
import { CanvasHeightControl } from "./canvas-height-control";
import { ColorField, DesignField, OpacityField } from "./design-fields";
import { useDesignDevice } from "./design-device";
import { AnimationBuilder } from "@/components/AnimationBuilder";
import { InteractionBuilder } from "@/components/InteractionBuilder";
import { type OrgView } from "@/components/OrgPageView";
import {
  LOCAL_FONTS,
  getColorOverride,
  getFontOverride,
  withColorOverride,
  withFontOverride,
  getLogoSizeOverride,
  withLogoSizeOverride,
  resolveLogoSize,
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
  const { settings, updateSettings, saving, saved, saveError, retrySave } = useDesign(initialSettings, orgId);
  const { device } = useDesignDevice();
  const [selected, setSelected] = useState<string | "hero" | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [previewHeight, setPreviewHeight] = useState(640);
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem("tablecraft_preview_height"));
      if (stored >= 640 && stored <= 3200) setPreviewHeight(stored);
    } catch {}
  }, []);

  const heroRect = settings.canvas.hero_rect;

  const selectedIsHero = selected === "hero";

  // Per-device font-size overrides (v1: size only). Off-desktop the size
  // inputs below show `override ?? base` and write into settings.responsive;
  // family / color always edit the shared base.
  const deviceLabel = device === "tablet" ? "Tablet" : "Mobile";
  const navOverride = getFontOverride(settings.responsive, device, "header.nav");
  const ctaOverride = getFontOverride(settings.responsive, device, "header.cta");
  const navColorOverride = getColorOverride(settings.responsive, device, "header.nav");
  const ctaColorOverride = getColorOverride(settings.responsive, device, "header.cta");
  const logoOverride = getLogoSizeOverride(settings.responsive, device);
  const logoBase = settings.header.logo_size ?? 32;
  const shownLogoSize = device !== "desktop" ? (logoOverride ?? logoBase) : logoBase;
  // Control-area thumbnail mirrors what the site header renders on this device.
  const previewLogoSize = resolveLogoSize(logoBase, device, settings.responsive);

  return (
    <div>
      <DesignNav />
      <div className="space-y-10">
        {/* ── Controls (full width, top) ───────────────────────── */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Design</h2>
            <span className="text-xs text-[var(--ink-faint)]">
              {saving ? "Saving…" : saveError ? "⚠ Not saved" : saved ? "✓ Saved" : ""}
            </span>
          </div>
          {saveError && (
            <div className="rounded-sm border border-red-800 bg-red-950/40 p-2 text-xs text-red-300 flex items-center justify-between gap-2">
              <span>{saveError}</span>
              <button type="button" onClick={() => retrySave()} className="underline shrink-0">Retry</button>
            </div>
          )}


          <EditableColumns left={<>
          {/* Page colors */}
          <EditableCard hover title="Page Colors">
            <ColorField label="Page Background" value={settings.background_color} onChange={(v) => updateSettings({ background_color: v })} />
            <ColorField label="Page Text" value={settings.text_color} onChange={(v) => updateSettings({ text_color: v })} />
            <ColorField label="Accent (buttons, links)" value={settings.accent_color} onChange={(v) => updateSettings({ accent_color: v })} />
            <ColorField label="Header Background" value={settings.header.background_color} onChange={(v) => updateSettings({ header: { ...settings.header, background_color: v } })} />
            <OpacityField label="Header Background Opacity (on scroll)" value={settings.header.opacity} onChange={(v) => updateSettings({ header: { ...settings.header, opacity: v } })} />
          </EditableCard>

          {/* Logo */}
          <EditableCard hover title="Logo">
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">
                Logo
              </label>
              <div className="flex items-center gap-2">
                {org.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logo_url} alt="Logo" className="rounded-full object-cover" style={{ width: previewLogoSize, height: previewLogoSize }} />
                ) : (
                  <span className="rounded-full flex items-center justify-center font-bold" style={{ width: previewLogoSize, height: previewLogoSize, fontSize: Math.round((previewLogoSize * 14) / 32), backgroundColor: settings.header.cta_design.bgColor, color: settings.header.logo_color }}>
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
                      setLogoError(null);
                      if (f.size > 5 * 1024 * 1024) { setLogoError("Logo exceeds 5MB — compress and try again."); e.target.value = ""; return; }
                      setLogoUploading(true);
                      try {
                        const form = new FormData();
                        form.append("file", f);
                        form.append("org_id", orgId);
                        const res = await fetch("/api/design/logo", { method: "POST", body: form });
                        if (res.ok) {
                          router.refresh();
                        } else {
                          const data = await res.json().catch(() => null);
                          setLogoError(data?.error ?? `Logo upload failed (${res.status}). Try again.`);
                        }
                      } catch {
                        setLogoError("Network error — logo not uploaded. Try again.");
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
                      setLogoError(null);
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
                          const data = await res.json().catch(() => null);
                          setLogoError(data?.error ?? `Failed to clear logo (${res.status}). Try again.`);
                        }
                      } catch {
                        setLogoError("Network error — logo not cleared. Try again.");
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
              {logoError && (
                <p className="text-xs text-red-400 border border-red-800 bg-red-950/40 p-2 rounded-sm mt-2">{logoError}</p>
              )}
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
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">
                Logo size · {shownLogoSize}px
              </label>
              <input
                type="range"
                min={16}
                max={64}
                step={1}
                value={Math.min(64, Math.max(16, shownLogoSize))}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10) || 32;
                  if (device !== "desktop") {
                    updateSettings((prev) => ({ responsive: withLogoSizeOverride(prev.responsive, device, next) }));
                  } else {
                    updateSettings({ header: { ...settings.header, logo_size: next } });
                  }
                }}
                className="w-full accent-[var(--accent)]"
              />
              {device !== "desktop" && (
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <p className="text-[10px] text-[var(--ink-faint)]">
                    {deviceLabel}: {logoOverride != null ? "custom" : `inherits desktop (${logoBase}px)`}
                  </p>
                  {logoOverride != null && (
                    <button
                      type="button"
                      onClick={() => updateSettings((prev) => ({ responsive: withLogoSizeOverride(prev.responsive, device, undefined) }))}
                      className="text-[10px] underline text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    >
                      Reset (inherits)
                    </button>
                  )}
                </div>
              )}
            </div>
            <ColorField label="Logo color" value={settings.header.logo_color} onChange={(v) => updateSettings({ header: { ...settings.header, logo_color: v } })} />
          </EditableCard>

          {/* Restaurant name */}
          <EditableCard hover title="Restaurant Name">
            <div>
              <p className="text-xs text-[var(--ink-soft)] mb-1">Restaurant name</p>
              <DesignField customFonts={settings.custom_fonts}
                label=""
                design={settings.header.design}
                onChange={(d) => updateSettings({ header: { ...settings.header, design: d } })}
                fontKey="header.brand"
                overrideValue={getFontOverride(settings.responsive, device, "header.brand")}
                onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "header.brand", v) }))}
                colorKey="header.brand"
                colorOverrideValue={getColorOverride(settings.responsive, device, "header.brand")}
                onOverrideColor={(v) => updateSettings((prev) => ({ responsive: withColorOverride(prev.responsive, device, "header.brand", v) }))}
              />
              <AnimationBuilder design={settings.header.design} onChange={(d) => updateSettings({ header: { ...settings.header, design: d } })} />
              <InteractionBuilder
                value={settings.header.design.interactive}
                defaultOn={false}
                onChange={(next) => updateSettings({ header: { ...settings.header, design: { ...settings.header.design, interactive: next } } })}
              />
            </div>
          </EditableCard>
          </>}
          right={<>

          {/* Menu link */}
          <EditableCard hover title="Menu">
              <div className="grid grid-cols-3 gap-2 items-end">
                <select
                  value={settings.header.nav_design.fontFamily}
                  onChange={(e) => updateSettings({ header: { ...settings.header, nav_design: { ...settings.header.nav_design, fontFamily: e.target.value } } })}
                  className="col-span-1 w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-xs"
                >
                  {[...LOCAL_FONTS, ...(settings.custom_fonts || [])].map((f) => (
                    <option key={`${f.name}::${f.value}`} value={f.value}>{f.name}</option>
                  ))}
                </select>
                <input
                  type="number" min={8} max={160}
                  value={device !== "desktop" ? (navOverride ?? settings.header.nav_design.fontSize) : settings.header.nav_design.fontSize}
                  onChange={(e) => {
                    const next = parseInt(e.target.value, 10) || 14;
                    if (device !== "desktop") updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "header.nav", next) }));
                    else updateSettings({ header: { ...settings.header, nav_design: { ...settings.header.nav_design, fontSize: next } } });
                  }}
                  className="col-span-1 w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-sm"
                />
                <div className="col-span-1">
                  <ColorField label="" value={device !== "desktop" ? (navColorOverride ?? settings.header.nav_design.color) : settings.header.nav_design.color} onChange={(v) => {
                    if (device !== "desktop") updateSettings((prev) => ({ responsive: withColorOverride(prev.responsive, device, "header.nav", v) }));
                    else updateSettings({ header: { ...settings.header, nav_design: { ...settings.header.nav_design, color: v } } });
                  }} />
                </div>
              </div>
              {device !== "desktop" && (
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <p className="text-[10px] text-[var(--ink-faint)]">
                    {deviceLabel}: {navOverride != null ? "custom size" : `inherits desktop (${settings.header.nav_design.fontSize}px)`} · {navColorOverride != null ? "custom color" : `inherits desktop (${settings.header.nav_design.color})`}
                  </p>
                  {navOverride != null && (
                    <button
                      type="button"
                      onClick={() => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "header.nav", undefined) }))}
                      className="text-[10px] underline text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    >
                      Reset size
                    </button>
                  )}
                  {navColorOverride != null && (
                    <button
                      type="button"
                      onClick={() => updateSettings((prev) => ({ responsive: withColorOverride(prev.responsive, device, "header.nav", undefined) }))}
                      className="text-[10px] underline text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    >
                      Reset color
                    </button>
                  )}
                </div>
              )}
          </EditableCard>

          {/* Book a table button */}
          <EditableCard hover title="Book a Table">
            <div>
              <p className="text-xs text-[var(--ink-soft)] mb-1">Book a table button</p>
              <div className="grid grid-cols-3 gap-2 items-end">
                <select
                  value={settings.header.cta_design.fontFamily}
                  onChange={(e) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, fontFamily: e.target.value } } })}
                  className="col-span-1 w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-xs"
                >
                  {[...LOCAL_FONTS, ...(settings.custom_fonts || [])].map((f) => (
                    <option key={`${f.name}::${f.value}`} value={f.value}>{f.name}</option>
                  ))}
                </select>
                <input
                  type="number" min={8} max={160}
                  value={device !== "desktop" ? (ctaOverride ?? settings.header.cta_design.fontSize) : settings.header.cta_design.fontSize}
                  onChange={(e) => {
                    const next = parseInt(e.target.value, 10) || 14;
                    if (device !== "desktop") updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "header.cta", next) }));
                    else updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, fontSize: next } } });
                  }}
                  className="col-span-1 w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-sm"
                />
                <div className="col-span-1">
                  <ColorField label="Text" value={device !== "desktop" ? (ctaColorOverride ?? settings.header.cta_design.textColor) : settings.header.cta_design.textColor} onChange={(v) => {
                    if (device !== "desktop") updateSettings((prev) => ({ responsive: withColorOverride(prev.responsive, device, "header.cta", v) }));
                    else updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, textColor: v } } });
                  }} />
                </div>
                <div className="col-span-1">
                  <ColorField label="BG" value={settings.header.cta_design.bgColor} onChange={(v) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, bgColor: v } } })} />
                </div>
                <div className="col-span-1">
                  <ColorField label="Border" value={settings.header.cta_design.borderColor} onChange={(v) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, borderColor: v } } })} />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] text-[var(--ink-soft)] mb-1">Radius: {Math.min(settings.header.cta_design.borderRadius, 24)}px</label>
                  <input type="range" min={0} max={24} step={1} value={Math.min(settings.header.cta_design.borderRadius, 24)}
                    onChange={(e) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, borderRadius: parseInt(e.target.value, 10) } } })}
                    className="w-full accent-[var(--accent)]" />
                </div>
                <div className="col-span-1">
                  <OpacityField label="Opacity" value={settings.header.cta_design.opacity ?? 100} onChange={(v) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, opacity: v } } })} />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] text-[var(--ink-soft)] mb-1">Width: {settings.header.cta_design.borderWidth}</label>
                  <input type="range" min={0} max={8} value={settings.header.cta_design.borderWidth}
                    onChange={(e) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, borderWidth: parseInt(e.target.value, 10) } } })}
                    className="w-full accent-[var(--accent)]" />
                </div>
              </div>
              {device !== "desktop" && (
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <p className="text-[10px] text-[var(--ink-faint)]">
                    {deviceLabel}: {ctaOverride != null ? "custom size" : `inherits desktop (${settings.header.cta_design.fontSize}px)`} · {ctaColorOverride != null ? "custom color" : `inherits desktop (${settings.header.cta_design.textColor})`}
                  </p>
                  {ctaOverride != null && (
                    <button
                      type="button"
                      onClick={() => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "header.cta", undefined) }))}
                      className="text-[10px] underline text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    >
                      Reset size
                    </button>
                  )}
                  {ctaColorOverride != null && (
                    <button
                      type="button"
                      onClick={() => updateSettings((prev) => ({ responsive: withColorOverride(prev.responsive, device, "header.cta", undefined) }))}
                      className="text-[10px] underline text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    >
                      Reset color
                    </button>
                  )}
                </div>
              )}
              <InteractionBuilder
                value={settings.header.cta_design.interactive}
                defaultOn={true}
                onChange={(next) => updateSettings({ header: { ...settings.header, cta_design: { ...settings.header.cta_design, interactive: next } } })}
              />
            </div>
          </EditableCard>

          {/* Header layout order */}
          <EditableCard hover title="Header Layout Order">
            <div>
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
          </EditableCard>

          {selectedIsHero && (
            <EditableCard hover title="Hero section">
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
            </EditableCard>
          )}
          </>}
          />
        </div>

        {/* ── Preview (full width, below) ──────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Live Preview</h2>
            <CanvasHeightControl
              previewHeight={previewHeight}
              setPreviewHeight={setPreviewHeight}
            />
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