"use client";

import { useDesign } from "../use-design";
import { DesignNav } from "../design-nav";
import { ColorField, DesignField } from "../design-fields";
import { SiteHeader } from "@/components/SiteHeader";
import { defaultReservePageDesign, type DesignSettingsV2, type ReservePageDesign } from "@/lib/design";

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

          {/* Form box border */}
          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Booking Form Box Border</h3>
            <ColorField label="Border color" value={reserve.border_color} onChange={(v) => update({ border_color: v })} />
            <div>
              <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Border width: {reserve.border_width}px</label>
              <input type="range" min={0} max={8} value={reserve.border_width}
                onChange={(e) => update({ border_width: parseInt(e.target.value, 10) })}
                className="w-full accent-[var(--accent)]" />
            </div>
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
              <div className="max-w-xl mx-auto px-4 py-10">
                <h1 style={text(reserve.title_design, { fontWeight: 700 })}>Book a Table</h1>
                <p style={text(reserve.subtitle_design, { marginBottom: "2rem" })}>
                  Reserve your spot at {orgName}. Choose your party size, tell us when, and
                  we will automatically prepare the optimal table for you (2-hour reservation).
                </p>

                {/* Sample booking form */}
                <div
                  className="rounded-lg p-5 space-y-4"
                  style={{
                    backgroundColor: "#ffffff",
                    border: `${reserve.border_width}px solid ${reserve.border_color}`,
                  }}
                >
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