"use client";

import { createPortal } from "react-dom";
import { useState, useEffect, useRef } from "react";
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
  type HeroElementKind,
  type LayerType,
} from "@/lib/design";

const KIND_LABELS: Record<string, string> = {
  logo: "Logo",
  title: "Title",
  tagline: "Tagline",
  text: "Text",
  shape: "Shape",
  image: "Image",
  button: "Button",
};
const SHAPE_KINDS: HeroElementKind[] = ["logo", "text", "title", "shape", "image", "button"];

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
  onMoveMany,
  setSelected,
}: {
  elements: HeroElement[];
  selected: string[];
  onSelect: (id: string, additive: boolean) => void;
  onUpdate: (id: string, patch: Partial<HeroElement>) => void;
  /** dx/dy are TOTAL deltas from drag start; startRects are the rects at
   *  drag start so the group moves 1:1 with the pointer (no accumulation). */
  onMoveMany: (dx: number, dy: number, startRects: HeroElement[]) => void;
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const slot = useOverlaySlot("hero");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startRectsRef = useRef<HeroElement[]>([]);
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  if (!slot) return null;

  const toPct = (e: React.PointerEvent) => {
    const pr = wrapperRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - pr.left) / pr.width) * 100, y: ((e.clientY - pr.top) / pr.height) * 100 };
  };

  const intersect = (m: { x0: number; y0: number; x1: number; y1: number }) => {
    const x0 = Math.min(m.x0, m.x1), x1 = Math.max(m.x0, m.x1);
    const y0 = Math.min(m.y0, m.y1), y1 = Math.max(m.y0, m.y1);
    return elements
      .filter((el) => el.x < x1 && el.x + el.w > x0 && el.y < y1 && el.y + el.h > y0)
      .map((el) => el.id);
  };

  return createPortal(
    <div
      ref={wrapperRef}
      className="absolute inset-0 pointer-events-auto"
      onPointerDownCapture={() => {
        // Remember where every box was when the drag started — the group
        // moves from here, so dragging feels identical to a single box.
        startRectsRef.current = elements;
      }}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        const p = toPct(e);
        marqueeRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!marqueeRef.current) return;
        const p = toPct(e);
        const m = { ...marqueeRef.current, x1: p.x, y1: p.y };
        marqueeRef.current = m;
        setMarquee(m);
        const ids = intersect(m);
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          setSelected((prev) => [...new Set([...prev, ...ids])]);
        } else {
          setSelected(ids);
        }
      }}
      onPointerUp={() => {
        if (!marqueeRef.current) return;
        marqueeRef.current = null;
        setMarquee(null);
      }}
    >
      {elements.map((el) => (
        <ResizableBox
          key={el.id}
          rect={{ x: el.x, y: el.y, w: el.w, h: el.h }}
          onChange={(r) => onUpdate(el.id, r)}
          selected={selected.includes(el.id)}
          onSelect={(ev) => onSelect(el.id, ev.shiftKey || ev.metaKey || ev.ctrlKey)}
          onMove={(dx, dy) => onMoveMany(dx, dy, startRectsRef.current)}
          multiMode={selected.length > 1 && selected.includes(el.id)}
          zIndex={31}
          label={KIND_LABELS[el.kind]}
        />
      ))}
      {marquee && (
        <div
          className="absolute border-2 border-sky-400/80 bg-sky-400/10 pointer-events-none"
          style={{
            left: `${Math.min(marquee.x0, marquee.x1)}%`,
            top: `${Math.min(marquee.y0, marquee.y1)}%`,
            width: `${Math.abs(marquee.x1 - marquee.x0)}%`,
            height: `${Math.abs(marquee.y1 - marquee.y0)}%`,
          }}
        />
      )}
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
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState<HeroElementKind | null>(null);
  const [previewHeight, setPreviewHeight] = useState(() => {
    try {
      const stored = Number(localStorage.getItem("tablecraft_preview_height"));
      return [640, 960, 1280].includes(stored) ? stored : 640;
    } catch { return 640; }
  });

  // Esc clears the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    setSelected((prev) => prev.filter((x) => x !== id));
  };

  const addEl = (kind: HeroElementKind) => {
    const el = newHeroElement(kind, kind === "title" ? 30 : 18);
    // Shapes go to the back (bottom of the stack); everything else on top.
    updateSettings({ hero: { ...settings.hero, elements: kind === "shape" ? [el, ...elements] : [...elements, el] } });
    setSelected([el.id]);
    setAdding(null);
  };

  const addButton = (buttonType: "book" | "menu") => {
    const el = newHeroElement("button", 16);
    el.buttonType = buttonType;
    updateSettings({ hero: { ...settings.hero, elements: [...elements, el] } });
    setSelected([el.id]);
    setAdding(null);
  };

  // Click (or ⇧/⌘ + click) on a box: additive toggles, plain click selects one.
  const handleSelect = (id: string, additive: boolean) => {
    setSelected((prev) => {
      if (additive) return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return prev.includes(id) ? prev : [id];
    });
  };

  // Drag of any selected box moves the whole group. startRects are where the
  // boxes sat when the drag began, so the group tracks the pointer 1:1 (same
  // feel as a single box — no delta accumulation). The group is clamped as
  // ONE bounding box, so hitting an edge stops the whole group together and
  // keeps the relative layout intact.
  const moveMany = (dx: number, dy: number, startRects: HeroElement[]) => {
    if (selected.length === 0) return;
    const items = startRects.filter((e) => selected.includes(e.id));
    if (items.length === 0) return;
    const b = {
      x0: Math.min(...items.map((e) => e.x)),
      y0: Math.min(...items.map((e) => e.y)),
      x1: Math.max(...items.map((e) => e.x + e.w)),
      y1: Math.max(...items.map((e) => e.y + e.h)),
    };
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const nx = bw >= 100 ? b.x0 + dx : Math.min(100 - bw, Math.max(0, b.x0 + dx));
    const ny = bh >= 100 ? b.y0 + dy : Math.min(100 - bh, Math.max(0, b.y0 + dy));
    const adx = nx - b.x0, ady = ny - b.y0;
    const startById = new Map(startRects.map((e) => [e.id, e]));
    updateSettings({
      hero: {
        ...settings.hero,
        elements: elements.map((e) => {
          if (!selected.includes(e.id)) return e;
          const s = startById.get(e.id);
          return { ...e, x: (s?.x ?? e.x) + adx, y: (s?.y ?? e.y) + ady };
        }),
      },
    });
  };

  const moveEl = (id: string, dir: -1 | 1) => {
    const arr = [...elements];
    const i = arr.findIndex((e) => e.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    updateSettings({ hero: { ...settings.hero, elements: arr } });
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

  const sel = selected.length === 1 ? (elements.find((e) => e.id === selected[0]) ?? null) : null;

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
            {bg.type !== "color" && (
              <>
                <ColorField label="Media border color" value={bg.border_color ?? "#000000"} onChange={(v) => updateBg({ border_color: v })} />
                <div>
                  <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Media border thickness: {bg.border_width ?? 0}px</label>
                  <input type="range" min={0} max={12} value={bg.border_width ?? 0}
                    onChange={(e) => updateBg({ border_width: parseInt(e.target.value, 10) })}
                    className="w-full accent-[var(--accent)]" />
                </div>
              </>
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
              Hero Elements
            </h3>
            <div className="flex flex-wrap gap-2">
              {SHAPE_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAdding(adding ? null : k)}
                  className="btn btn-outline text-xs"
                >
                  {adding === k ? "Cancel" : `+ ${KIND_LABELS[k]}`}
                </button>
              ))}
            </div>

            {adding === "button" && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => addButton("book")}
                  className="block w-full text-left px-3 py-2 text-xs border border-[var(--accent)]/50 rounded hover:bg-[var(--accent)]/10 text-[var(--accent)]"
                >
                  Book a table
                </button>
                <button
                  type="button"
                  onClick={() => addButton("menu")}
                  className="block w-full text-left px-3 py-2 text-xs border border-[var(--accent)]/50 rounded hover:bg-[var(--accent)]/10 text-[var(--accent)]"
                >
                  Menu
                </button>
              </div>
            )}
            {adding && adding !== "button" && (
              <button
                type="button"
                onClick={() => addEl(adding)}
                className="block w-full text-left px-3 py-2 text-xs border border-[var(--accent)]/50 rounded hover:bg-[var(--accent)]/10 text-[var(--accent)]"
              >
                Place {KIND_LABELS[adding]} on hero
              </button>
            )}

            <div className="space-y-1">
              {elements.map((el, i) => (
                <div
                  key={el.id}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors ${
                    selected.includes(el.id) ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--rule)]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={(ev) => handleSelect(el.id, ev.shiftKey || ev.metaKey || ev.ctrlKey)}
                    className="flex-1 text-left truncate"
                  >
                    <span className="font-mono mr-2 text-[10px] opacity-60">{el.kind.slice(0, 3).toUpperCase()}</span>
                    {KIND_LABELS[el.kind] ?? el.kind}
                  </button>
                  <button type="button" onClick={() => moveEl(el.id, -1)} disabled={i === 0} className="px-1 disabled:opacity-30" title="Move behind">↑</button>
                  <button type="button" onClick={() => moveEl(el.id, 1)} disabled={i === elements.length - 1} className="px-1 disabled:opacity-30" title="Move in front">↓</button>
                </div>
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
              {sel.kind === "shape" && (
                <>
                  <ColorField label="Color" value={sel.color ?? "#141414"} onChange={(v) => updateEl(sel.id, { color: v })} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Border width: {sel.borderWidth ?? 0}px</label>
                      <input type="range" min={0} max={12} value={sel.borderWidth ?? 0}
                        onChange={(e) => updateEl(sel.id, { borderWidth: parseInt(e.target.value, 10) })}
                        className="w-full accent-[var(--accent)]" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Roundness: {sel.borderRadius ?? 0}% (50 = circle)</label>
                      <input type="range" min={0} max={50} value={sel.borderRadius ?? 0}
                        onChange={(e) => updateEl(sel.id, { borderRadius: parseInt(e.target.value, 10) })}
                        className="w-full accent-[var(--accent)]" />
                    </div>
                    <ColorField label="Border color" value={sel.borderColor ?? "#ffffff"} onChange={(v) => updateEl(sel.id, { borderColor: v })} />
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Opacity: {sel.opacity ?? 100}%</label>
                      <input type="range" min={0} max={100} value={sel.opacity ?? 100}
                        onChange={(e) => updateEl(sel.id, { opacity: parseInt(e.target.value, 10) })}
                        className="w-full accent-[var(--accent)]" />
                    </div>
                  </div>
                </>
              )}
              {sel.kind === "image" && (
                <div className="space-y-2">
                  <label className="btn btn-outline text-xs cursor-pointer inline-block">
                    {sel.image_url ? "Replace Image" : "Upload Image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const url = await uploadSingle(f);
                        if (url) updateEl(sel.id, { image_url: url });
                      }}
                    />
                  </label>
                  {sel.image_url && (
                    <button type="button" onClick={() => updateEl(sel.id, { image_url: undefined })} className="block text-xs text-red-500 underline">
                      Remove image
                    </button>
                  )}
                  <ColorField label="Border color" value={sel.borderColor ?? "#000000"} onChange={(v) => updateEl(sel.id, { borderColor: v })} />
                  <div>
                    <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Border thickness: {sel.borderWidth ?? 0}px</label>
                    <input type="range" min={0} max={12} value={sel.borderWidth ?? 0}
                      onChange={(e) => updateEl(sel.id, { borderWidth: parseInt(e.target.value, 10) })}
                      className="w-full accent-[var(--accent)]" />
                  </div>
                  <OpacityField label="Opacity" value={sel.opacity ?? 100} onChange={(v) => updateEl(sel.id, { opacity: v })} />
                </div>
              )}
              {sel.kind === "button" && (
                <>
                  <div className="space-y-2">
                    <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                      Button type
                    </label>
                    <div className="flex gap-2">
                      {(["book", "menu"] as const).map((bt) => (
                        <button
                          key={bt}
                          type="button"
                          onClick={() => updateEl(sel.id, { buttonType: bt })}
                          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                            sel.buttonType === bt
                              ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                              : "border-[var(--rule)] text-[var(--ink-soft)]"
                          }`}
                        >
                          {bt === "book" ? "Book a table" : "Menu"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <ColorField label="Button background" value={sel.bgColor ?? "#f97316"} onChange={(v) => updateEl(sel.id, { bgColor: v })} />
                  <DesignField
                    label=""
                    design={sel.design}
                    onChange={(d) => updateEl(sel.id, { design: d })}
                  />
                </>
              )}
              {sel.kind !== "shape" && sel.kind !== "image" && sel.kind !== "button" && (
                <>
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
                </>
              )}
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
            onGrowHero={(id, h) => updateEl(id, { h })}
          />
        </div>
      </div>

      {/* Hero element overlay portals */}
      <HeroOverlay
        elements={elements}
        selected={selected}
        onSelect={handleSelect}
        onUpdate={updateEl}
        onMoveMany={moveMany}
        setSelected={setSelected}
      />
    </div>
  );
}