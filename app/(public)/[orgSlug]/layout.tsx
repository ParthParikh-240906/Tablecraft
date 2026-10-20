import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/org";
import { hydrateSettings } from "@/lib/design";
import { withBuiltSiteGuards, withLiveGallery, withLiveHero, withLiveHeroMobile, withLiveMenu, type LiveMenuItem } from "@/lib/built-site";
import { BookingChatbot } from "@/components/BookingChatbot";
import { PublicSiteFrame } from "@/components/PublicSiteFrame";
import { SessionHeartbeat } from "@/components/SessionHeartbeat";
import { getCapacityPlan, isFreeGated } from "@/lib/capacity";

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

  const headerList = await headers();
  const isCustomDomain = headerList.get("x-tc-custom-domain") === "1";
  const basePath = isCustomDomain ? "" : `/${org.slug}`;
  // Read the plan directly instead of trusting a forwarded header, so a
  // long-lived Free page still renews its lease via the heartbeat.
  const capacityGated = !isCustomDomain && isFreeGated(await getCapacityPlan(org.id));

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
    // Heroes stay live (creation hero uploads); gallery stays live without a rebuild.
    // Each hero const feeds its own breakpoint (desktop/tablet vs mobile) and
    // empty = CSS-art hero. Hero and gallery are separate sources, except when
    // no gallery photos exist: the hero becomes the single fallback tile so a
    // hero-only restaurant never shows an all-placeholder gallery.
    const liveHeroUrl =
      typeof (org as { background_image_url?: unknown }).background_image_url === "string"
        ? ((org as { background_image_url: string }).background_image_url as string)
        : null;
    const liveMobileHeroUrl =
      typeof (org as { mobile_background_image_url?: unknown }).mobile_background_image_url === "string"
        ? ((org as { mobile_background_image_url: string }).mobile_background_image_url as string)
        : null;
    const livePhotos = Array.isArray((org as { restaurant_photos?: unknown }).restaurant_photos)
      ? ((org as { restaurant_photos: unknown[] }).restaurant_photos.filter(
          (u): u is string => typeof u === "string",
        ) as string[])
      : [];

    liveHtml = withLiveHero(liveHtml, liveHeroUrl);
    liveHtml = withLiveHeroMobile(liveHtml, liveMobileHeroUrl);
    liveHtml = withLiveGallery(
      liveHtml,
      livePhotos.length > 0 ? livePhotos : liveHeroUrl ? [liveHeroUrl] : [],
    );
    return (
      <div className="min-h-screen bg-black">
        <iframe
          title={`${org.name} website`}
          srcDoc={withBuiltSiteGuards(liveHtml)}
          sandbox="allow-scripts allow-forms allow-same-origin"
          className="block h-[100dvh] w-full border-0"
        />
        <SessionHeartbeat kind="site" orgSlug={org.slug} enabled={capacityGated} />
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
        basePath={basePath}
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
  {isCustomDomain ? (
    <span>
      {org.name}
      {" · "}
      <Link href={`${basePath}/menu`} className="hover:underline">
        Menu
      </Link>
      <span className="mx-2">·</span>
      <Link href={`${basePath}/reserve`} className="hover:underline">
        Book a table
      </Link>
    </span>
  ) : (
    <>
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
    </>
  )}
</footer>

      <BookingChatbot
        orgSlug={org.slug}
        basePath={basePath}
        orgName={org.name}
        accent={highlightColor}
        chatbot={design.chatbot}
        responsive={design.responsive}
      />

      <SessionHeartbeat kind="site" orgSlug={org.slug} enabled={capacityGated} />
    </div>
  );
}