"use client";

import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { useDesign } from "../use-design";
import { ResizableBox } from "../resizable-box";
import { PreviewShell } from "../preview-shell";
import { DesignNav } from "../design-nav";
import { ColorField, DesignField, OpacityField } from "../design-fields";
import { type OrgView } from "@/components/OrgPageView";
import {
  newHeroElement,
  type DesignSettingsV2,
  type HeroBackground,
  type HeroElement,
  type LayerType,
} from "@/lib/design";

const KIND_LABELS: Record<string, string> = {
  logo: "Logo",
  title: "Restaurant name",
  tagline: "Tagline",
  text: "Text",
};

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

function HeroOverlay({
  elements,
  selected,
  onSelect,
  onUpdate,
}: {
  elements: HeroElement[];
  selected: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<HeroElement>) => void;
}) {
  const slot = useOverlaySlot("hero");
  if (!slot) return null;
  return createPortal(
    <div className="absolute inset-0 pointer-events-auto">
      {elements.map((el) => (
        <ResizableBox
          key={el.id}
          rect={{ x: el.x, y: el.y, w: el.w, h: el.h }}
          onChange={(r) => onUpdate(el.id, r)}
          selected={selected === el.id}
          onSelect={() => onSelect(el.id)}
          zIndex={31}
          label={KIND_LABELS[el.kind]}
        />
      ))}
    </div>,
    slot,
  );
}

