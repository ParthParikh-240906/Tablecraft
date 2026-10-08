"use client";

import { createPortal } from "react-dom";
import { useState, useEffect, useRef } from "react";
import { useDesign } from "../use-design";
import { ResizableBox } from "../resizable-box";
import { PreviewShell } from "../preview-shell";
import { DesignNav } from "../design-nav";
import { CanvasHeightControl } from "../canvas-height-control";
import { ColorField, DesignField, OpacityField } from "../design-fields";
import { EditableCard, EditableGrid, EditableSplit } from "../editable-card";
import { useDesignDevice } from "../design-device";
import { AnimationBuilder } from "@/components/AnimationBuilder";
import { type OrgView } from "@/components/OrgPageView";
import {
  newHeroElement,
  getColorOverride,
  getFontOverride,
  withColorOverride,
  withFontOverride,
  getRectOverride,
  withRectOverride,
  resolveRect,
  pruneElementOverrides,
  type DesignSettingsV2,
  type HeroBackground,
  type HeroElement,
  type HeroElementKind,
  type LayerType,
  type Rect,
  buildHeroTemplate,
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

/** Editable fields keep native keys (Tab moves focus, Enter types). */
function isEditableTarget(t: HTMLElement | null): boolean {
  if (!t) return false;
  return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
}

function previewScrollBehavior(): ScrollBehavior {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "auto";
  } catch {}
  return "smooth";
}

function escId(id: string): string {
  try {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(id);
  } catch {}
  return id;
}

/** Scroll the preview PANE (not the window) so the box is visible. The pane
 *  is exposed via `data-preview-pane` in PreviewShell; boxes carry
 *  `data-el-id`. Retries briefly so just-created boxes scroll after commit. */
function scrollPreviewToId(id: string) {
  const behavior = previewScrollBehavior();
  let attempts = 0;
  const tryScroll = () => {
    const pane = document.querySelector("[data-preview-pane]");
    const box = pane?.querySelector(`[data-el-id="${escId(id)}"]`);
    if (box) {
      (box as HTMLElement).scrollIntoView({ block: "nearest", behavior });
      return;
    }
    if (++attempts < 12) setTimeout(tryScroll, 50);
  };
  tryScroll();
}

