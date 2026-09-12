"use client";

import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { useDesign } from "../use-design";
import { ResizableBox } from "../resizable-box";
import { PreviewShell } from "../preview-shell";
import { DesignNav } from "../design-nav";
import { DesignField } from "../design-fields";
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
}: {
  elements: ContentElement[];
  selected: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ContentElement>) => void;
}) {
  const slot = useOverlaySlot("content");
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
  const [selected, setSelected] = useState<string | null>(null);
  const [previewHeight, setPreviewHeight] = useState(() => {
    try {
      const stored = Number(localStorage.getItem("tablecraft_preview_height"));
      return [640, 960, 1280].includes(stored) ? stored : 640;
    } catch { return 640; }
  });

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
    setSelected(null);
  };

  const addEl = (kind: ContentElementKind) => {
    const el = newContentElement(kind);
    updateSettings({ content: { elements: [...elements, el] } });
    setSelected(el.id);
  };

  const uploadImage = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("org_id", orgId);
    const res = await fetch("/api/design/photos/upload", { method: "POST", body: form });
    return res.ok ? ((await res.json()).url as string) : null;
  };

  const sel = elements.find((e) => e.id === selected);

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
              {elements.map((e) => (
                <div
                  key={e.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded border text-xs ${
                    selected === e.id ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--rule)]"
                  }`}
                >
                  <button type="button" onClick={() => setSelected(e.id === selected ? null : e.id)} className="flex-1 text-left truncate">
                    <span className="font-mono mr-2 text-[10px] opacity-60">{KIND_LABELS[e.kind]?.slice(0, 3).toUpperCase()}</span>
                    {e.kind === "title" || e.kind === "text" ? (e.content || (e.ref && "org" in e.ref ? `(${e.ref.org})` : "") || resolveText(e).slice(0, 30) || `Empty ${KIND_LABELS[e.kind]}`) : KIND_LABELS[e.kind]}
                  </button>
                  <button type="button" onClick={() => removeEl(e.id)} className="text-red-500 text-[10px]">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {(["title", "text", "image", "images"] as ContentElementKind[]).map((k) => (
                <button key={k} type="button" onClick={() => addEl(k)} className="btn btn-outline text-xs">
                  + {KIND_LABELS[k]}
                </button>
              ))}
            </div>
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
        selected={selected ?? null}
        onSelect={(id) => setSelected(id)}
        onUpdate={updateEl}
      />
    </div>
  );
}