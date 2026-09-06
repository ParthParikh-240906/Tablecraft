import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug, getParagraphsByOrg } from "@/lib/org";
import type { Metadata } from "next";
import { RestaurantPhotoCarousel } from "@/components/RestaurantPhotoCarousel";

export const dynamic = "force-dynamic";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalizeWords(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const GOOGLE_FONTS_CSS = [
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Poppins:wght@400;700&family=Playfair+Display:wght@400;700&family=Lora:wght@400;700&family=Roboto+Slab:wght@400;700&family=Merriweather:wght@400;700&family=Open+Sans:wght@400;700&family=Montserrat:wght@400;700&family=Raleway:wght@400;700&family=Ubuntu:wght@400;700&display=swap",
].join("");

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextDesign {
  fontFamily: string;
  fontSize: number;
  color: string;
  textAlign: "left" | "center" | "right";
}

interface ParagraphRow {
  id: string;
  position: number;
  title: string | null;
  content: string | null;
  image_url: string | null;
  image_position: "text-left" | "text-right";
  title_design: TextDesign | null;
  content_design: TextDesign | null;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);

  if (!org) {
    return { title: "Restaurant Not Found" };
  }

  return {
    title: org.name,
    description: org.tagline || `${capitalizeWords(org.name)} - Browse our menu, book a table, and order ahead.`,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OrgLandingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);

  if (!org) {
    notFound();
  }

  const paragraphs = await getParagraphsByOrg(org.id);
  const paraRows: ParagraphRow[] | undefined = paragraphs as ParagraphRow[] | undefined;

  const design: Record<string, any> = org.design_settings ?? {};
  const mainColor = design.background_color ?? org.theme_color ?? "#141414";
  const textColor = design.text_color ?? org.theme_text_color ?? "#f5f5f4";
  const highlightColor = design.accent_color ?? org.theme_secondary_color ?? "#f97316";

  const ds = design as {
    name_design?: TextDesign;
    tagline_design?: TextDesign;
    about_title_design?: TextDesign;
    about_content_design?: TextDesign;
    contact_heading_design?: TextDesign;
    contact_body_design?: TextDesign;
    restaurant_photos?: string[];
  };


  const navBg = design.nav_background_color ?? mainColor;
  const navText = design.nav_text_color ?? textColor;

  // ── Collect fonts actually in use ────────────────────────────────────────
  const usedFonts = new Set<string>();
  const allDesigns: (TextDesign | undefined)[] = [
    ds.name_design,
    ds.tagline_design,
    ds.about_title_design,
    ds.about_content_design,
    ds.contact_heading_design,
    ds.contact_body_design,
  ];
  for (const d of allDesigns) {
    if (d?.fontFamily) usedFonts.add(d.fontFamily);
  }
  for (const para of paraRows ?? []) {
    if (para.title_design?.fontFamily) usedFonts.add(para.title_design.fontFamily);
    if (para.content_design?.fontFamily) usedFonts.add(para.content_design.fontFamily);
  }

  // Always inject Google Fonts sheet so all 10 are available
  const fontLinks = GOOGLE_FONTS_CSS;

  // Build inline styles for each designed element
  const styleBlock = `
    .tc-name       { font-family: ${ds.name_design?.fontFamily ?? "'Inter', sans-serif"};
                     font-size: ${ds.name_design?.fontSize ?? 48}px;
                     color: ${ds.name_design?.color ?? textColor};
                     text-align: ${ds.name_design?.textAlign ?? "center"}; }
    .tc-tagline    { font-family: ${ds.tagline_design?.fontFamily ?? "'Inter', sans-serif"};
                     font-size: ${ds.tagline_design?.fontSize ?? 20}px;
                     color: ${ds.tagline_design?.color ?? textColor};
                     text-align: ${ds.tagline_design?.textAlign ?? "center"}; }
    .tc-about-title{ font-family: ${ds.about_title_design?.fontFamily ?? "'Inter', sans-serif"};
                     font-size: ${ds.about_title_design?.fontSize ?? 30}px;
                     color: ${ds.about_title_design?.color ?? textColor};
                     text-align: ${ds.about_title_design?.textAlign ?? "left"}; }
    .tc-about-body { font-family: ${ds.about_content_design?.fontFamily ?? "'Inter', sans-serif"};
                     font-size: ${ds.about_content_design?.fontSize ?? 16}px;
                     color: ${ds.about_content_design?.color ?? textColor};
                     text-align: ${ds.about_content_design?.textAlign ?? "left"}; }
    .tc-loc-head   { font-family: ${ds.contact_heading_design?.fontFamily ?? "'Inter', sans-serif"};
                     font-size: ${ds.contact_heading_design?.fontSize ?? 28}px;
                     color: ${ds.contact_heading_design?.color ?? textColor};
                     text-align: ${ds.contact_heading_design?.textAlign ?? "center"}; }
    .tc-loc-body   { font-family: ${ds.contact_body_design?.fontFamily ?? "'Inter', sans-serif"};
                     font-size: ${ds.contact_body_design?.fontSize ?? 15}px;
                     color: ${ds.contact_body_design?.color ?? textColor};
                     text-align: ${ds.contact_body_design?.textAlign ?? "left"}; }
  `;

  return (

    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={fontLinks} />
      <style dangerouslySetInnerHTML={{ __html: styleBlock }} />

      <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: mainColor, color: textColor }}>
        {/* Background image — full-coverage overlay, matching preview */}
        {org.background_image_url && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${org.background_image_url}?t=${Date.now()})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.35,
              pointerEvents: "none",
            }}
          />
        )}
        {/* Hero Section */}
        <section className="py-20 px-4 text-center relative z-10">
          <div className="max-w-3xl mx-auto animate-[fade-up_600ms_ease-out_both]">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logo_url}
                alt={`${org.name} logo`}
                className="h-20 w-20 rounded-full object-cover mx-auto mb-6 shadow-lg"
              />
            ) : (
              <div
                className="h-20 w-20 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-6 shadow-lg"
                style={{ backgroundColor: highlightColor, color: mainColor }}
              >
                {org.name.charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className="tc-name tracking-tight mb-4">
              {capitalizeWords(org.name)}
            </h1>
            {org.tagline && (
              <p className="tc-tagline italic mb-2">
                {org.tagline}
              </p>
            )}
            <p className="text-lg mb-8" style={{ color: `${textColor}99` }}>
              Browse our menu, book a table, and order ahead — all in one place.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href={`/${org.slug}/menu`}
                className="px-6 py-3 rounded-full font-medium shadow-md hover:shadow-lg transition-shadow"
                style={{ backgroundColor: highlightColor, color: mainColor }}
              >
                View Menu
              </Link>
              <Link
                href={`/${org.slug}/reserve`}
                className="px-6 py-3 rounded-full border-2 font-medium backdrop-blur-sm hover:bg-white/10 transition-colors"
                style={{ borderColor: highlightColor, color: highlightColor }}
              >
                Book a Table
              </Link>
            </div>
          </div>
        </section>

        {/* About Section */}
        {org.about_text && (
          <section className="py-16 px-4 relative z-10">
            <div className="max-w-6xl mx-auto">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="tc-about-title mb-6">{org.about_title || "About Us"}</h2>
                  <p className="tc-about-body leading-relaxed whitespace-pre-line">
                    {org.about_text}
                  </p>
                </div>

                {/* Restaurant photos carousel */}
                {((ds.restaurant_photos?.length ?? 0) > 0 ? ds.restaurant_photos : (org.restaurant_photos?.length ?? 0) > 0 ? org.restaurant_photos : []).length > 0 ? (
                  <RestaurantPhotoCarousel
                    photos={((ds.restaurant_photos?.length ?? 0) > 0 ? ds.restaurant_photos : (org.restaurant_photos?.length ?? 0) > 0 ? org.restaurant_photos : []) as string[]}
                    name={org.name}
                    accent={highlightColor}
                  />
                ) : (
                  org.restaurant_image_url && (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={org.restaurant_image_url}
                        alt={`${org.name} restaurant`}
                        className="rounded-2xl shadow-2xl w-full h-80 object-cover"
                      />
                    </div>
                  )
                )}
              </div>
            </div>
          </section>
        )}

        {/* Paragraphs */}
        {(paraRows?.length ?? 0) > 0 && (
          <>
            {paraRows?.map((para) => {
              const td = para.title_design ?? { fontFamily: "'Inter', sans-serif", fontSize: 24, color: textColor, textAlign: "left" as const };
              const cd = para.content_design ?? { fontFamily: "'Inter', sans-serif", fontSize: 16, color: textColor, textAlign: "left" as const };
              const isTextLeft = para.image_position === "text-left";
              return (
                <section
                  key={para.id}
                  className="py-12 px-4 relative z-10"
                >
                  <div className="max-w-6xl mx-auto">
                    <div className={`grid md:grid-cols-2 gap-12 items-start ${isTextLeft ? "" : "md:flex-row-reverse"}`}>
                      {/* Text side */}
                      <div>
                        {para.title && (
                          <h2
                            className="mb-4"
                            style={{
                              fontFamily: td.fontFamily,
                              fontSize: td.fontSize,
                              color: td.color,
                              textAlign: td.textAlign as any,
                            }}
                          >
                            {para.title}
                          </h2>
                        )}
                        {para.content && (
                          <p
                            className="leading-relaxed whitespace-pre-line"
                            style={{
                              fontFamily: cd.fontFamily,
                              fontSize: cd.fontSize,
                              color: cd.color,
                              textAlign: cd.textAlign as any,
                            }}
                          >
                            {para.content}
                          </p>
                        )}
                      </div>
                      {/* Image side */}
                      {para.image_url && (
                        <div className={isTextLeft ? "" : "order-first md:order-last"}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={para.image_url}
                            alt={para.title ?? ""}
                            className="rounded-2xl shadow-2xl w-full h-72 object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </>
        )}

        {/* Location & Contact Section */}
        <section className="py-16 px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <h2 className="tc-loc-head mb-8">
              {org.contact_heading || "Location & Contact"}
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Locations - shows org.location (newline-separated) then branches */}
              {((org.location && org.location.trim()) || (org.branches && org.branches.length > 0)) && (
                <div className="rounded-xl p-6 shadow-md border-2" style={{
                  borderColor: `${highlightColor}44`
                }}>
                  <h3 className="font-semibold text-lg mb-4">Locations</h3>
                  <ul className="tc-loc-body space-y-2">
                    {(() => {
                      const locs: string[] = [];
                      // Priority: location column (from design panel) takes precedence
                      if (org.location && org.location.trim()) {
                        locs.push(...org.location.split("\n").filter(Boolean));
                      } else if (org.branches && org.branches.length > 0) {
                        locs.push(...(org.branches as string[]));
                      }
                      // Deduplicate while preserving order
                      return [...new Set(locs)].map((loc, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1" style={{ color: highlightColor }}>•</span>
                          <span>{loc}</span>
                        </li>
                      ));
                    })()}
                  </ul>
                </div>
              )}

              {/* Contact Info */}
              {(org.contact_phone || org.contact_email || org.contact_address) && (
                <div className="rounded-xl p-6 shadow-md border-2" style={{
                  borderColor: `${highlightColor}44`
                }}>
                  <h3 className="font-semibold text-lg mb-4">Contact Us</h3>
                  <div className="space-y-3 tc-loc-body">
                    {org.contact_phone && (
                      <div className="flex items-start gap-3">
                        <span className="font-medium min-w-20">Phone:</span>
                        <a href={`tel:${org.contact_phone}`} className="hover:underline">
                          {org.contact_phone}
                        </a>
                      </div>
                    )}
                    {org.contact_email && (
                      <div className="flex items-start gap-3">
                        <span className="font-medium min-w-20">Email:</span>
                        <a href={`mailto:${org.contact_email}`} className="hover:underline">
                          {org.contact_email}
                        </a>
                      </div>
                    )}
                    {org.contact_address && (
                      <div className="flex items-start gap-3">
                        <span className="font-medium min-w-20">Address:</span>
                        <span>{org.contact_address}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Fallback if no location/contact data */}
            {(!org.branches || org.branches.length === 0) &&
             !org.contact_phone && !org.contact_email &&
             !org.contact_address && (
              <div className="text-center py-8" style={{ color: `${textColor}66` }}>
                <p>Location and contact information coming soon.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
