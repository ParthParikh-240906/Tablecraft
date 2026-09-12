import { notFound } from "next/navigation";
import { getOrgBySlug, getParagraphsByOrg } from "@/lib/org";
import { buildDefaultContentElements, hydrateSettings, type DesignSettingsV2 } from "@/lib/design";
import { GOOGLE_FONTS_CSS, OrgPageView } from "@/components/OrgPageView";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

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

  const capitalizeWords = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

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

  const paragraphs = (await getParagraphsByOrg(org.id)) ?? [];
  const design: DesignSettingsV2 = hydrateSettings(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSONB row, loosely typed by supabase
    org.design_settings as Record<string, any> | null | undefined,
  );

  // Existing orgs with no saved content layout: seed positioned blocks from
  // about text, photos, paragraphs, and location/contact (same as the console).
  if (design.content.elements.length === 0) {
    design.content.elements = buildDefaultContentElements({
      about_title: org.about_title ?? null,
      about_text: org.about_text ?? null,
      contact_heading: org.contact_heading ?? null,
      location: org.location ?? null,
      contact_phone: org.contact_phone ?? null,
      contact_email: org.contact_email ?? null,
      contact_address: org.contact_address ?? null,
      restaurant_photos: (org.restaurant_photos as string[]) ?? [],
      paragraphs,
    });
  }

  const hasSavedDesign = Boolean(org.design_settings);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={GOOGLE_FONTS_CSS} />

      <OrgPageView
        mode="site"
        slug={org.slug}
        org={{
          name: org.name,
          tagline: org.tagline,
          logo_url: org.logo_url,
          about_title: org.about_title,
          about_text: org.about_text,
          contact_heading: org.contact_heading,
          location: org.location,
          contact_phone: org.contact_phone,
          contact_email: org.contact_email,
          contact_address: org.contact_address,
          restaurant_photos: (org.restaurant_photos as string[] | null) ?? [],
        }}
        settings={design}
        paragraphs={paragraphs}
        colors={{
          bg: hasSavedDesign ? design.background_color : (org.theme_color ?? "#141414"),
          text: hasSavedDesign ? design.text_color : (org.theme_text_color ?? "#f5f5f4"),
          accent: hasSavedDesign ? design.accent_color : (org.theme_secondary_color ?? "#f97316"),
        }}
        previewHeight={640}
      />
    </>
  );
}