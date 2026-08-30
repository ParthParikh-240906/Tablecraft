"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgs();
  }, []);

  async function fetchOrgs() {
    const supabase = createClient();
    const { data } = await supabase
      .from("organizations")
      .select("id, name, slug, theme_color, logo_url")
      .order("created_at", { ascending: true });
    setOrgs(data || []);
    setLoading(false);
  }

  async function handleDelete(orgId: string, orgName: string) {
    setDeletingId(orgId);
    try {
      console.log("[DELETE] Attempting to delete org:", orgId, orgName);
      const res = await fetch(`/api/orgs/${orgId}`, { method: "DELETE" });
      console.log("[DELETE] Response status:", res.status);
      
      const data = await res.json();
      console.log("[DELETE] Response data:", data);
      
      if (!res.ok) {
        throw new Error(data.error || "Delete failed");
      }
      
      await fetchOrgs(); // Refresh the list
      setShowConfirm(null);
      alert(`Successfully deleted ${orgName}`);
    } catch (error) {
      console.error("[DELETE] Error:", error);
      alert(`Failed to delete organization: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setDeletingId(null);
    }
  }

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
          Live Restaurants
        </h1>
        <hr className="rule max-w-[120px] mx-auto mb-4" />
        <p className="text-[var(--ink-soft)] max-w-md mx-auto">
          Browse restaurants powered by Tablecraft. View real-time availability, explore menus, and reserve a seat.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-20">
        {loading ? (
          <div className="ticket p-10 text-center text-ink-soft">
            Loading...
          </div>
        ) : (!orgs || orgs.length === 0) ? (
          <div className="ticket p-10 text-center text-ink-soft">
            No restaurants yet.
          </div>
        ) : (
          <div className="grid gap-px bg-[var(--rule)] border border-[var(--rule)] rounded-sm overflow-hidden sm:grid-cols-2 md:grid-cols-3">
            {orgs.map((org) => {
              const accent = org.theme_color ?? "var(--accent)";
              return (
                  <div key={org.id} className="bg-[var(--paper)] p-6 relative group">
                    <Link
                      href={`/${org.slug}`}
                      className="block"
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

                    {/* Delete button */}
                    <button
                      onClick={() => setShowConfirm(org.id)}
                      className="absolute top-2 right-2 text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={deletingId === org.id}
                    >
                      {deletingId === org.id ? "Deleting..." : "Delete"}
                    </button>

                    {/* Confirmation modal */}
                    {showConfirm === org.id && (
                      <div className="absolute inset-0 bg-[var(--paper)] flex items-center justify-center p-4 z-10">
                        <div className="text-center">
                          <p className="text-sm font-medium mb-3">
                            Delete {org.name}?
                          </p>
                          <p className="text-xs text-ink-soft mb-4">
                            This will remove the website, console, and all data.
                          </p>
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => setShowConfirm(null)}
                              className="btn text-xs"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDelete(org.id, org.name)}
                              className="btn btn-accent text-xs"
                              disabled={deletingId === org.id}
                            >
                              {deletingId === org.id ? "Deleting..." : "Confirm"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}