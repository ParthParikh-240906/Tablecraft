"use client";

import { createPortal } from "react-dom";
import { useState, useEffect, useRef } from "react";
import { useDesign } from "../use-design";
import { ResizableBox } from "../resizable-box";
import { PreviewShell } from "../preview-shell";
import { DesignNav } from "../design-nav";
import { CanvasHeightControl } from "../canvas-height-control";
import { ColorField, DesignField } from "../design-fields";
import { EditableCard, EditableColumns, EditableSplit } from "../editable-card";
import { useDesignDevice } from "../design-device";
import { AnimationBuilder } from "@/components/AnimationBuilder";
import { InteractionBuilder } from "@/components/InteractionBuilder";
import { type OrgView } from "@/components/OrgPageView";
import {
  newContentElement,
  getColorOverride,
  getFontOverride,
  withColorOverride,
  withFontOverride,
  getRectOverride,
  withRectOverride,
  resolveRect,
  pruneElementOverrides,
  type ContentElement,
  type ContentElementKind,
  type DesignSettingsV2,
  type Rect,
  buildContentTemplate,
} from "@/lib/design";

const KIND_LABELS: Record<string, string> = {
  title: "Title",
  text: "Text",
  image: "Image",
  images: "Images (carousel)",
  shape: "Shape",
  button: "Button",
};

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

function ContentOverlay({
  elements,
  selected,
  onSelect,
  onUpdate,
  onMoveMany,
  setSelected,
}: {
  elements: ContentElement[];
  selected: string[];
  onSelect: (id: string, additive: boolean) => void;
  /** Single-box drag/resize result: full rect (panel routes to base or a
   *  per-device override depending on the active device). */
  onUpdate: (id: string, rect: Rect) => void;
  /** dx/dy are TOTAL deltas from drag start; startRects are the rects at
   *  drag start so the group moves 1:1 with the pointer (no accumulation). */
  onMoveMany: (dx: number, dy: number, startRects: ContentElement[]) => void;
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const slot = useOverlaySlot("content");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startRectsRef = useRef<ContentElement[]>([]);
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  if (!slot) return null;

  const cvH = (pct: number) => `calc(${((pct * 0.8) / 100).toFixed(5)} * 100cqw)`;

  const toPct = (e: React.PointerEvent) => {
    const pr = wrapperRef.current!.getBoundingClientRect();
    const unitH = pr.width * 0.008;
    return {
      x: ((e.clientX - pr.left) / pr.width) * 100,
      y: (e.clientY - pr.top) / unitH,
    };
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
          unit="cvH"
          onChange={(r) => onUpdate(el.id, r)}
          selected={selected.includes(el.id)}
          onSelect={(ev) => onSelect(el.id, ev.shiftKey || ev.metaKey || ev.ctrlKey)}
          onMove={(dx, dy) => onMoveMany(dx, dy, startRectsRef.current)}
          multiMode={selected.length > 1 && selected.includes(el.id)}
          zIndex={31}
          maxY={1000}
          label={KIND_LABELS[el.kind]}
        />
      ))}
      {marquee && (
        <div
          className="absolute border-2 border-sky-400/80 bg-sky-400/10 pointer-events-none"
          style={{
            left: `${Math.min(marquee.x0, marquee.x1)}%`,
            top: cvH(Math.min(marquee.y0, marquee.y1)),
            width: `${Math.abs(marquee.x1 - marquee.x0)}%`,
            height: cvH(Math.abs(marquee.y1 - marquee.y0)),
          }}
        />
      )}
    </div>,
    slot,
  );
}

