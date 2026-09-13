import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/org";
import { defaultReservePageDesign, type ReservePageDesign } from "@/lib/design";
import { BookingForm } from "./booking-form";

/** Convert a TextDesign to inline styles (server-rendered). */
function inline(
  d: { fontFamily: string; fontSize: number; color: string; textAlign: string },
  extra?: React.CSSProperties,
): React.CSSProperties {
  return {
    fontFamily: d.fontFamily,
    fontSize: `${d.fontSize}px`,
    color: d.color,
    textAlign: d.textAlign as React.CSSProperties["textAlign"],
    ...extra,
  };
}

export default async function ReservePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
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
  const isCleanSlate = org.theme_color === "#fafaf9";

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      {/* Top Back Navigation Button */}
      <div className="mb-6">
        <Link
          href={`/${org.slug}`}
          className={isCleanSlate ? "inline-flex items-center gap-2 text-sm font-medium hover:underline" : "inline-flex items-center gap-2 text-sm font-medium text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"}
        >
          <span aria-hidden="true">&larr;</span>
          <span>Back to {org.name}</span>
        </Link>
      </div>

      <h1
        style={{
          fontFamily: reserveDesign.title_design.fontFamily,
          fontSize: `${reserveDesign.title_design.fontSize}px`,
          color: reserveDesign.title_design.color,
          fontWeight: 700,
          marginBottom: "0.5rem",
        }}
      >
        Book a Table
      </h1>
      <p
        style={{
          fontFamily: reserveDesign.subtitle_design.fontFamily,
          fontSize: `${reserveDesign.subtitle_design.fontSize}px`,
          color: reserveDesign.subtitle_design.color,
          marginBottom: "2rem",
        }}
      >
        Reserve your spot at {org.name}. Choose your party size, tell us when, and
        we will automatically prepare the optimal table for you (2-hour reservation).
      </p>

      <BookingForm orgId={org.id} orgSlug={org.slug} accent={accent} />

      {/* Bottom Back Button */}
      <div className="mt-8 pt-6 text-center" style={{ borderTop: `1px solid ${reserveDesign.subtitle_design.color}22` }}>
        <Link
          href={`/${org.slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
          style={{ color: accent }}
        >
          <span aria-hidden="true">&larr;</span>
          <span>Return to {org.name} overview</span>
        </Link>
      </div>
    </div>
  );
}