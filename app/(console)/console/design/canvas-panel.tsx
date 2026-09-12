"use client";

import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { useDesign } from "./use-design";
import { ResizableBox } from "./resizable-box";
import { PreviewShell } from "./preview-shell";
import { DesignNav } from "./design-nav";
import { ColorField, DesignField, OpacityField } from "./design-fields";
import { type OrgView } from "@/components/OrgPageView";
import {
  newLayer,
  GOOGLE_FONTS,
  type DesignSettingsV2,
  type Layer,
  type LayerType,
} from "@/lib/design";

const LAYER_TYPES: { type: LayerType; label: string }[] = [
  { type: "color", label: "Color" },
  { type: "image", label: "Image" },
  { type: "images", label: "Images" },
  { type: "video", label: "Video" },
];

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
  layers,
  heroRect,
  selected,
  onSelect,
  onLayerChange,
  onHeroRectChange,
}: {
  layers: Layer[];
  heroRect: { y: number; h: number };
  selected: string | "hero" | null;
  onSelect: (id: string | "hero") => void;
  onLayerChange: (id: string, r: { x: number; y: number; w: number; h: number }) => void;
  onHeroRectChange: (h: number) => void;
}) {
  const layerSlot = useOverlaySlot("layers");
  const bandSlot = useOverlaySlot("hero-band");

  return (
    <>
      {layerSlot &&
        createPortal(
          <div className="absolute inset-0 z-30 pointer-events-none">
            {layers.map((l) => (
              <ResizableBox
                key={l.id}
                rect={l}
                onChange={(r) => onLayerChange(l.id, r)}
                selected={selected === l.id}
                onSelect={() => onSelect(l.id)}
                zIndex={l.z + 1}
                label={LAYER_TYPES.find((t) => t.type === l.type)?.label}
                className="pointer-events-auto"
              />
            ))}
          </div>,
          layerSlot,
        )}
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
  const { settings, updateSettings, saving, saved } = useDesign(initialSettings, orgId);
  const [selected, setSelected] = useState<string | "hero" | null>(null);
  const [addType, setAddType] = useState<LayerType | null>(null);
  const [previewHeight, setPreviewHeight] = useState(() => {
    try {
      const stored = Number(localStorage.getItem("tablecraft_preview_height"));
      return [640, 960, 1280].includes(stored) ? stored : 640;
    } catch { return 640; }
  });

  const layers = settings.canvas.layers;
  const heroRect = settings.canvas.hero_rect;

  const updateLayer = (id: string, patch: Partial<Layer>) => {
    updateSettings({
      canvas: {
        ...settings.canvas,
        layers: layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      },
    });
  };

  const removeLayer = (id: string) => {
    updateSettings({ canvas: { ...settings.canvas, layers: layers.filter((l) => l.id !== id) } });
    setSelected(null);
  };

  const addLayer = (type: LayerType) => {
    const z = layers.length;
    const layer = newLayer(type, z);
    updateSettings({ canvas: { ...settings.canvas, layers: [...layers, layer] } });
    setSelected(layer.id);
    setAddType(null);
  };

  const moveLayer = (id: string, dir: -1 | 1) => {
    const sorted = [...layers].sort((a, b) => a.z - b.z);
    const i = sorted.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    const [a, b] = [sorted[i], sorted[j]];
    updateSettings({
      canvas: {
        ...settings.canvas,
        layers: layers.map((l) =>
          l.id === a.id ? { ...l, z: b.z } : l.id === b.id ? { ...l, z: a.z } : l,
        ),
      },
    });
  };

  const uploadLayerFile = async (file: File, kind: "image" | "video") => {
    const form = new FormData();
    form.append("file", file);
    form.append("org_id", orgId);
    const res = await fetch(kind === "image" ? "/api/design/photos/upload" : "/api/design/video", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    return res.ok ? (data.url as string) : null;
  };

  const selectedLayer = layers.find((l) => l.id === selected);
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

          {/* Layers */}
          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
              Layers
            </h3>
            <div className="space-y-1">
              {layers.map((l) => (
                <div
                  key={l.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded border text-xs ${
                    selected === l.id ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--rule)]"
                  }`}
                >
                  <button type="button" onClick={() => setSelected(l.id)} className="flex-1 text-left">
                    <span className="font-mono mr-2 text-[10px] opacity-60">Z{l.z}</span>
                    {LAYER_TYPES.find((t) => t.type === l.type)?.label}
                  </button>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => moveLayer(l.id, -1)} className="text-[var(--ink-faint)] px-1" title="Bring forward">↑</button>
                    <button type="button" onClick={() => moveLayer(l.id, 1)} className="text-[var(--ink-faint)] px-1" title="Send backward">↓</button>
                    <button type="button" onClick={() => removeLayer(l.id)} className="text-red-500">✕</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {LAYER_TYPES.map((t) => (
                <button key={t.type} type="button" onClick={() => (addType === t.type ? setAddType(null) : setAddType(t.type))} className="btn btn-outline text-xs">
                  {addType === t.type ? "Cancel" : `+ ${t.label}`}
                </button>
              ))}
            </div>
            {addType && (
              <button type="button" onClick={() => addLayer(addType)} className="block w-full text-left px-3 py-2 text-xs border border-[var(--accent)]/50 rounded hover:bg-[var(--accent)]/10 text-[var(--accent)]">
                Place {LAYER_TYPES.find((t) => t.type === addType)?.label} on canvas
              </button>
            )}
          </section>

          {/* Selected layer / hero settings */}
          {selectedLayer && (
            <section className="ticket p-5 space-y-3">
              <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
                Selected layer — {LAYER_TYPES.find((t) => t.type === selectedLayer.type)?.label}
              </h3>
              {selectedLayer.type === "color" && (
                <ColorField label="Color" value={selectedLayer.color ?? "#141414"} onChange={(v) => updateLayer(selectedLayer.id, { color: v })} />
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Border width: {selectedLayer.borderWidth ?? 0}</label>
                  <input type="range" min={0} max={8} value={selectedLayer.borderWidth ?? 0}
                    onChange={(e) => updateLayer(selectedLayer.id, { borderWidth: parseInt(e.target.value, 10) })}
                    className="w-full accent-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Border radius: {selectedLayer.borderRadius ?? 0}px</label>
                  <input type="range" min={0} max={200} value={selectedLayer.borderRadius ?? 0}
                    onChange={(e) => updateLayer(selectedLayer.id, { borderRadius: parseInt(e.target.value, 10) })}
                    className="w-full accent-[var(--accent)]" />
                </div>
                <ColorField label="Border color" value={selectedLayer.borderColor ?? "#ffffff"} onChange={(v) => updateLayer(selectedLayer.id, { borderColor: v })} />
                <div>
                  <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">Opacity: {selectedLayer.opacity}%</label>
                  <input type="range" min={0} max={100} value={selectedLayer.opacity}
                    onChange={(e) => updateLayer(selectedLayer.id, { opacity: parseInt(e.target.value, 10) })}
                    className="w-full accent-[var(--accent)]" />
                </div>
              </div>
              {selectedLayer.type === "image" && (
                <div className="space-y-2">
                  <label className="btn btn-outline text-xs cursor-pointer inline-block">
                    {selectedLayer.image_url ? "Replace Image" : "Upload Image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const url = await uploadLayerFile(f, "image");
                        if (url) updateLayer(selectedLayer.id, { image_url: url, type: "image" });
                      }}
                    />
                  </label>
                  {selectedLayer.image_url && (
                    <button type="button" onClick={() => updateLayer(selectedLayer.id, { image_url: undefined })} className="block text-xs text-red-500 underline">
                      Remove image
                    </button>
                  )}
                </div>
              )}
              {selectedLayer.type === "images" && (
                <div className="space-y-2">
                  <label className="btn btn-outline text-xs cursor-pointer inline-block">
                    Add Images
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files) return;
                        for (const f of Array.from(files)) {
                          const url = await uploadLayerFile(f, "image");
                          if (url) updateLayer(selectedLayer.id, { image_urls: [...(selectedLayer.image_urls ?? []), url], type: "images" });
                        }
                      }}
                    />
                  </label>
                  {(selectedLayer.image_urls ?? []).length > 0 && (
                    <ul className="space-y-1">
                      {selectedLayer.image_urls?.map((u, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs">
                          <span className="flex-1 truncate text-[var(--ink-faint)]">{u}</span>
                          <button type="button" className="text-red-500" onClick={() => updateLayer(selectedLayer.id, { image_urls: selectedLayer.image_urls?.filter((_, j) => j !== i) })}>✕</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {selectedLayer.type === "video" && (
                <div className="space-y-2">
                  <label className="btn btn-outline text-xs cursor-pointer inline-block">
                    {selectedLayer.video_url ? "Replace Video" : "Upload Video (MP4/WebM, ≤25MB)"}
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const url = await uploadLayerFile(f, "video");
                        if (url) updateLayer(selectedLayer.id, { video_url: url });
                      }}
                    />
                  </label>
                  {selectedLayer.video_url && (
                    <button type="button" onClick={() => updateLayer(selectedLayer.id, { video_url: undefined })} className="block text-xs text-red-500 underline">
                      Remove video
                    </button>
                  )}
                </div>
              )}
              <OpacityField label="Layer Opacity" value={selectedLayer.opacity ?? 100} onChange={(v) => updateLayer(selectedLayer.id, { opacity: v })} />
            </section>
          )}

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
            Drag layers and the hero band in the preview.
          </p>
        </div>
      </div>

      {/* Overlay portals */}
      <CanvasOverlay
        layers={layers}
        heroRect={heroRect}
        selected={selected ?? null}
        onSelect={(id) => setSelected(id)}
        onLayerChange={(id, r) => updateLayer(id, r)}
        onHeroRectChange={(h) => updateSettings({ canvas: { ...settings.canvas, hero_rect: { ...heroRect, h } } })}
      />
    </div>
  );
}