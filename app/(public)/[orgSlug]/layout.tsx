import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/org";
import { hydrateSettings } from "@/lib/design";
import { withBuiltSiteGuards, withLiveMenu, type LiveMenuItem } from "@/lib/built-site";
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
  if (!orgSlug || !/^[a-z0-9-]{1,80}$/i.test(orgSlug)) {
    notFound();
  }
  // DB failures throw OrgFetchError -> nearest error.tsx shows retry UI.
  // Only a genuine missing row returns null -> 404.
  const org = await getOrgBySlug(orgSlug);

  if (!org) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSONB row, loosely typed by supabase
  const design = hydrateSettings(org.design_settings as Record<string, any> | null | undefined);

  // AI-built standalone site: it is a complete page (own header/footer/chatbot),
  // so render it bare — no Tablecraft frame, footer, or second chatbot.
  // The menu const is swapped for live DB rows (console edits reflect instantly
  // and cart checkout posts real UUIDs the server accepts).
  if (design.built_html) {
    let liveHtml = design.built_html;
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { data: rows } = await createAdminClient()
        .from("menu_items")
        .select("id, name, price, category, description")
        .eq("org_id", org.id)
        .eq("available", true)
        // Console sequence: category groups first, then item order (NULLS LAST
        // so hand-added rows never float above numbered ones).
        .order("category_sort_order", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });
      liveHtml = withLiveMenu(
        liveHtml,
        ((rows ?? []) as LiveMenuItem[]).filter((r) => r && typeof r.id === "string"),
      );
    } catch {
      // Fall back to the baked-in const.
    }
    return (
      <div className="min-h-screen bg-black">
        <iframe
          title={`${org.name} website`}
          srcDoc={withBuiltSiteGuards(liveHtml)}
          sandbox="allow-scripts allow-forms allow-same-origin"
          className="block h-[100dvh] w-full border-0"
        />
      </div>
    );
  }

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
        responsive={design.responsive}
      />
    </div>
  );
}