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
  newContentElement,
  type ContentElement,
  type ContentElementKind,
  type DesignSettingsV2,
} from "@/lib/design";

const KIND_LABELS: Record<string, string> = {
  title: "Title",
  text: "Text",
  image: "Image",
  images: "Images (carousel)",
  shape: "Shape",
  button: "Button",
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
  onUpdate: (id: string, patch: Partial<ContentElement>) => void;
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
          maxY={400}
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
  const { settings, updateSettings, saving, saved } = useDesign(initialSettings, orgId);
  const [selected, setSelected] = useState<string[]>([]);
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

  const elements = settings.content.elements;

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
    updateSettings({ content: { elements: elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) } });
  };

  const removeEl = (id: string) => {
    updateSettings({ content: { elements: elements.filter((e) => e.id !== id) } });
    setSelected((prev) => prev.filter((x) => x !== id));
  };

  const addEl = (kind: ContentElementKind) => {
    const el = newContentElement(kind);
    // Shapes go to the back (bottom of the stack); everything else on top.
    updateSettings({ content: { elements: kind === "shape" ? [el, ...elements] : [...elements, el] } });
    setSelected([el.id]);
  };

  const addButton = (buttonType: "book" | "menu") => {
    const el = newContentElement("button");
    el.buttonType = buttonType;
    updateSettings({ content: { elements: [...elements, el] } });
    setSelected([el.id]);
  };

  // Click (or ⇧/⌘ + click) on a box: additive toggles, plain click selects one.
  const handleSelect = (id: string, additive: boolean) => {
    setSelected((prev) => {
      if (additive) return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return prev.includes(id) ? prev : [id];
    });
  };

  // Group drag from start-rects: 1:1 pointer tracking (same feel as a single
  // box, no accumulation) and clamped as ONE bounding box so the group keeps
  // its relative layout when it hits an edge.
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
    const ny = bh >= 400 ? b.y0 + dy : Math.min(400 - bh, Math.max(0, b.y0 + dy));
    const adx = nx - b.x0, ady = ny - b.y0;
    const startById = new Map(startRects.map((e) => [e.id, e]));
    updateSettings({
      content: {
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
    updateSettings({ content: { elements: arr } });
  };

  const uploadImage = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("org_id", orgId);
    const res = await fetch("/api/design/photos/upload", { method: "POST", body: form });
    return res.ok ? ((await res.json()).url as string) : null;
  };

  const sel = selected.length === 1 ? (elements.find((e) => e.id === selected[0]) ?? null) : null;

  return (
    <div>
      <DesignNav />
      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* ── Controls ─────────────────────────────────────────── */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Content</h2>
            <span className="text-xs text-[var(--ink-faint)]">
              {saving ? "Saving…" : saved ? "✓ Saved" : ""}
            </span>
          </div>
          <p className="text-xs text-[var(--ink-soft)] -mt-4">
            About us, paragraphs, location &amp; contact — every block is a
            Word-style rectangle you can move and resize. Full font/color/size
            controls inside each rectangle.
          </p>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
              Blocks
            </h3>
            <div className="space-y-2">
              {elements.map((e, i) => (
                <div
                  key={e.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded border text-xs ${
                    selected.includes(e.id) ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--rule)]"
                  }`}
                >
                  <button type="button" onClick={(ev) => handleSelect(e.id, ev.shiftKey || ev.metaKey || ev.ctrlKey)} className="flex-1 text-left truncate">
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
              {(["title", "text", "image", "images", "shape", "button"] as ContentElementKind[]).map((k) => (
                <button key={k} type="button" onClick={() => addEl(k)} className="btn btn-outline text-xs">
                  + {KIND_LABELS[k]}
                </button>
              ))}
            </div>
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
          </section>

          {/* Selected element controls */}
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

              {(sel.kind === "title" || sel.kind === "text") && (
                <>
                  {sel.ref && "org" in sel.ref && (
                    <p className="text-[10px] text-[var(--ink-faint)]">
                      Bound to <b>{sel.ref.org}</b> — edit from the public site or via the Text tab.
                    </p>
                  )}
                  {!sel.ref && (
                    <div>
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
                </>
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

              {sel.kind !== "shape" && sel.kind !== "button" && (
                <DesignField
                  label=""
                  design={sel.design}
                  onChange={(d) => updateEl(sel.id, { design: d })}
                />
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
        </div>
      </div>

      {/* Content element overlay portals */}
      <ContentOverlay
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