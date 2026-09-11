"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Org {
  id: string;
  name: string;
  slug: string;
  theme_color: string | null;
  logo_url: string | null;
}

export default function RestaurantsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrgs = async () => {
      const res = await fetch("/api/demo-restaurants");
      const data = await res.json();
      setOrgs(data.orgs ?? []);
      setLoading(false);
    };
    fetchOrgs();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--rule)] bg-[var(--paper)]/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-sans tracking-widest uppercase font-medium text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
          >
            ← Tablecraft
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/signup"
              className="btn btn-accent text-xs"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <section className="px-4 pt-16 pb-12 text-center">
        <p className="label-caps text-[var(--accent)] mb-3">
          Directory
        </p>
        <h1 className="font-display text-4xl md:text-5xl tracking-tight mb-4 text-[var(--ink)]">
          Demo Restaurants
        </h1>
        <hr className="rule max-w-[120px] mx-auto mb-4" />
        <p className="text-[var(--ink-soft)] max-w-md mx-auto">
          Preview what Tablecraft sites look like. Sign in to see and manage your own restaurant from your dashboard.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-20">
        {loading ? (
          <div className="ticket p-10 text-center text-ink-soft">
            Loading...
          </div>
        ) : (!orgs || orgs.length === 0) ? (
          <div className="ticket p-10 text-center text-ink-soft">
            No restaurants yet. Be the first.
          </div>
        ) : (
          <div className="grid gap-px bg-[var(--rule)] border border-[var(--rule)] rounded-sm overflow-hidden sm:grid-cols-2 md:grid-cols-3">
            {orgs.map((org) => {
              const accent = org.theme_color ?? "var(--accent)";
              return (
                <Link key={org.id} href={`/${org.slug}`} className="bg-[var(--paper)] p-6 hover:bg-[var(--paper-raised)] transition-colors block">
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
                        className="h-10 w-10 rounded-sm flex items-center justify-center text-white font-bold font-display"
                        style={{ backgroundColor: accent }}
                      >
                        {org.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="font-display text-lg">{org.name}</span>
                  </div>
                  <p className="text-sm text-ink-soft">/{org.slug}</p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}