export function HeroPanel({
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
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState<"text" | "title" | null>(null);

  const bg = settings.hero.background;
  const elements = settings.hero.elements;

  const updateBg = (patch: Partial<HeroBackground>) => {
    updateSettings({ hero: { ...settings.hero, background: { ...bg, ...patch } } });
  };

  const setBgType = (type: LayerType) => updateBg({ type });

  const updateEl = (id: string, patch: Partial<HeroElement>) => {
    updateSettings({
      hero: {
        ...settings.hero,
        elements: elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      },
    });
  };

  const removeEl = (id: string) => {
    updateSettings({ hero: { ...settings.hero, elements: elements.filter((e) => e.id !== id) } });
    setSelected(null);
  };

  const addEl = (kind: "text" | "title") => {
    const el = newHeroElement(kind, kind === "title" ? 30 : 18);
    updateSettings({ hero: { ...settings.hero, elements: [...elements, el] } });
    setSelected(el.id);
    setAdding(null);
  };

  const uploadSingle = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("org_id", orgId);
    const res = await fetch("/api/design/photos/upload", { method: "POST", body: form });
    return res.ok ? ((await res.json()).url as string) : null;
  };

  const uploadVideo = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("org_id", orgId);
    const res = await fetch("/api/design/video", { method: "POST", body: form });
    const data = await res.json();
    return res.ok ? (data.url as string) : (alert(data.error ?? "Upload failed"), null);
  };

  const sel = elements.find((e) => e.id === selected);

  return (
    <div>
      <DesignNav />
      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* ── Controls ─────────────────────────────────────────── */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Hero</h2>
            <span className="text-xs text-[var(--ink-faint)]">
              {saving ? "Saving…" : saved ? "✓ Saved" : ""}
            </span>
          </div>

          {/* Hero background */}
          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
              Hero Background
            </h3>
            <div className="flex flex-wrap gap-2">
              {(["color", "image", "images", "video"] as LayerType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBgType(t)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    bg.type === t
                      ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                      : "border-[var(--rule)] text-[var(--ink-soft)]"
                  }`}
                >
                  {t === "images" ? "Images (carousel)" : t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {bg.type === "color" && (
              <ColorField label="Hero Color" value={bg.color ?? "#141414"} onChange={(v) => updateBg({ color: v })} />
            )}
            {bg.type === "image" && (
              <div className="space-y-2">
                <label className="btn btn-outline text-xs cursor-pointer inline-block">
                  {bg.image_url ? "Replace Image" : "Upload Image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await uploadSingle(f);
                      if (!url) return;
                      const ratio =
                        await new Promise<number>((resolve) => {
                          const img = new Image();
                          img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 16 / 9);
                          img.onerror = () => resolve(16 / 9);
                          img.src = url;
                        });
                      updateBg({ image_url: url, aspectRatio: ratio });
                    }}
                  />
                </label>
                {bg.image_url && (
                  <button type="button" onClick={() => updateBg({ image_url: undefined })} className="block text-xs text-red-500 underline">
                    Remove image
                  </button>
                )}
              </div>
            )}
            {bg.type === "images" && (
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
                        const url = await uploadSingle(f);
                        if (url) updateBg({ image_urls: [...(bg.image_urls ?? []), url] });
                      }
                    }}
                  />
                </label>
                {(bg.image_urls ?? []).length > 0 && (
                  <ul className="text-xs space-y-1">
                    {bg.image_urls?.map((u, i) => (
                      <li key={i} className="flex items-center gap-2 border rounded px-2 py-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" className="h-6 w-6 object-cover rounded" />
                        <span className="flex-1 truncate text-[var(--ink-faint)]">{u}</span>
                        <button
                          type="button"
                          className="text-red-500"
                          onClick={() => updateBg({ image_urls: bg.image_urls?.filter((_, j) => j !== i) })}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {bg.type === "video" && (
              <div className="space-y-2">
                <label className="btn btn-outline text-xs cursor-pointer inline-block">
                  {bg.video_url ? "Replace Video" : "Upload Video (MP4/WebM, ≤25MB)"}
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await uploadVideo(f);
                      if (url) updateBg({ video_url: url });
                    }}
                  />
                </label>
                {bg.video_url && (
                  <button type="button" onClick={() => updateBg({ video_url: undefined })} className="block text-xs text-red-500 underline">
                    Remove video
                  </button>
                )}
              </div>
            )}
            <OpacityField
              label="Background Opacity"
              value={bg.opacity}
              onChange={(v) => updateBg({ opacity: v })}
            />
          </section>

          {/* Hero elements */}
          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
              Text &amp; Logo
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdding(adding ? null : "text")}
                className="btn btn-outline text-xs"
              >
                {adding === "text" ? "Cancel" : "+ Text"}
              </button>
              <button
                type="button"
                onClick={() => setAdding(adding ? null : "title")}
                className="btn btn-outline text-xs"
              >
                {adding === "title" ? "Cancel" : "+ Title"}
              </button>
            </div>

            {adding && (
              <button
                type="button"
                onClick={() => addEl(adding)}
                className="block w-full text-left px-3 py-2 text-xs border border-[var(--accent)]/50 rounded hover:bg-[var(--accent)]/10 text-[var(--accent)]"
              >
                Place {adding} on canvas
              </button>
            )}

            <div className="space-y-1">
              {elements.map((el) => (
                <button
                  key={el.id}
                  type="button"
                  onClick={() => setSelected(el.id === selected ? null : el.id)}
                  className={`block w-full text-left px-3 py-1.5 text-xs rounded transition-colors ${
                    selected === el.id ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--rule)]"
                  }`}
                >
                  <span className="font-mono mr-2 text-[10px] opacity-60">{el.kind.slice(0, 3).toUpperCase()}</span>
                  {el.kind === "logo" ? "Org logo" : el.kind === "title" ? "Restaurant name" : el.kind === "tagline" ? "Tagline" : "Free text"}
                </button>
              ))}
            </div>
          </section>

          {/* Selected element */}
          {sel && (
            <section className="ticket p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
                  Edit {KIND_LABELS[sel.kind]}
                </h3>
                <button type="button" onClick={() => removeEl(sel.id)} className="text-red-500 underline text-[10px]">
                  Delete
                </button>
              </div>
              {sel && (sel.kind === "text" || sel.kind === "title") && (
                <div className="space-y-2">
                  <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                    {sel.kind === "title" ? "Title text" : "Text content"}
                  </label>
                  <textarea
                    rows={3}
                    value={sel.content ?? ""}
                    onChange={(e) => updateEl(sel.id, { content: e.target.value })}
                    className="w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-3 py-2 text-sm resize-y"
                  />
                </div>
              )}
              <DesignField
                label=""
                design={sel.design}
                onChange={(d) => updateEl(sel.id, { design: d })}
              />
            </section>
          )}
        </div>

        {/* ── Preview ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Live Preview</h2>
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
            onGrowHero={(id, h) => updateEl(id, { h })}
          />
        </div>
      </div>

      {/* Hero element overlay portals */}
      <HeroOverlay
        elements={elements}
        selected={selected ?? null}
        onSelect={(id) => setSelected(id)}
        onUpdate={updateEl}
      />
    </div>
  );
}