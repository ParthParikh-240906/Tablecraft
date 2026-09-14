import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/org";
import { hydrateSettings } from "@/lib/design";
import { BookingChatbot } from "@/components/BookingChatbot";
import { PublicSiteFrame } from "@/components/PublicSiteFrame";

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);

  if (!org) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSONB row, loosely typed by supabase
  const design = hydrateSettings(org.design_settings as Record<string, any> | null | undefined);

  const hasSavedDesign = Boolean(org.design_settings);
  const mainColor = hasSavedDesign ? design.background_color : (org.theme_color ?? "#141414");
  const textColor = hasSavedDesign ? design.text_color : (org.theme_text_color ?? "#f5f5f4");
  const highlightColor = hasSavedDesign ? design.accent_color : (org.theme_secondary_color ?? "#f97316");

  const orgView = {
    name: org.name,
    tagline: org.tagline ?? null,
    logo_url: org.logo_url,
    about_title: org.about_title ?? null,
    about_text: org.about_text ?? null,
    contact_heading: org.contact_heading ?? null,
    location: org.location ?? null,
    contact_phone: org.contact_phone ?? null,
    contact_email: org.contact_email ?? null,
    contact_address: org.contact_address ?? null,
    restaurant_photos: (org.restaurant_photos as string[] | null) ?? [],
  };

  return (
    <div
      data-theme="light"
      className="theme-light min-h-screen flex flex-col"
      style={{
        backgroundColor: mainColor,
        color: textColor,
        ["--accent" as string]: highlightColor,
      }}
    >
      <PublicSiteFrame
        slug={org.slug}
        org={orgView}
        settings={design}
        colors={{
          bg: mainColor,
          text: textColor,
          accent: highlightColor,
        }}
      />

      <main className="flex-1">{children}</main>

<footer
  className="border-t py-6 text-center text-sm"
  style={{ borderColor: textColor, color: textColor }}
>
  <Link href="/" className="hover:underline">
    Back to Tablecraft
  </Link>
  <span className="mx-2">·</span>
  <Link href="/dashboard" className="hover:underline">
    Back to dashboard
  </Link>
  <span className="mx-2">·</span>
  <Link href={`/console/login?org=${org.slug}`} className="hover:underline">
    Staff login
  </Link>
</footer>

      <BookingChatbot
        orgSlug={org.slug}
        orgName={org.name}
        accent={highlightColor}
        chatbot={design.chatbot}
      />
    </div>
  );
}