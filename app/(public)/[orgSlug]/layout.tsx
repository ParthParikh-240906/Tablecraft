import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/org";
import { CartProvider } from "@/lib/cart";

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

  const mainColor = org.theme_color ?? "#141414";
  const textColor = org.theme_text_color ?? "#f5f5f4";
  const highlightColor = org.theme_secondary_color ?? "#f97316";

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
      <header
        className="border-b"
        style={{ 
          backgroundColor: `${highlightColor}ee`,
          borderColor: `${highlightColor}33`
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/${org.slug}`} className="flex items-center gap-2">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logo_url}
                alt={`${org.name} logo`}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span
                className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm"
                style={{ backgroundColor: highlightColor, color: mainColor }}
              >
                {org.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="font-semibold text-lg">{org.name}</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href={`/${org.slug}/menu`} className="hover:underline">
              Menu
            </Link>
            <Link href={`/${org.slug}/cart`} className="hover:underline">
              Cart
            </Link>
            <Link
              href={`/${org.slug}/reserve`}
              className="px-3 py-1.5 rounded-full text-sm font-medium"
              style={{ backgroundColor: highlightColor, color: mainColor }}
            >
              Book a table
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

<footer className="border-t border-[var(--rule)] py-6 text-center text-sm text-[var(--ink-faint)]">
  <Link href="/" className="hover:underline">
    Back to Tablecraft
  </Link>
  <span className="mx-2">·</span>
  <Link href={`/console/login?org=${org.slug}`} className="hover:underline">
    Staff login
  </Link>
  <span className="mx-2">·</span>
  <span>© {new Date().getFullYear()} {org.name}</span>
</footer>
    </div>
    </CartProvider>
  );
}