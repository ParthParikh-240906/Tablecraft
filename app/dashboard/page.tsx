import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LABELS } from "@/lib/pricing";
import { SignOutButton } from "./sign-out-button";
import { DeleteRestaurantButton } from "./delete-restaurant-button";
import { DashboardPricingSection } from "./pricing-section";

/**
 * Post-sign-in dashboard.
 * Lists the user's restaurants in row format, AI tools, getting-started
 * checklist, and marketing pricing at the bottom.
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?next=/dashboard");
  }

  const rawName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "there";
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  // Use admin client for staff_users queries: the original RLS policy
  // scopes to f_current_org_id() which returns only ONE org, so a user
  // who owns multiple restaurants can't see all of them via RLS alone.
  // The admin client bypasses RLS while the query still filters by auth_user_id.
  const admin = createAdminClient();

  // Fetch all staff rows for this auth user (may have multiple orgs)
  const { data: staffRows } = await admin
    .from("staff_users")
    .select("org_id, role, organizations(id, name, slug, logo_url, theme_color, tagline, subscription_plan, subscription_status)")
    .eq("auth_user_id", user.id);

  interface OrgInfo {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    theme_color: string | null;
    tagline: string | null;
    subscription_plan: string | null;
    subscription_status: string | null;
  }

  const orgs: OrgInfo[] = (staffRows ?? [])
    .map((r: any) => Array.isArray(r.organizations) ? r.organizations[0] : r.organizations)
    .filter(Boolean);

  const hasRestaurants = orgs.length > 0;

  const planBadge = (plan: string | null) => {
    switch (plan) {
      case "pro": return "bg-orange-900/40 text-orange-300";
      case "max": return "bg-purple-900/40 text-purple-300";
      default: return "bg-[var(--paper-raised)] text-white";
    }
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <a href="#main-content" className="skip-link">Skip to content</a>
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl tracking-tight">
              Welcome, {displayName}
            </h1>
            <p className="text-sm text-[var(--ink-soft)] mt-0.5">{user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="#pricing" className="btn btn-outline-strong text-xs">
              Pricing
            </a>
            <Link href="/setup-guide" className="btn btn-outline-accent text-xs">
              Setup guide
            </Link>
            <Link href="/" className="btn btn-outline-strong text-xs">
              ← Marketing site
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="layer2-bg border-2 border-white/50 mx-8 md:mx-16 mt-8 mb-12 rounded-sm">
        <div className="relative max-w-6xl mx-auto">
          <main id="main-content" className="px-4 sm:px-6 py-10 space-y-12">

        {/* ─── My Restaurants (row table) ───────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg">My Restaurants</h2>
            <Link href="/signup" className="btn btn-accent text-xs">
              + Create restaurant
            </Link>
          </div>

          {hasRestaurants ? (
            <div>
              {/* Header row */}
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-3 px-2 pb-2 text-[11px] uppercase tracking-wider text-[var(--ink-faint)] border-b border-[var(--rule)]">
                <span>SR</span>
                <span>Restaurant</span>
                <span className="text-center w-[4.5rem]">View Site</span>
                <span className="text-center w-[4.5rem]">Console</span>
                <span className="text-center w-[4.5rem]">Plan</span>
                <span className="text-center w-[4.5rem]">Delete</span>
              </div>

              {/* Org rows — horizontal lines only */}
              {orgs.map((org, i) => {
                return (
                  <div
                    key={org.id}
                    className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-3 px-2 py-3 border-b border-[var(--rule)]"
                  >
                    <span className="text-xs text-[var(--ink-faint)]">{i + 1}</span>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{org.name}</p>
                      <p className="text-xs text-[var(--ink-faint)]">
                        /{org.slug}
                      </p>
                    </div>

                    <Link
                      href={`/${org.slug}`}
                      className="inline-flex items-center justify-center text-xs font-semibold h-8 w-[4.5rem] rounded-sm border border-[var(--rule)] text-[var(--ink)] hover:bg-[var(--paper-raised)]"
                    >
                      View site
                    </Link>
                    <Link
                      href="/console"
                      className="inline-flex items-center justify-center text-xs font-semibold h-8 w-[4.5rem] rounded-sm bg-[var(--accent)] text-white hover:opacity-90"
                    >
                      Console
                    </Link>
                    <span className={`inline-flex items-center justify-center text-xs font-semibold h-8 w-[4.5rem] rounded-sm ${planBadge(org.subscription_plan)}`}>
                      {PLAN_LABELS[(org.subscription_plan ?? "free") as keyof typeof PLAN_LABELS] ?? "Free"}
                    </span>
                    <DeleteRestaurantButton orgId={org.id} orgName={org.name} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ticket p-10 text-center">
              <p className="text-[var(--ink-soft)] mb-4">You haven&apos;t created a restaurant yet.</p>
              <Link href="/signup" className="btn btn-accent text-sm">
                Create your first restaurant →
              </Link>
            </div>
          )}
        </section>

        {/* ─── Getting Started Checklist ────────────────────────────────────── */}
        {hasRestaurants && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-display text-lg">Getting Started</h2>
              <Link href="/setup-guide" className="btn btn-outline-strong text-[10px] px-2.5 py-1">
                Setup guide
              </Link>
            </div>
            <div className="ticket p-5 space-y-2">
              {[
                { label: "Create a restaurant" },
                { label: "Design Website" },
                { label: "Add menu items" },
                { label: "Set up tables" },
                { label: "Make payment - Go live" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-sm text-[var(--accent)] shrink-0">•</span>
                  <span className="text-sm text-[var(--ink)]">{item.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Pricing (marketing-style cards) ──────────────────────────────── */}
        <DashboardPricingSection />
      </main>
        </div>
      </div>
    </div>
  );
}