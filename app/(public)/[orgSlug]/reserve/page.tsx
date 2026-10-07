import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/org";
import { defaultReservePageDesign, type ReservePageDesign, type ResponsiveOverrides, getShadowStyle } from "@/lib/design";
import { BookingForm, ReserveHeadings } from "./booking-form";

// Cache for 60s — booking page content is mostly static per visit
export const revalidate = 60;

/** Convert a TextDesign to inline styles (server-rendered). */
function inline(
  d: { fontFamily: string; fontSize: number; color: string; textAlign: string; shadow?: { color: string; direction: number; length: number; opacity?: number } },
  extra?: React.CSSProperties,
): React.CSSProperties {
  return {
    fontFamily: d.fontFamily,
    fontSize: `${d.fontSize}px`,
    color: d.color,
    textAlign: d.textAlign as React.CSSProperties["textAlign"],
    textShadow: getShadowStyle(d.shadow),
    ...extra,
  };
}

export default async function ReservePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  if (!orgSlug || !/^[a-z0-9-]{1,80}$/i.test(orgSlug)) {
    notFound();
  }
  const org = await getOrgBySlug(orgSlug);

  if (!org) {
    notFound();
  }

  // Accent from design settings (ACCENT (BUTTONS, LINKS)), falling back to
  // the org's secondary theme color when no design has been saved yet.
  const accent = org.design_settings
    ? ((org.design_settings as Record<string, unknown>)?.accent_color as string | undefined) ?? org.theme_secondary_color ?? "#f97316"
    : (org.theme_secondary_color ?? "#f97316");
  const reserveDesign = org.design_settings
    ? { ...defaultReservePageDesign(), ...((org.design_settings as Record<string, unknown>)?.reserve_page as Record<string, unknown> ?? {}) }
    : defaultReservePageDesign();
  const responsive = (org.design_settings as Record<string, unknown> | null)?.responsive as ResponsiveOverrides | undefined;
  const isCleanSlate = org.theme_color === "#fafaf9";

  const bookingConfig = (org.design_settings as Record<string, unknown> | null)?.booking_config as {
    buffer_before_minutes?: number;
    duration_minutes?: number;
    no_time_limit?: boolean;
  } | undefined;
  const noTimeLimit = Boolean(bookingConfig?.no_time_limit);
  const rawDuration = typeof bookingConfig?.duration_minutes === "number" ? bookingConfig.duration_minutes : 120;
  const durationMinutes = Number.isFinite(rawDuration) && rawDuration > 0 && rawDuration <= 24 * 60 ? Math.round(rawDuration) : 120;
  const durationText = noTimeLimit
    ? "no time limit"
    : durationMinutes <= 0
      ? "2h reservation"
      : `${durationMinutes >= 60 ? `${Math.floor(durationMinutes / 60)}h ` : ""}${durationMinutes % 60 ? `${durationMinutes % 60}m` : ""}`.trim() + " reservation" || "2h reservation";

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      {/* Top Back Navigation Button */}
      <div className="mb-6">
        <Link
          href={`/${org.slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium underline"
          style={{ color: reserveDesign.back_button_color ?? "#ffffff" }}
        >
          <span aria-hidden="true">&larr;</span>
          <span>Back to {org.name}</span>
        </Link>
      </div>

      <ReserveHeadings
        titleDesign={reserveDesign.title_design}
        subtitleDesign={reserveDesign.subtitle_design}
        responsive={responsive}
        orgName={org.name}
        durationText={durationText}
      />

      <div
        className="rounded-lg p-5"
        style={{
          backgroundColor: "#ffffff",
          border: `${reserveDesign.border_width}px solid ${reserveDesign.border_color}`,
        }}
      >
        <BookingForm
          orgId={org.id}
          orgSlug={org.slug}
          accent={accent}
          inputBg={reserveDesign.input_bg_color}
          inputText={reserveDesign.input_text_color}
          inputBorder={reserveDesign.input_border_color}
          labelColor={reserveDesign.label_design.color}
          labelDesign={reserveDesign.label_design}
          buttonDesign={reserveDesign.button_design}
          responsive={responsive}
          durationText={durationText}
        />
      </div>

      {/* Bottom Back Button */}
      <div className="mt-8 pt-6 text-center" style={{ borderTop: `1px solid ${reserveDesign.subtitle_design.color}22` }}>
        <Link
          href={`/${org.slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-white underline"
          style={{ color: accent }}
        >
          <span aria-hidden="true">&larr;</span>
          <span>Return to {org.name} overview</span>
        </Link>
      </div>
    </div>
  );
}