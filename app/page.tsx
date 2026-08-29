import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, slug, theme_color, logo_url")
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <p className="text-xs uppercase tracking-widest text-orange-500 font-semibold mb-3">
            Tablecraft
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Your restaurant, online in minutes
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            A public menu, table reservations, and online ordering for your
            restaurant — no code required.
          </p>
          <Link
            href="/signup"
            className="inline-block px-6 py-3 rounded-full bg-orange-500 text-white font-medium hover:bg-orange-600"
          >
            Create your restaurant
          </Link>
        </div>
      </section>

      {/* Directory */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
          Restaurants on Tablecraft
        </h2>

        {(!orgs || orgs.length === 0) ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-gray-500">
            No restaurants yet — be the first.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {orgs.map((org) => {
              const accent = org.theme_color ?? "#f97316";
              return (
                <Link
                  key={org.id}
                  href={`/${org.slug}`}
                  className="group rounded-2xl border bg-white p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-3">
                    {org.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={org.logo_url}
                        alt={`${org.name} logo`}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: accent }}
                      >
                        {org.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="font-semibold group-hover:underline">
                      {org.name}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">/{org.slug}</p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Staff link */}
      <footer className="border-t py-6 text-center text-sm text-gray-400">
        Restaurant staff?{" "}
        <Link href="/console/login" className="underline hover:text-gray-600">
          Sign in to your console
        </Link>
      </footer>
    </div>
  );
}