export function ContentPanel({
  orgId,
  orgName,
  initialSettings,
  orgContent,
  paragraphs,
}: {
  orgId: string;
  orgName: string;
  initialSettings: DesignSettingsV2;
  orgContent: OrgView;
  paragraphs: { id: string; title: string | null; content: string | null }[];
}) {
  const { settings, updateSettings, saving, saved, saveError, retrySave } = useDesign(initialSettings, orgId);
  const { device } = useDesignDevice();
  const [selected, setSelected] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewHeight, setPreviewHeight] = useState(640);
  const [choosingButtonType, setChoosingButtonType] = useState(false);
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem("tablecraft_preview_height"));
      if (stored >= 640 && stored <= 3200) setPreviewHeight(stored);
    } catch {}
  }, []);

  const elements = settings.content.elements;
  const deviceLabel = device === "tablet" ? "Tablet" : "Mobile";
  // Device-resolved rects for the overlay: shared desktop base until this
  // device stores its own `rects[content:<id>]` override (created on first
  // move/resize off-desktop). Overlay and OrgPageView use the same resolver.
  const viewElements: ContentElement[] = elements.map((e) => ({
    ...e,
    ...resolveRect(e, `content:${e.id}`, device, settings.responsive),
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
            const kept = prev.content.elements.filter((el) => !selected.includes(el.id));
            return {
              content: { elements: kept },
              responsive: pruneElementOverrides(
                prev.responsive,
                prev.hero.elements.map((e) => e.id),
                kept.map((e) => e.id),
              ),
            };
          });
          setSelected([]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, elements, updateSettings]);

  // Resolve bound content for the textarea editor (site shows the same resolution).
  const resolveText = (el: ContentElement): string => {
    if (el.ref && "org" in el.ref) {
      const key = el.ref.org;
      if (key === "about_title") return orgContent.about_title ?? "";
      if (key === "about_text") return orgContent.about_text ?? "";
      if (key === "contact_heading") return orgContent.contact_heading ?? "";
      if (key === "location") return orgContent.location ?? "";
      if (key === "contact_body")
        return [orgContent.contact_phone, orgContent.contact_email, orgContent.contact_address]
          .filter(Boolean)
          .map((x) => `• ${x}`)
          .join("\n");
      return "";
    }
    if (el.ref && "para" in el.ref) {
      const paraId = el.ref.para;
      const p = paragraphs.find((x) => x.id === paraId);
      if (p) return el.kind === "title" ? p.title ?? "" : p.content ?? "";
    }
    return el.content ?? "";
  };

  const updateEl = (id: string, patch: Partial<ContentElement>) => {
    updateSettings((prev) => ({
      content: {
        elements: prev.content.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
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
      responsive: withRectOverride(prev.responsive, device, `content:${id}`, r),
    }));
  };

  const removeEl = (id: string) => {
    updateSettings((prev) => ({
      content: { elements: prev.content.elements.filter((e) => e.id !== id) },
      // Drop this element's per-device values so stale overrides can't linger.
      responsive: pruneElementOverrides(
        prev.responsive,
        prev.hero.elements.map((e) => e.id),
        prev.content.elements.filter((e) => e.id !== id).map((e) => e.id),
      ),
    }));
    setSelected((prev) => prev.filter((x) => x !== id));
  };

  const addEl = (kind: ContentElementKind) => {
    const el = newContentElement(kind);
    // Shapes go to the back (bottom of the stack); everything else on top.
    updateSettings({ content: { elements: kind === "shape" ? [el, ...elements] : [...elements, el] } });
    setSelected([el.id]);
    // Discrete create scrolls the preview pane to the new box (never multi).
    scrollPreviewToId(el.id);
  };

  const addButton = (buttonType: "book" | "menu") => {
    const el = newContentElement("button");
    el.buttonType = buttonType;
    updateSettings({ content: { elements: [...elements, el] } });
    setSelected([el.id]);
    scrollPreviewToId(el.id);
  };

  // Click (or ⇧/⌘ + click) on a box: additive toggles, plain click selects one.
  const handleSelect = (id: string, additive: boolean) => {
    setSelected((prev) => {
      if (additive) return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return prev.includes(id) ? prev : [id];
    });
  };

  // Group drag from device-resolved start-rects: 1:1 pointer tracking (same
  // feel as a single box, no accumulation) and clamped as ONE bounding box so
  // the group keeps its relative layout when it hits an edge. Off-desktop the
  // result is stored as per-device overrides; desktop edits the shared base.
  const moveMany = (dx: number, dy: number, startRects: ContentElement[]) => {
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
    const ny = bh >= 1000 ? b.y0 + dy : Math.min(1000 - bh, Math.max(0, b.y0 + dy));
    const adx = nx - b.x0, ady = ny - b.y0;
    if (device !== "desktop") {
      updateSettings((prev) => {
        let responsive = prev.responsive;
        for (const s of items) {
          responsive = withRectOverride(responsive, device, `content:${s.id}`, {
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
      content: {
        elements: prev.content.elements.map((e) => {
          if (!selected.includes(e.id)) return e;
          const s = startById.get(e.id);
          return { ...e, x: (s?.x ?? e.x) + adx, y: (s?.y ?? e.y) + ady };
        }),
      },
    }));
  };

  const moveEl = (id: string, dir: -1 | 1) => {
    updateSettings((prev) => {
      const arr = [...prev.content.elements];
      const i = arr.findIndex((e) => e.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return {};
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { content: { elements: arr } };
    });
  };

  const uploadImage = async (file: File): Promise<string | null> => {
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

  const sel = selected.length === 1 ? (elements.find((e) => e.id === selected[0]) ?? null) : null;

  return (
    <div data-design-stable>
      <DesignNav />
      <div className="space-y-8">
        {/* ── Controls (top, full width) ─────────────────────────── */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Content</h2>
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

          <p className="text-xs text-[var(--ink-soft)]">
            About us, paragraphs, location &amp; contact — every block is a
            Word-style rectangle you can move and resize. Full font/color/size
            controls inside each rectangle.
          </p>

          <EditableColumns left={<>
          <EditableCard title="Blocks" hover>
            <div className="space-y-2">
              {elements.map((e, i) => (
                <div
                  key={e.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded border text-xs ${
                    selected.includes(e.id) ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--rule)]"
                  }`}
                >
                  <button type="button" onClick={(ev) => {
                    const additive = ev.shiftKey || ev.metaKey || ev.ctrlKey;
                    handleSelect(e.id, additive);
                    // Discrete single-select from the list scrolls the
                    // PREVIEW PANE (not the window) to the box; additive
                    // multi-select never auto-scrolls.
                    if (!additive) scrollPreviewToId(e.id);
                  }} className="flex-1 text-left truncate">
                    <span className="font-mono mr-2 text-[10px] opacity-60">{KIND_LABELS[e.kind]?.slice(0, 3).toUpperCase()}</span>
                    {e.kind === "title" || e.kind === "text" ? (e.content || (e.ref && "org" in e.ref ? `(${e.ref.org})` : "") || resolveText(e).slice(0, 30) || `Empty ${KIND_LABELS[e.kind]}`) : KIND_LABELS[e.kind]}
                  </button>
                  <button type="button" onClick={() => moveEl(e.id, -1)} disabled={i === 0} className="px-1 disabled:opacity-30" title="Move behind">↑</button>
                  <button type="button" onClick={() => moveEl(e.id, 1)} disabled={i === elements.length - 1} className="px-1 disabled:opacity-30" title="Move in front">↓</button>
                  <button type="button" onClick={() => removeEl(e.id)} className="text-red-500 text-[10px]">✕</button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["title", "text", "image", "images", "shape"] as ContentElementKind[]).map((k) => (
                <button key={k} type="button" onClick={() => addEl(k)} className="btn btn-outline text-xs">
                  + {KIND_LABELS[k]}
                </button>
              ))}
              <button type="button" onClick={() => setChoosingButtonType((v) => !v)} className="btn btn-outline text-xs">
                {choosingButtonType ? "Cancel" : "+ Button"}
              </button>
            </div>
            {/* Two-step subtype chooser (same as hero): "+ Button" reveals the
                destination first, then creates a typed button already selected
                so its editor (with the Book/Menu type toggle) opens at once. */}
            {choosingButtonType && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => { addButton("book"); setChoosingButtonType(false); }}
                  className="block w-full text-left px-3 py-2 text-xs border border-[var(--accent)]/50 rounded hover:bg-[var(--accent)]/10 text-[var(--accent)]"
                >
                  Book a table
                </button>
                <button
                  type="button"
                  onClick={() => { addButton("menu"); setChoosingButtonType(false); }}
                  className="block w-full text-left px-3 py-2 text-xs border border-[var(--accent)]/50 rounded hover:bg-[var(--accent)]/10 text-[var(--accent)]"
                >
                  Menu
                </button>
              </div>
            )}
            {selected.length === 1 && sel?.kind === "button" && (
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
          </EditableCard>
          </>}
          right={<>
          {/* Templates — StepCard hover lift + orange brightening */}
          <EditableCard title="Content Templates" hover>
            <div className="grid grid-cols-3 gap-2">
              {([
                { style: "about" as const, label: "About Us", desc: "Title + text + image right" },
                { style: "location" as const, label: "Location & Contact", desc: "Centered title + 2 text boxes" },
              ]).map((t) => {
                return (
                  <button
                    key={t.style}
                    type="button"
                    onClick={() => {
                      // Content templates APPEND blocks — confirm when the canvas
                      // isn't empty so repeated clicks don't silently duplicate
                      // content. No "Active" indicator: appended output can't be
                      // reliably matched back to edited elements.
                      if (elements.length > 0) {
                        const ok = window.confirm(
                          `Add the "${t.label}" blocks? They will be appended to your existing content blocks.`,
                        );
                        if (!ok) return;
                      }
                      const newEls = buildContentTemplate(t.style, orgContent);
                      const newIds = newEls.map((e) => e.id);
                      updateSettings({
                        content: {
                          ...settings.content,
                          elements: [...elements, ...newEls],
                        },
                      });
                      setSelected((prev) => prev.length === 0 ? newIds : [...prev, ...newIds]);
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
          </>}
          />

          {/* Selected element controls — always rendered (placeholder when
              nothing is selected) with a min-height so mounting the editor
              never changes page height, which would toggle the window
              scrollbar and rescale the width-measured preview zoom. */}
          <div data-edit-card className="mt-5">
          <EditableCard title={sel ? `Edit ${KIND_LABELS[sel.kind]}` : "Edit block"} hover className="min-h-[380px]">
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

              {(sel.kind === "title" || sel.kind === "text") && (
                <EditableSplit
                  left={
                    <>
                      {sel.ref && "org" in sel.ref && (
                        <p className="text-[10px] text-[var(--ink-faint)]">
                          Bound to <b>{sel.ref.org}</b> — showing live text from your restaurant profile.
                          Editing below unlinks this block (it becomes fixed text).
                        </p>
                      )}
                      {(!sel.ref || "org" in sel.ref) && (
                        <div>
                          <label className="block text-xs text-[var(--ink-soft)] mb-1">
                            {sel.kind === "title" ? "Title text" : "Text content"}
                          </label>
                          <textarea
                            rows={5}
                            value={sel.ref ? resolveText(sel) : sel.content ?? ""}
                            onChange={(e) =>
                              sel.ref
                                ? updateEl(sel.id, { content: e.target.value, ref: undefined })
                                : updateEl(sel.id, { content: e.target.value })
                            }
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
                        fontKey={`content:${sel.id}`}
                        overrideValue={getFontOverride(settings.responsive, device, `content:${sel.id}`)}
                        onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, `content:${sel.id}`, v) }))}
                        colorKey={`content:${sel.id}`}
                        colorOverrideValue={getColorOverride(settings.responsive, device, `content:${sel.id}`)}
                        onOverrideColor={(v) => updateSettings((prev) => ({ responsive: withColorOverride(prev.responsive, device, `content:${sel.id}`, v) }))}
                      />
                      <AnimationBuilder design={sel.design} onChange={(d) => updateEl(sel.id, { design: d })} />
                    </>
                  }
                />
              )}

              {(sel.kind === "image" || sel.kind === "images") && (
                <div className="space-y-2">
                  <label className="btn btn-outline text-xs cursor-pointer inline-block">
                    {sel.kind === "images" ? "Add Images" : "Upload Image"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple={sel.kind === "images"}
                      className="hidden"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files) return;
                        for (const f of Array.from(files)) {
                          const url = await uploadImage(f);
                          if (url) updateEl(sel.id, { image_urls: [...(sel.image_urls ?? []), url] });
                        }
                      }}
                    />
                  </label>
                  {(sel.image_urls ?? []).length > 0 && (
                    <ul className="space-y-1">
                      {sel.image_urls?.map((u, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs">
                          <span className="flex-1 truncate text-[var(--ink-faint)]">{u}</span>
                          <button type="button" className="text-red-500" onClick={() => updateEl(sel.id, { image_urls: sel.image_urls?.filter((_, j) => j !== i) })}>✕</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ColorField label="Border color" value={sel.borderColor ?? "#000000"} onChange={(v) => updateEl(sel.id, { borderColor: v })} />
                  <div>
                    <label className="block text-[10px] text-[var(--ink-soft)] mb-1">Border thickness: {sel.borderWidth ?? 0}px</label>
                    <input type="range" min={0} max={12} value={sel.borderWidth ?? 0}
                      onChange={(e) => updateEl(sel.id, { borderWidth: parseInt(e.target.value, 10) })}
                      className="w-full accent-[var(--accent)]" />
                  </div>
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
                    fontKey={`content:${sel.id}`}
                    overrideValue={getFontOverride(settings.responsive, device, `content:${sel.id}`)}
                    onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, `content:${sel.id}`, v) }))}
                    colorKey={`content:${sel.id}`}
                    colorOverrideValue={getColorOverride(settings.responsive, device, `content:${sel.id}`)}
                    onOverrideColor={(v) => updateSettings((prev) => ({ responsive: withColorOverride(prev.responsive, device, `content:${sel.id}`, v) }))}
                  />
                </>
              )}

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

              {/* Guest hover interactivity: on by default for buttons (opt
                  out), off by default for text/shapes/images (opt in).
                  Device-shared; per-device sizes/colors still apply. */}
              <InteractionBuilder
                value={sel.design.interactive}
                defaultOn={sel.kind === "button"}
                onChange={(next) => updateEl(sel.id, { design: { ...sel.design, interactive: next } })}
              />
              {/* Per-device status lives INSIDE the edit card (not a
                  separate grid item) so toggling devices never changes page
                  height — same methodology as the hero and header sections.
                  Desktop edits the shared base; tablet/mobile store overrides
                  (size, box and color) and inherit desktop until customized.
                  Dragging/resizing in the preview writes the box override. */}
              {device !== "desktop" && (
                <div className="space-y-2 border-t border-[var(--rule)] pt-3">
                  <h3 className="font-display text-sm font-semibold text-[var(--ink)]">
                    {deviceLabel} layout
                  </h3>
                  {(() => {
                    const layoutOverride = getRectOverride(settings.responsive, device, `content:${sel.id}`);
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
                                responsive: withRectOverride(prev.responsive, device, `content:${sel.id}`, undefined),
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
                  Select a block on the canvas or in the list to edit its content and style.
                </p>
                <p className="text-[10px] text-[var(--ink-faint)]">
                  Tip: Tab cycles blocks, Enter focuses the text field.
                </p>
              </div>
            )}
          </EditableCard>
          </div>
        </div>

        {/* ── Preview (below, full width) ──────────────────────── */}
        <section className="space-y-4">
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
                Drag boxes to move • drag handles to resize • Shift-click for multi-select • Tab cycles blocks • Enter edits text • click list to locate in preview
              </span>
              <CanvasHeightControl
                previewHeight={previewHeight}
                setPreviewHeight={setPreviewHeight}
              />
            </div>
          </div>
          <PreviewShell
            settings={settings}
            org={orgContent}
            paragraphs={paragraphs}
            colors={{
              bg: settings.background_color,
              text: settings.text_color,
              accent: settings.accent_color,
            }}
            orgName={orgName}
            previewHeight={previewHeight}
          />
        </section>
      </div>

      {/* Content element overlay portals */}
      <ContentOverlay
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