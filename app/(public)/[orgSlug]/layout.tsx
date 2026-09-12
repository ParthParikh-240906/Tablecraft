import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/org";
import { hydrateSettings } from "@/lib/design";
import { CartProvider } from "@/lib/cart";
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

  return (
    <CartProvider orgSlug={org.slug}>
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
        orgName={org.name}
        slug={org.slug}
        logoUrl={org.logo_url}
        accent={highlightColor}
        textColor={textColor}
        headerBg={design.header.background_color}
        headerOpacity={design.header.opacity}
        headerDesign={design.header.design}
      />

      <main className="flex-1">{children}</main>

<footer className="border-t border-[var(--rule)] py-6 text-center text-sm text-[var(--ink-faint)]">
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

      <BookingChatbot orgSlug={org.slug} orgName={org.name} accent={highlightColor} />
    </div>
    </CartProvider>
  );
}