/** Scroll the page (editor column) to the Edit card. */
function scrollToEditor() {
  const card = document.querySelector("[data-edit-card]");
  if (card) (card as HTMLElement).scrollIntoView({ block: "nearest", behavior: previewScrollBehavior() });
}

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
  /** Single-box drag/resize result: full rect (panel routes to base or a
   *  per-device override depending on the active device). */
  onUpdate: (id: string, rect: Rect) => void;
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
        startRectsRef.current = elements;
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
          elementId={el.id}
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
  const { settings, updateSettings, saving, saved, saveError, retrySave } = useDesign(initialSettings, orgId);
  const { device } = useDesignDevice();
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState<HeroElementKind | null>(null);
  const [previewHeight, setPreviewHeight] = useState(640);
  const [uploadError, setUploadError] = useState<string | null>(null);
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem("tablecraft_preview_height"));
      if (stored >= 640 && stored <= 3200) setPreviewHeight(stored);
    } catch {}
  }, []);

  const bg = settings.hero.background;
  const elements = settings.hero.elements;
  const deviceLabel = device === "tablet" ? "Tablet" : "Mobile";
  // Device-resolved rects for the overlay: shared desktop base until this
  // device stores its own `rects[hero:<id>]` override (created on first
  // move/resize off-desktop). Overlay and OrgPageView use the same resolver.
  const viewElements: HeroElement[] = elements.map((e) => ({
    ...e,
    ...resolveRect(e, `hero:${e.id}`, device, settings.responsive),
  }));

  // Esc clears selection; Backspace / Delete removes selected elements;
  // Tab / Shift-Tab cycles blocks (outside editable fields); Enter focuses
  // the Edit textarea for the single selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected([]);
        return;
      }
      if (e.key === "Tab") {
        const target = e.target as HTMLElement | null;
        if (isEditableTarget(target)) return;
        if (elements.length === 0) return;
        e.preventDefault();
        const ids = elements.map((el) => el.id);
        const cur = selected.length === 1 ? ids.indexOf(selected[0]) : -1;
        const next =
          cur === -1
            ? e.shiftKey
              ? ids[ids.length - 1]
              : ids[0]
            : ids[(cur + (e.shiftKey ? -1 : 1) + ids.length) % ids.length];
        setSelected([next]);
        // Discrete keyboard select (never multi/marquee) may scroll the
        // preview pane; drag/move/resize paths never call this.
        scrollPreviewToId(next);
        return;
      }
      if (e.key === "Enter") {
        const target = e.target as HTMLElement | null;
        // Editable fields keep native Enter; buttons/links keep activation.
        if (target && (isEditableTarget(target) || target.closest("button, a"))) return;
        if (selected.length !== 1) return;
        const ta = document.querySelector("[data-edit-card] textarea") as HTMLElement | null;
        if (ta) {
          e.preventDefault();
          ta.focus();
        }
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        if (selected.length > 0) {
          e.preventDefault();
          updateSettings((prev) => {
            const kept = prev.hero.elements.filter((el) => !selected.includes(el.id));
            return {
              hero: { ...prev.hero, elements: kept },
              responsive: pruneElementOverrides(
                prev.responsive,
                kept.map((e) => e.id),
                prev.content.elements.map((e) => e.id),
              ),
            };
          });
          setSelected([]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, elements, settings.hero, updateSettings]);

  const updateBg = (patch: Partial<HeroBackground>) => {
    updateSettings({ hero: { ...settings.hero, background: { ...bg, ...patch } } });
  };

  const setBgType = (type: LayerType) => updateBg({ type });

  const updateEl = (id: string, patch: Partial<HeroElement>) => {
    updateSettings((prev) => ({
      hero: {
        ...prev.hero,
        elements: prev.hero.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      },
    }));
  };

  // Persist a dragged/resized rect: desktop edits the shared base; off-desktop
  // stores a per-device override (other devices keep inheriting the base).
  const persistRect = (id: string, r: Rect) => {
    if (device === "desktop") {
      updateEl(id, r);
      return;
    }
    updateSettings((prev) => ({
      responsive: withRectOverride(prev.responsive, device, `hero:${id}`, r),
    }));
  };

  const removeEl = (id: string) => {
    updateSettings((prev) => ({
      hero: { ...prev.hero, elements: prev.hero.elements.filter((e) => e.id !== id) },
      // Drop this element's per-device values so stale overrides can't linger.
      responsive: pruneElementOverrides(
        prev.responsive,
        prev.hero.elements.filter((e) => e.id !== id).map((e) => e.id),
        prev.content.elements.map((e) => e.id),
      ),
    }));
    setSelected((prev) => prev.filter((x) => x !== id));
  };

  const addEl = (kind: HeroElementKind) => {
    const el = newHeroElement(kind, kind === "title" ? 30 : 18);
    // Shapes go to the back (bottom of the stack); everything else on top.
    updateSettings({ hero: { ...settings.hero, elements: kind === "shape" ? [el, ...elements] : [...elements, el] } });
    setSelected([el.id]);
    setAdding(null);
    // Discrete create scrolls the preview pane to the new box (never multi).
    scrollPreviewToId(el.id);
  };

  const addButton = (buttonType: "book" | "menu") => {
    const el = newHeroElement("button", 16);
    el.buttonType = buttonType;
    updateSettings({ hero: { ...settings.hero, elements: [...elements, el] } });
    setSelected([el.id]);
    setAdding(null);
    scrollPreviewToId(el.id);
  };

  // Click (or ⇧/⌘ + click) on a box: additive toggles, plain click selects one.
  const handleSelect = (id: string, additive: boolean) => {
    setSelected((prev) => {
      if (additive) return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return prev.includes(id) ? prev : [id];
    });
  };

  // Drag of any selected box moves the whole group. startRects are the
  // DEVICE-RESOLVED rects at drag start, so the group tracks the pointer 1:1
  // (same feel as a single box — no delta accumulation). The group is clamped
  // as ONE bounding box, so hitting an edge stops the whole group together and
  // keeps the relative layout intact. Off-desktop the result is stored as
  // per-device overrides; desktop edits the shared base.
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
    if (device !== "desktop") {
      updateSettings((prev) => {
        let responsive = prev.responsive;
        for (const s of items) {
          responsive = withRectOverride(responsive, device, `hero:${s.id}`, {
            x: s.x + adx,
            y: s.y + ady,
            w: s.w,
            h: s.h,
          });
        }
        return { responsive };
      });
      return;
    }
    const startById = new Map(startRects.map((e) => [e.id, e]));
    updateSettings((prev) => ({
      hero: {
        ...prev.hero,
        elements: prev.hero.elements.map((e) => {
          if (!selected.includes(e.id)) return e;
          const s = startById.get(e.id);
          return { ...e, x: (s?.x ?? e.x) + adx, y: (s?.y ?? e.y) + ady };
        }),
      },
    }));
  };

  const moveEl = (id: string, dir: -1 | 1) => {
    updateSettings((prev) => {
      const arr = [...prev.hero.elements];
      const i = arr.findIndex((e) => e.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return {};
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { hero: { ...prev.hero, elements: arr } };
    });
  };

  const uploadSingle = async (file: File): Promise<string | null> => {
    setUploadError(null);
    if (file.size > 5 * 1024 * 1024) { setUploadError("Image exceeds 5MB — compress and try again."); return null; }
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("org_id", orgId);
      const res = await fetch("/api/design/photos/upload", { method: "POST", body: form });
      if (res.ok) return ((await res.json()).url as string);
      const data = await res.json().catch(() => null);
      setUploadError(data?.error ?? `Image upload failed (${res.status}). Try again.`);
      return null;
    } catch {
      setUploadError("Network error — image not uploaded. Try again.");
      return null;
    }
  };

  const uploadVideo = async (file: File): Promise<string | null> => {
    setUploadError(null);
    if (file.size > 50 * 1024 * 1024) { setUploadError("Video exceeds 50MB — compress and try again."); return null; }
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("org_id", orgId);
      const res = await fetch("/api/design/video", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (res.ok) return (data.url as string);
      setUploadError(data?.error ?? `Video upload failed (${res.status}). Try again.`);
      return null;
    } catch {
      setUploadError("Network error — video not uploaded. Try again.");
      return null;
    }
  };

  const sel = selected.length === 1 ? (elements.find((e) => e.id === selected[0]) ?? null) : null;

  return (
    <div data-design-stable>
      <DesignNav />
      <div className="space-y-8">
        {/* ── Controls (full width, top) ───────────────────────── */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Hero</h2>
            <span className="text-xs text-[var(--ink-faint)]">
              {saving ? "Saving…" : saveError ? "⚠ Not saved" : saved ? "✓ Saved" : ""}
            </span>
          </div>
          {uploadError && (
            <div className="rounded-sm border border-red-800 bg-red-950/40 p-2 text-xs text-red-300 flex items-center justify-between gap-2">
              <span>{uploadError}</span>
              <button type="button" onClick={() => setUploadError(null)} className="underline shrink-0">Dismiss</button>
            </div>
          )}
          {saveError && (
            <div className="rounded-sm border border-red-800 bg-red-950/40 p-2 text-xs text-red-300 flex items-center justify-between gap-2">
              <span>{saveError}</span>
              <button type="button" onClick={() => retrySave()} className="underline shrink-0">Retry</button>
            </div>
          )}
          <EditableGrid>

          {/* Hero background */}
          <EditableCard hover title="Hero Background">
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
                  <label className="block text-[10px] text-[var(--ink-soft)] mb-1">Media border thickness: {bg.border_width ?? 0}px</label>
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
            <label className="flex items-center gap-2 text-xs text-[var(--ink-soft)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bg.glow ?? false}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    hero: {
                      ...prev.hero,
                      background: { ...prev.hero.background, glow: e.target.checked ? true : undefined },
                    },
                  }))
                }
                className="accent-[var(--accent)]"
              />
              Accent glow
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--ink-soft)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bg.scrim ?? false}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    hero: {
                      ...prev.hero,
                      background: { ...prev.hero.background, scrim: e.target.checked ? true : undefined },
                    },
                  }))
                }
                className="accent-[var(--accent)]"
              />
              Dark scrim (text legibility)
            </label>
          </EditableCard>

          {/* Templates */}
          <EditableCard hover title="Hero Templates">
            <div className="grid grid-cols-3 gap-2">
              {([
                { style: "full-image" as const, label: "Full Image", desc: "Big image + centered title" },
                { style: "text-left" as const, label: "Text Left", desc: "Color bg, image right, text left" },
                { style: "text-right" as const, label: "Text Right", desc: "Color bg, image left, text right" },
              ]).map((t) => {
                return (
                  <button
                    key={t.style}
                    type="button"
                    onClick={() => {
                      // Hero templates REPLACE all elements — confirm first so
                      // existing work isn't destroyed (skip when canvas is empty).
                      // No "Active" indicator: template output can't be reliably
                      // matched back to edited elements, so none is shown.
                      if (elements.length > 0) {
                        const ok = window.confirm(
                          `Apply the "${t.label}" hero template? Your current hero elements will be replaced.`,
                        );
                        if (!ok) return;
                      }
                      const els = buildHeroTemplate(t.style, org);
                      const elIds = els.map((e) => e.id);
                      // Templates replace every element (fresh ids) — prune
                      // orphaned per-device overrides so deleted boxes can't
                      // resurrect positions or sizes.
                      updateSettings((prev) => ({
                        hero: { ...prev.hero, elements: els },
                        responsive: pruneElementOverrides(
                          prev.responsive,
                          elIds,
                          prev.content.elements.map((e) => e.id),
                        ),
                      }));
                      setSelected(elIds);
                    }}
                    disabled={saving}
                    className="p-3 text-left rounded border transition-all border-[var(--rule)] hover:border-[var(--ink-soft)]"
                  >
                    <div className="text-xs font-semibold text-[var(--ink)]">{t.label}</div>
                    <div className="text-[10px] text-[var(--ink-soft)] mt-0.5">{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </EditableCard>

          {/* Hero elements */}
          <EditableCard hover title="Hero Elements">
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
                    onClick={(ev) => {
                      const additive = ev.shiftKey || ev.metaKey || ev.ctrlKey;
                      handleSelect(el.id, additive);
                      // Discrete single-select from the list scrolls the
                      // PREVIEW PANE (not the window) to the box; additive
                      // multi-select never auto-scrolls.
                      if (!additive) scrollPreviewToId(el.id);
                    }}
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
          </EditableCard>

          {/* Selected element — always rendered (placeholder when nothing is
              selected) with a min-height so mounting the editor never changes
              page height, which would toggle the window scrollbar and rescale
              the width-measured preview zoom. */}
          <div data-edit-card className="md:col-span-2">
          <EditableCard hover title={sel ? `Edit ${KIND_LABELS[sel.kind]}` : "Edit block"} className="min-h-[380px]">
            {sel ? (
              <>
              <div className="flex items-center justify-end gap-2">
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => scrollPreviewToId(sel.id)}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--rule-strong)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    title="Scroll the preview to this block"
                  >
                    Jump to preview ↓
                  </button>
                  <button type="button" onClick={() => removeEl(sel.id)} className="text-red-500 underline text-[10px]">
                    Delete
                  </button>
                </div>
              </div>
              {sel.kind === "shape" && (
                <>
                  <ColorField label="Color" value={sel.color ?? "#141414"} onChange={(v) => updateEl(sel.id, { color: v })} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-[var(--ink-soft)] mb-1">Border width: {sel.borderWidth ?? 0}px</label>
                      <input type="range" min={0} max={12} value={sel.borderWidth ?? 0}
                        onChange={(e) => updateEl(sel.id, { borderWidth: parseInt(e.target.value, 10) })}
                        className="w-full accent-[var(--accent)]" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--ink-soft)] mb-1">Roundness: {sel.borderRadius ?? 0}% (50 = circle)</label>
                      <input type="range" min={0} max={50} value={sel.borderRadius ?? 0}
                        onChange={(e) => updateEl(sel.id, { borderRadius: parseInt(e.target.value, 10) })}
                        className="w-full accent-[var(--accent)]" />
                    </div>
                    <ColorField label="Border color" value={sel.borderColor ?? "#000000"} onChange={(v) => updateEl(sel.id, { borderColor: v })} />
                    <div>
                      <label className="block text-[10px] text-[var(--ink-soft)] mb-1">Opacity: {sel.opacity ?? 100}%</label>
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
                    <label className="block text-[10px] text-[var(--ink-soft)] mb-1">Border thickness: {sel.borderWidth ?? 0}px</label>
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
                    <label className="block text-xs text-[var(--ink-soft)] mb-1">
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
                  <DesignField customFonts={settings.custom_fonts}
                    label=""
                    design={sel.design}
                    onChange={(d) => updateEl(sel.id, { design: d })}
                    fontKey={`hero:${sel.id}`}
                    overrideValue={getFontOverride(settings.responsive, device, `hero:${sel.id}`)}
                    onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, `hero:${sel.id}`, v) }))}
                    colorKey={`hero:${sel.id}`}
                    colorOverrideValue={getColorOverride(settings.responsive, device, `hero:${sel.id}`)}
                    onOverrideColor={(v) => updateSettings((prev) => ({ responsive: withColorOverride(prev.responsive, device, `hero:${sel.id}`, v) }))}
                  />
                  <AnimationBuilder design={sel.design} onChange={(d) => updateEl(sel.id, { design: d })} />
                </>
              )}
              {sel.kind !== "shape" && sel.kind !== "image" && sel.kind !== "button" && (
                <EditableSplit
                  left={
                    <>
                      {sel && (sel.kind === "text" || sel.kind === "title" || sel.kind === "tagline") && (
                        <div className="space-y-2">
                          <label className="block text-xs text-[var(--ink-soft)] mb-1">
                            {sel.kind === "title" ? "Title text" : sel.kind === "tagline" ? "Tagline text" : "Text content"}
                          </label>
                          <textarea
                            rows={5}
                            value={sel.content ?? ""}
                            onChange={(e) => updateEl(sel.id, { content: e.target.value })}
                            className="w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-3 py-2 text-sm resize-y"
                          />
                        </div>
                      )}
                    </>
                  }
                  right={
                    <>
                      <DesignField customFonts={settings.custom_fonts}
                        label=""
                        design={sel.design}
                        onChange={(d) => updateEl(sel.id, { design: d })}
                        fontKey={`hero:${sel.id}`}
                        overrideValue={getFontOverride(settings.responsive, device, `hero:${sel.id}`)}
                        onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, `hero:${sel.id}`, v) }))}
                        colorKey={`hero:${sel.id}`}
                        colorOverrideValue={getColorOverride(settings.responsive, device, `hero:${sel.id}`)}
                        onOverrideColor={(v) => updateSettings((prev) => ({ responsive: withColorOverride(prev.responsive, device, `hero:${sel.id}`, v) }))}
                      />
                      <AnimationBuilder design={sel.design} onChange={(d) => updateEl(sel.id, { design: d })} />
                    </>
                  }
                />
              )}
              {/* Per-device layout status lives INSIDE the edit card (not a
                  separate grid item) so toggling devices never changes page
                  height. Moves/resizes on tablet/mobile are stored as
                  overrides for that device only — desktop stays shared. */}
              {device !== "desktop" && (
                <div className="space-y-2 border-t border-[var(--rule)] pt-3">
                  <h3 className="font-display text-sm font-semibold text-[var(--ink)]">
                    {deviceLabel} layout
                  </h3>
                  {(() => {
                    const layoutOverride = getRectOverride(settings.responsive, device, `hero:${sel.id}`);
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[10px] text-[var(--ink-faint)]">
                          {deviceLabel}: {layoutOverride ? "custom position" : "inherits desktop"}
                        </p>
                        {layoutOverride && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSettings((prev) => ({
                                responsive: withRectOverride(prev.responsive, device, `hero:${sel.id}`, undefined),
                              }))
                            }
                            className="text-[10px] underline text-[var(--ink-soft)] hover:text-[var(--ink)]"
                          >
                            Reset (inherits)
                          </button>
                        )}
                      </div>
                    );
                  })()}
                  <p className="text-[10px] text-[var(--ink-faint)]">
                    Dragging or resizing on {deviceLabel} only affects {deviceLabel} — other devices keep the desktop layout.
                  </p>
                </div>
              )}
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-[var(--ink-faint)]">
                  Select a hero element on the canvas or in the list to edit its content and style.
                </p>
                <p className="text-[10px] text-[var(--ink-faint)]">
                  Tip: Tab cycles blocks, Enter focuses the text field.
                </p>
              </div>
            )}
          </EditableCard>
          </div>
          </EditableGrid>
        </div>

        {/* ── Preview (full width, below) ──────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Live Preview</h2>
              {selected.length === 1 && (
                <button
                  type="button"
                  onClick={scrollToEditor}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--rule-strong)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  title="Scroll to the editor for the selected block"
                >
                  Jump to editor ↑
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] text-[var(--ink-faint)]">
                Drag boxes to move &bull; drag empty canvas to marquee-select &bull; &#8679;-click for multi-select &bull; Tab cycles blocks &bull; Enter edits text &bull; click list to locate in preview
              </span>
              <CanvasHeightControl
                previewHeight={previewHeight}
                setPreviewHeight={setPreviewHeight}
              />
            </div>
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
            // Auto-grow writes the measured height: desktop edits the shared
            // base, off-desktop only the device override (a tablet-measured
            // height must never reshape the desktop layout).
            onGrowHero={(id, h) => {
              if (device === "desktop") {
                updateEl(id, { h });
                return;
              }
              updateSettings((prev) => {
                const base = prev.hero.elements.find((e) => e.id === id);
                if (!base) return {};
                const cur = resolveRect(base, `hero:${id}`, device, prev.responsive);
                return {
                  responsive: withRectOverride(prev.responsive, device, `hero:${id}`, { ...cur, h }),
                };
              });
            }}
          />
        </div>
      </div>

      {/* Hero element overlay portals */}
      <HeroOverlay
        elements={viewElements}
        selected={selected}
        onSelect={handleSelect}
        onUpdate={persistRect}
        onMoveMany={moveMany}
        setSelected={setSelected}
      />
    </div>
  );
}