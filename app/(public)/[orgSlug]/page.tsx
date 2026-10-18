import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getOrgAndParagraphs } from "@/lib/org";
import { buildDefaultContentElements, hydrateSettings, type DesignSettingsV2 } from "@/lib/design";
import { OrgPageView } from "@/components/OrgPageView";
import { getPrimaryDomainHost } from "@/lib/site-url";
import type { Metadata } from "next";

// Revalidate every 60s so repeated visits hit the cache instead of a cold Supabase fetch
export const revalidate = 60;

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  if (!orgSlug || !/^[a-z0-9-]{1,80}$/i.test(orgSlug)) {
    return { title: "Restaurant Not Found" };
  }
  const { org } = await getOrgAndParagraphs(orgSlug);

  if (!org) {
    return { title: "Restaurant Not Found" };
  }

  const capitalizeWords = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  const headerList = await headers();
  const isCustomDomain = headerList.get("x-tc-custom-domain") === "1";
  const canonicalHost = isCustomDomain
    ? headerList.get("x-tc-canonical-host") || headerList.get("x-tc-request-host")
    : await getPrimaryDomainHost(org.id);
  const canonical = canonicalHost ? `https://${canonicalHost}` : undefined;

  return {
    // On a customer domain, do not append the platform's "| Tablecraft" template.
    title: isCustomDomain ? { absolute: org.name } : org.name,
    description: org.tagline || `${capitalizeWords(org.name)} - Browse our menu, book a table, and order ahead.`,
    ...(canonical
      ? {
          metadataBase: new URL(canonical),
          alternates: { canonical },
          openGraph: { url: canonical, title: org.name },
        }
      : {}),
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OrgLandingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  if (!orgSlug || !/^[a-z0-9-]{1,80}$/i.test(orgSlug)) {
    notFound();
  }
  const { org, paragraphs } = await getOrgAndParagraphs(orgSlug);

  if (!org) {
    notFound();
  }
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
  const pageHeaders = await headers();
  const basePath = pageHeaders.get("x-tc-custom-domain") === "1" ? "" : `/${org.slug}`;

  // Note: when design.built_html exists, the layout above serves the built
  // standalone site bare (no frame/footer/chatbot) — this renderer is the
  // fallback for settings-driven sites only.
  return (
    <>
      <OrgPageView
        mode="site"
        slug={org.slug}
        basePath={basePath}
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