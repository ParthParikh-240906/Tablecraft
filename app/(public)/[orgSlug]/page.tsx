import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/org";

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

  const accent = org.theme_color ?? "#f97316";

  return (
    <div>
      {/* Hero */}
      <section
        className="py-20 px-4 text-center"
        style={{
          background: `linear-gradient(180deg, ${accent}14 0%, transparent 100%)`,
        }}
      >
        <div className="max-w-3xl mx-auto">
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.logo_url}
              alt={`${org.name} logo`}
              className="h-20 w-20 rounded-full object-cover mx-auto mb-6"
            />
          ) : (
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6"
              style={{ backgroundColor: accent }}
            >
              {org.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Welcome to {org.name}
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Browse our menu, book a table, and order ahead — all in one place.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href={`/${org.slug}/menu`}
              className="px-6 py-3 rounded-full text-white font-medium"
              style={{ backgroundColor: accent }}
            >
              View Menu
            </Link>
            <Link
              href={`/${org.slug}/reserve`}
              className="px-6 py-3 rounded-full border-2 font-medium"
              style={{ borderColor: accent, color: accent }}
            >
              Book a Table
            </Link>
          </div>
        </div>
      </section>

      {/* Quick info */}
      <section className="max-w-5xl mx-auto px-4 py-12 grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border p-6">
          <h2 className="font-semibold mb-2">Fresh Menu</h2>
          <p className="text-sm text-gray-600">
            Explore our seasonal dishes and drinks, updated daily.
          </p>
        </div>
        <div className="rounded-2xl border p-6">
          <h2 className="font-semibold mb-2">Easy Reservations</h2>
          <p className="text-sm text-gray-600">
            Book a table in seconds and we'll have it ready for you.
          </p>
        </div>
        <div className="rounded-2xl border p-6">
          <h2 className="font-semibold mb-2">Order Ahead</h2>
          <p className="text-sm text-gray-600">
            Add to your cart and pay securely at checkout.
          </p>
        </div>
      </section>
    </div>
  );
}