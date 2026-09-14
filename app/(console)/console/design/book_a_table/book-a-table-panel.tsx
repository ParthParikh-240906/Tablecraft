"use client";

import { useDesign } from "../use-design";
import { DesignNav } from "../design-nav";
import { ColorField, DesignField } from "../design-fields";
import { SiteHeader } from "@/components/SiteHeader";
import { defaultReservePageDesign, type DesignSettingsV2, type ReservePageDesign } from "@/lib/design";
import { ShapeStyle } from "@/lib/design";

interface ShapeElement {
  id: string;
  style: ShapeStyle;
}

export function BookATablePanel({
  orgId,
  orgName,
  initialSettings,
}: {
  orgId: string;
  orgName: string;
  initialSettings: DesignSettingsV2;
}) {
  const { settings, updateSettings, saving, saved } = useDesign(initialSettings, orgId);
  const reserve: ReservePageDesign = settings.reserve_page ?? defaultReservePageDesign();
  const colors = {
    bg: settings.background_color,
    text: settings.text_color,
    accent: settings.accent_color,
  };

  const update = (patch: Partial<ReservePageDesign>) => {
    updateSettings({ reserve_page: { ...reserve, ...patch } } as Partial<DesignSettingsV2>);
  };

  const updateShape = (id: string, patch: Partial<ShapeStyle>) => {
    const shapes = (settings.reserve_page_shapes as ShapeElement[] | undefined) ?? [];
    updateSettings({
      reserve_page_shapes: shapes.map((s) => (s.id === id ? { ...s, style: { ...s.style, ...patch } } : s)),
    } as Partial<DesignSettingsV2>);
  };

  const addShape = () => {
    const shapes = (settings.reserve_page_shapes as ShapeElement[] | undefined) ?? [];
    const newShape: ShapeElement = {
      id: Math.random().toString(36).slice(2, 10),
      style: { color: "#1a1a1a", borderWidth: 0, borderColor: undefined, borderRadius: 0, opacity: 80 },
    };
    updateSettings({ reserve_page_shapes: [...shapes, newShape] } as Partial<DesignSettingsV2>);
  };

  const removeShape = (id: string) => {
    const shapes = (settings.reserve_page_shapes as ShapeElement[] | undefined) ?? [];
    updateSettings({ reserve_page_shapes: shapes.filter((s) => s.id !== id) } as Partial<DesignSettingsV2>);
  };

  const orgView = {
    name: orgName,
    tagline: null,
    logo_url: null,
    about_title: null,
    about_text: null,
    contact_heading: null,
    location: null,
    contact_phone: null,
    contact_email: null,
    contact_address: null,
    restaurant_photos: [],
  };

  const shapes = (settings.reserve_page_shapes as ShapeElement[] | undefined) ?? [];
  const previewScale = 0.85;

  const text = (d: { fontFamily: string; fontSize: number; color: string; textAlign: string }, extra?: React.CSSProperties): React.CSSProperties => ({
    fontFamily: d.fontFamily,
    fontSize: `${d.fontSize * previewScale}px`,
    color: d.color,
    textAlign: d.textAlign as React.CSSProperties["textAlign"],
    ...extra,
  });

  return (
    <div>
      <DesignNav />
      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* ── Controls ─────────────────────────────────────────── */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Book a Table Page</h2>
            <span className="text-xs text-[var(--ink-faint)]">
              {saving ? "Saving…" : saved ? "✓ Saved" : ""}
            </span>
          </div>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Page Title ("Book a Table")</h3>
            <ColorField label="Color" value={reserve.title_design.color} onChange={(v) => update({ title_design: { ...reserve.title_design, color: v } })} />
            <div>
              <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Font size: {reserve.title_design.fontSize}px</label>
              <input type="range" min={12} max={72} value={reserve.title_design.fontSize}
                onChange={(e) => update({ title_design: { ...reserve.title_design, fontSize: parseInt(e.target.value, 10) } })}
                className="w-full accent-[var(--accent)]" />
            </div>
            <DesignField label="" design={reserve.title_design} onChange={(d) => update({ title_design: d })} />
          </section>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Subtitle</h3>
            <ColorField label="Color" value={reserve.subtitle_design.color} onChange={(v) => update({ subtitle_design: { ...reserve.subtitle_design, color: v } })} />
            <div>
              <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Font size: {reserve.subtitle_design.fontSize}px</label>
              <input type="range" min={10} max={40} value={reserve.subtitle_design.fontSize}
                onChange={(e) => update({ subtitle_design: { ...reserve.subtitle_design, fontSize: parseInt(e.target.value, 10) } })}
                className="w-full accent-[var(--accent)]" />
            </div>
            <DesignField label="" design={reserve.subtitle_design} onChange={(d) => update({ subtitle_design: d })} />
          </section>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Form Labels</h3>
            <ColorField label="Color" value={reserve.label_design.color} onChange={(v) => update({ label_design: { ...reserve.label_design, color: v } })} />
            <div>
              <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Font size: {reserve.label_design.fontSize}px</label>
              <input type="range" min={8} max={28} value={reserve.label_design.fontSize}
                onChange={(e) => update({ label_design: { ...reserve.label_design, fontSize: parseInt(e.target.value, 10) } })}
                className="w-full accent-[var(--accent)]" />
            </div>
            <DesignField label="" design={reserve.label_design} onChange={(d) => update({ label_design: d })} />
          </section>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Submit Button Text</h3>
            <ColorField label="Color" value={reserve.button_design.color} onChange={(v) => update({ button_design: { ...reserve.button_design, color: v } })} />
            <div>
              <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Font size: {reserve.button_design.fontSize}px</label>
              <input type="range" min={10} max={32} value={reserve.button_design.fontSize}
                onChange={(e) => update({ button_design: { ...reserve.button_design, fontSize: parseInt(e.target.value, 10) } })}
                className="w-full accent-[var(--accent)]" />
            </div>
            <DesignField label="" design={reserve.button_design} onChange={(d) => update({ button_design: d })} />
          </section>

          {/* Input colors */}
          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Input Field Colors</h3>
            <ColorField label="Input background" value={reserve.input_bg_color} onChange={(v) => update({ input_bg_color: v })} />
            <ColorField label="Input text" value={reserve.input_text_color} onChange={(v) => update({ input_text_color: v })} />
            <ColorField label="Input border" value={reserve.input_border_color} onChange={(v) => update({ input_border_color: v })} />
          </section>

          {/* Shapes */}
          <section className="ticket p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Background Shapes</h3>
              <button type="button" onClick={addShape} className="btn btn-outline text-xs">+ Add Shape</button>
            </div>
            {shapes.length === 0 && (
              <p className="text-xs text-[var(--ink-faint)]">No shapes. Add one to create a layered background behind the booking form.</p>
            )}
            {shapes.map((shape) => (
              <div key={shape.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-[var(--ink-soft)]">Shape {shapes.indexOf(shape) + 1}</span>
                  <button type="button" onClick={() => removeShape(shape.id)} className="text-red-500 text-[10px] underline">Remove</button>
                </div>
                <ColorField label="Fill color" value={shape.style.color ?? "#1a1a1a"} onChange={(v) => updateShape(shape.id, { color: v })} />
                <div>
                  <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Opacity: {shape.style.opacity ?? 100}%</label>
                  <input type="range" min={0} max={100} value={shape.style.opacity ?? 100}
                    onChange={(e) => updateShape(shape.id, { opacity: parseInt(e.target.value, 10) })}
                    className="w-full accent-[var(--accent)]" />
                </div>
                <ColorField label="Border color" value={shape.style.borderColor ?? "#ffffff"} onChange={(v) => updateShape(shape.id, { borderColor: v })} />
                <div>
                  <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Border width: {shape.style.borderWidth ?? 0}px</label>
                  <input type="range" min={0} max={12} value={shape.style.borderWidth ?? 0}
                    onChange={(e) => updateShape(shape.id, { borderWidth: parseInt(e.target.value, 10) })}
                    className="w-full accent-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Roundness: {shape.style.borderRadius ?? 0}% (50 = circle)</label>
                  <input type="range" min={0} max={50} value={shape.style.borderRadius ?? 0}
                    onChange={(e) => updateShape(shape.id, { borderRadius: parseInt(e.target.value, 10) })}
                    className="w-full accent-[var(--accent)]" />
                </div>
              </div>
            ))}
          </section>
        </div>

        {/* ── Live preview ─────────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Live Preview</h2>
          <div className="rounded-lg overflow-hidden border border-[var(--rule)] bg-[var(--paper-raised)]">
            <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--ink-faint)] border-b border-[var(--rule)]">
              <span>Book a table preview</span>
              <span>{orgName}</span>
            </div>
            <div
              className="h-[720px] overflow-y-auto relative"
              style={{ backgroundColor: colors.bg, color: colors.text, containerType: "inline-size" }}
            >
              <SiteHeader org={orgView} settings={settings} colors={colors} mode="preview" />
              <div className="max-w-xl mx-auto px-4 py-10 relative">
                {/* Background shapes (rendered first = behind everything) */}
                {shapes.map((shape) => (
                  <div
                    key={shape.id}
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundColor: shape.style.color,
                      opacity: (shape.style.opacity ?? 100) / 100,
                      border: shape.style.borderWidth
                        ? `${shape.style.borderWidth}px solid ${shape.style.borderColor ?? "#ffffff"}`
                        : undefined,
                      borderRadius: shape.style.borderRadius ? `${shape.style.borderRadius}%` : undefined,
                    }}
                  />
                ))}

                <h1 style={text(reserve.title_design, { fontWeight: 700, position: "relative", zIndex: 1 })}>Book a Table</h1>
                <p style={text(reserve.subtitle_design, { marginBottom: "2rem", position: "relative", zIndex: 1 })}>
                  Reserve your spot at {orgName}. Choose your party size, tell us when, and
                  we will automatically prepare the optimal table for you (2-hour reservation).
                </p>

                {/* Sample booking form */}
                <div className="space-y-4" style={{ position: "relative", zIndex: 1 }}>
                  <div>
                    <label style={text(reserve.label_design, { display: "block", marginBottom: "0.25rem", fontWeight: 600 })}>
                      Your Name
                    </label>
                    <div className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: reserve.input_border_color, backgroundColor: reserve.input_bg_color, color: reserve.input_text_color }}>
                      e.g. Alex Smith
                    </div>
                  </div>
                  <div>
                    <label style={text(reserve.label_design, { display: "block", marginBottom: "0.25rem", fontWeight: 600 })}>
                      Party Size
                    </label>
                    <div className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: reserve.input_border_color, backgroundColor: reserve.input_bg_color, color: reserve.input_text_color }}>
                      2 guests
                    </div>
                  </div>
                  <div>
                    <label style={text(reserve.label_design, { display: "block", marginBottom: "0.25rem", fontWeight: 600 })}>
                      Date
                    </label>
                    <div className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: reserve.input_border_color, backgroundColor: reserve.input_bg_color, color: reserve.input_text_color }}>
                      2026-09-20
                    </div>
                  </div>
                  <div>
                    <label style={text(reserve.label_design, { display: "block", marginBottom: "0.25rem", fontWeight: 600 })}>
                      Time
                    </label>
                    <div className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: reserve.input_border_color, backgroundColor: reserve.input_bg_color, color: reserve.input_text_color }}>
                      19:00
                    </div>
                  </div>
                  <button
                    type="button"
                    className="w-full py-3 rounded-full font-semibold"
                    style={{ backgroundColor: colors.accent, ...text(reserve.button_design) }}
                  >
                    Confirm Booking
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}