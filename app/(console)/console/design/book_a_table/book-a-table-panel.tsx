"use client";

import { useDesign } from "../use-design";
import { useDesignDevice } from "../design-device";
import { DesignNav } from "../design-nav";
import { EditableCard, EditableGrid } from "../editable-card";
import { ColorField, DesignField } from "../design-fields";
import { SiteHeader } from "@/components/SiteHeader";
import { defaultReservePageDesign, getColorOverride, getFontOverride, resolveColor, resolveFontSize, withColorOverride, withFontOverride, type DesignSettingsV2, type ReservePageDesign } from "@/lib/design";

export function BookATablePanel({
  orgId,
  orgName,
  initialSettings,
}: {
  orgId: string;
  orgName: string;
  initialSettings: DesignSettingsV2;
}) {
  const { settings, updateSettings, saving, saved, saveError, retrySave } = useDesign(initialSettings, orgId);
  const { device } = useDesignDevice();
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

  // Real duration line from the org's booking_config — same derivation as the
  // public reserve page (reserve/page.tsx). Falls back to "2h reservation".
  const bookingConfig = settings.booking_config;
  const noTimeLimit = Boolean(bookingConfig?.no_time_limit);
  const rawDuration = typeof bookingConfig?.duration_minutes === "number" ? bookingConfig.duration_minutes : 120;
  const durationMinutes = Number.isFinite(rawDuration) && rawDuration > 0 && rawDuration <= 24 * 60 ? Math.round(rawDuration) : 120;
  const durationText = noTimeLimit
    ? "no time limit"
    : `${durationMinutes >= 60 ? `${Math.floor(durationMinutes / 60)}h ` : ""}${durationMinutes % 60 ? `${durationMinutes % 60}m` : ""}`.trim() + " reservation" || "2h reservation";

  // NOTE: the public reserve page renders title+subtitle fully, labels with
  // color+size (booking-form.tsx resolves reserve.label per-device), and the
  // submit button with the button design's family/color/size. Alignment /
  // shadow / animation controls stay hidden because the public page ignores
  // them. This preview mirrors that subset.
  // Renders at 1:1 (no previewScale) to match the public page's raw px sizes.
  // Sizes resolve per-device overrides so the preview stays truthful on
  // tablet/mobile.
  const text = (d: { fontFamily: string; fontSize: number; color: string }, fontKey: string, extra?: React.CSSProperties): React.CSSProperties => ({
    fontFamily: d.fontFamily,
    fontSize: `${resolveFontSize(d.fontSize, fontKey, device, settings.responsive)}px`,
    color: resolveColor(d.color, fontKey, device, settings.responsive),
    ...extra,
  });
  // Accent-gradient word treatment (shares OrgPageView's .gradient-text).
  const gcls = (d: { gradient?: boolean }): string | undefined =>
    d.gradient ? "gradient-text" : undefined;

  // Field labels mirror the public booking form (booking-form.tsx).
  const labelStyle: React.CSSProperties = text(reserve.label_design, "reserve.label", { display: "block", marginBottom: "0.375rem", fontWeight: 600 });
  const inputStyle: React.CSSProperties = {
    borderColor: reserve.input_border_color,
    backgroundColor: reserve.input_bg_color,
    color: reserve.input_text_color,
  };

  return (
    <div>
      <DesignNav />
      <div className="space-y-10">
        {/* ── Controls (full width, on top) ────────────────────── */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Book a Table Page</h2>
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

          <EditableGrid>
          <EditableCard hover title={`Back Button ("Back to ${orgName}")`}>
                <ColorField label="Color" value={reserve.back_button_color ?? "#ffffff"} onChange={(v) => update({ back_button_color: v })} bgColor={colors.bg} />
          </EditableCard>

          <EditableCard hover title='Page Title ("Book a Table")'>
                <DesignField customFonts={settings.custom_fonts} label="" design={reserve.title_design} onChange={(d) => update({ title_design: d })} fontKey="reserve.title" overrideValue={getFontOverride(settings.responsive, device, "reserve.title")} onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "reserve.title", v) }))} colorKey="reserve.title" colorOverrideValue={getColorOverride(settings.responsive, device, "reserve.title")} onOverrideColor={(v) => updateSettings((prev) => ({ responsive: withColorOverride(prev.responsive, device, "reserve.title", v) }))} />
          </EditableCard>

          <EditableCard hover title="Subtitle">
                <DesignField customFonts={settings.custom_fonts} label="" design={reserve.subtitle_design} onChange={(d) => update({ subtitle_design: d })} fontKey="reserve.subtitle" overrideValue={getFontOverride(settings.responsive, device, "reserve.subtitle")} onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "reserve.subtitle", v) }))} colorKey="reserve.subtitle" colorOverrideValue={getColorOverride(settings.responsive, device, "reserve.subtitle")} onOverrideColor={(v) => updateSettings((prev) => ({ responsive: withColorOverride(prev.responsive, device, "reserve.subtitle", v) }))} />
          </EditableCard>

          <EditableCard hover title="Form Labels">
                <DesignField customFonts={settings.custom_fonts} label="" design={reserve.label_design} onChange={(d) => update({ label_design: d })} fontKey="reserve.label" overrideValue={getFontOverride(settings.responsive, device, "reserve.label")} onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "reserve.label", v) }))} colorKey="reserve.label" colorOverrideValue={getColorOverride(settings.responsive, device, "reserve.label")} onOverrideColor={(v) => updateSettings((prev) => ({ responsive: withColorOverride(prev.responsive, device, "reserve.label", v) }))} />
          </EditableCard>

          <EditableCard hover title="Submit Button Text">
                <DesignField customFonts={settings.custom_fonts} label="" design={reserve.button_design} onChange={(d) => update({ button_design: d })} fontKey="reserve.button" overrideValue={getFontOverride(settings.responsive, device, "reserve.button")} onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "reserve.button", v) }))} colorKey="reserve.button" colorOverrideValue={getColorOverride(settings.responsive, device, "reserve.button")} onOverrideColor={(v) => updateSettings((prev) => ({ responsive: withColorOverride(prev.responsive, device, "reserve.button", v) }))} />
          </EditableCard>

          {/* Input colors */}
          <EditableCard hover title="Input Field Colors">
                <ColorField label="Input background" value={reserve.input_bg_color} onChange={(v) => update({ input_bg_color: v })} />
                <ColorField label="Input text" value={reserve.input_text_color} onChange={(v) => update({ input_text_color: v })} bgColor={reserve.input_bg_color} />
                <ColorField label="Input border" value={reserve.input_border_color} onChange={(v) => update({ input_border_color: v })} />
          </EditableCard>

          {/* Form box border */}
          <EditableCard hover title="Booking Form Box Border">
                <ColorField label="Border color" value={reserve.border_color} onChange={(v) => update({ border_color: v })} />
                <div>
                  <label className="block text-[10px] text-[var(--ink-soft)] mb-1">Border width: {reserve.border_width}px</label>
                  <input type="range" min={0} max={8} value={reserve.border_width}
                    onChange={(e) => update({ border_width: parseInt(e.target.value, 10) })}
                    className="w-full accent-[var(--accent)]" />
                </div>
          </EditableCard>
          </EditableGrid>

        </div>

        {/* ── Live preview (full width, below) ──────────────────── */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Live Preview</h2>
          <div className="rounded-lg overflow-hidden border border-[var(--rule)] bg-[var(--paper-raised)]">
            <div className="flex items-center justify-between px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] border-b border-[var(--rule)]">
              <span>Book a table preview · non-interactive</span>
              <span>{orgName}</span>
            </div>
            <div
              className="h-[720px] overflow-y-auto relative"
              style={{ backgroundColor: colors.bg, color: colors.text, containerType: "inline-size" }}
            >
              <SiteHeader org={orgView} settings={settings} colors={colors} mode="preview" device={device} />
              <div className="max-w-xl mx-auto px-4 py-10">
                <div className="mb-6">
                  <span
                    className="inline-flex items-center gap-2 text-sm font-medium underline"
                    style={{ color: reserve.back_button_color ?? "#ffffff" }}
                  >
                    <span aria-hidden="true">&larr;</span>
                    <span>Back to {orgName}</span>
                  </span>
                </div>
                <h1 className={gcls(reserve.title_design)} style={text(reserve.title_design, "reserve.title", { fontWeight: 700 })}>Book a Table</h1>
                <p className={gcls(reserve.subtitle_design)} style={text(reserve.subtitle_design, "reserve.subtitle", { marginBottom: "2rem" })}>
                  Reserve your spot at {orgName}. Choose your party size, tell us when, and
                  we will automatically prepare the optimal table for you ({durationText}).
                </p>

                {/* Preview of the public booking form (booking-form.tsx):
                    same field names/order, input colors, and white-on-accent
                    submit button. Non-interactive by design. */}
                <div
                  className="rounded-lg p-5 space-y-5 pointer-events-none select-none"
                  aria-hidden="true"
                  style={{
                    backgroundColor: "#ffffff",
                    border: `${reserve.border_width}px solid ${reserve.border_color}`,
                  }}
                >
                  <div>
                    <label className={gcls(reserve.label_design)} style={labelStyle}>Your name</label>
                    <div className="w-full rounded-lg border px-3 py-2.5 text-sm" style={inputStyle}>
                      Jane Doe
                    </div>
                  </div>
                  <div>
                    <label className={gcls(reserve.label_design)} style={labelStyle}>Party Size (Guests)</label>
                    <div className="w-full rounded-lg border px-3 py-2.5 text-sm" style={inputStyle}>
                      2
                    </div>
                  </div>
                  <div>
                    <label className={gcls(reserve.label_design)} style={labelStyle}>Date</label>
                    <div className="w-full rounded-lg border px-3 py-2.5 text-sm" style={inputStyle}>
                      Pick a date
                    </div>
                  </div>
                  <div>
                    <label className={gcls(reserve.label_design)} style={labelStyle}>Time</label>
                    <div className="w-full rounded-lg border px-3 py-2.5 text-sm" style={inputStyle}>
                      Pick a time
                    </div>
                    <p className="text-xs text-[var(--ink-faint)] mt-1">
                      Reservations are {durationText}.
                    </p>
                  </div>
                  <button
                    type="button"
                    tabIndex={-1}
                    className={`w-full py-3 rounded-full font-medium text-white${reserve.button_design.gradient ? " gradient-text" : ""}`}
                    // Matches the public page: submit button uses the button
                    // design (family/color/size, per-device size override).
                    style={{
                      backgroundColor: colors.accent,
                      fontFamily: reserve.button_design.fontFamily,
                      color: resolveColor(reserve.button_design.color, "reserve.button", device, settings.responsive),
                      fontSize: `${resolveFontSize(reserve.button_design.fontSize, "reserve.button", device, settings.responsive)}px`,
                    }}
                  >
                    Confirm booking
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
