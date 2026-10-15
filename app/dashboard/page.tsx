import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LABELS, displayPlan } from "@/lib/pricing";
import { resolveOwnerPlan } from "@/lib/owner-quotas";
import { SignOutButton } from "./sign-out-button";
import { ViewSiteLink } from "@/components/ViewSiteLink";
import { DeleteRestaurantButton } from "./delete-restaurant-button";
import { DashboardPricingSection } from "./pricing-section";

/**
 * Post-sign-in dashboard.
 * Lists the user's restaurants, a getting-started checklist, and pricing.
 * Styled to match the marketing page: white field, black ink, orange accent.
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("dashboard: getUser failed", userError);
    throw new Error("Could not load your account — please check your connection and try again.");
  }

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
  const { data: staffRows, error: staffError } = await admin
    .from("staff_users")
    .select("org_id, role, organizations(id, name, slug, logo_url, theme_color, tagline, subscription_plan, subscription_status)")
    .eq("auth_user_id", user.id);

  if (staffError) {
    console.error("dashboard: staff lookup failed", staffError);
    throw new Error("Could not load your restaurants — please try again.");
  }

  // Staff-only users (have a staff row but no owner row) must use the console.
  // Brand-new accounts with no staff rows at all stay on the dashboard.
  const isOwner = (staffRows ?? []).some((r: any) => r.role === 'owner');
  if ((staffRows ?? []).length > 0 && !isOwner) {
    redirect("/console");
  }

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

  // Owner-wide plan: ONE plan covers ALL restaurants the owner holds.
  // Previously each row rendered its own subscription_plan (per-restaurant
  // billing), so a stale fan-out left 1 row on Max and 2 on Free even though
  // /console/pricing (ownerPlan) showed Max everywhere. Now every badge uses
  // the aggregated owner plan.
  const ownedRows = (staffRows ?? []).filter((r: any) => r.role === "owner");
  const planSource = ownedRows.length > 0 ? ownedRows : (staffRows ?? []);
  const ownerPlan = resolveOwnerPlan(
    planSource.map((r: any) => {
      const o = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
      return displayPlan(o?.subscription_plan, o?.subscription_status ?? null);
    }),
  );

  const hasRestaurants = orgs.length > 0;
  const firstOrgId = orgs[0]?.id ?? null;
  const withOrg = (href: string) =>
    href.startsWith("/console/") && firstOrgId ? `${href}?org=${firstOrgId}` : href;

  const planBadge = (plan: string | null) => {
    switch (plan) {
      case "pro": return "bg-[#d45200] text-white";
      case "max": return "bg-neutral-950 text-white";
      default: return "bg-white text-neutral-700";
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12)]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-display text-[22px] tracking-tight text-neutral-950">
            Tablecraft
          </Link>
          <div className="flex items-center gap-1">
            <a
              href="#pricing"
              className="relative hidden sm:inline-block text-[15px] font-medium px-4 py-2.5 text-neutral-600 hover:text-neutral-950 transition-colors after:content-[''] after:absolute after:left-4 after:right-4 after:bottom-1.5 after:h-px after:bg-[#d45200] after:origin-left after:scale-x-0 after:transition-transform after:duration-300 hover:after:scale-x-100"
            >
              Pricing
            </a>
            <Link
              href="/"
              className="relative hidden sm:inline-block text-[15px] font-medium px-4 py-2.5 text-neutral-600 hover:text-neutral-950 transition-colors after:content-[''] after:absolute after:left-4 after:right-4 after:bottom-1.5 after:h-px after:bg-[#d45200] after:origin-left after:scale-x-0 after:transition-transform after:duration-300 hover:after:scale-x-100"
            >
              Marketing site
            </Link>
            <SignOutButton className="text-[15px] font-semibold px-5 py-2.5 rounded-full bg-[#d45200] text-white hover:bg-[#b54600] transition-colors disabled:opacity-50" />
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-6xl mx-auto px-6 pt-12 pb-24 space-y-20">
        {/* ─── Welcome ──────────────────────────────────────────────────────── */}
        <section>
          <h1 className="font-display text-[32px] sm:text-[41.6px] leading-[1.02] tracking-[-0.03em] text-neutral-950">
            Welcome back, {displayName}.
          </h1>
          <p className="text-[17px] text-neutral-500 mt-4">{user.email}</p>
        </section>

        {/* ─── My Restaurants ───────────────────────────────────────────────── */}
        <section aria-labelledby="restaurants-heading">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h2 id="restaurants-heading" className="font-display text-[30px] leading-tight tracking-[-0.02em]">
              My restaurants
            </h2>
            <Link
              href="/restaurants/create"
              className="bg-[#d45200] text-white text-[13.6px] font-semibold px-[22px] py-[13px] rounded-full hover:bg-[#b54600] transition-colors"
            >
              Create restaurant
            </Link>
          </div>

          {hasRestaurants ? (
            <div className="overflow-x-auto rounded-3xl bg-neutral-100 border border-black p-2 sm:p-3">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                    <th scope="col" className="px-4 py-3 w-16">SR</th>
                    <th scope="col" className="px-4 py-3">Table name</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org, index) => {
                    // Owner-wide: every restaurant shares the owner's plan.
                    const rowPlan = ownerPlan;
                    return (
                      <tr key={org.id} className="bg-white">
                        <td className="px-4 py-4 text-[15px] font-medium text-neutral-500 rounded-l-2xl border-y border-l border-transparent">
                          {index + 1}
                        </td>
                        <td className="px-4 py-4 border-y border-transparent">
                          <div className="flex items-center gap-4 min-w-0">
                            {org.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={org.logo_url}
                                alt={org.name}
                                className="w-12 h-12 rounded-full object-cover bg-white shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-[#d45200] text-white flex items-center justify-center font-bold text-base shrink-0">
                                {org.name?.[0]?.toUpperCase() ?? "R"}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-display text-[20px] leading-tight truncate">{org.name}</p>
                              <p className="text-[14px] text-neutral-500 truncate">{org.tagline || org.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 border-y border-transparent">
                          <span className={`inline-flex items-center text-[13px] font-semibold px-3.5 py-2 rounded-full ${planBadge(rowPlan)}`}>
                            {PLAN_LABELS[rowPlan] ?? "Free"}
                          </span>
                        </td>
                        <td className="px-4 py-4 rounded-r-2xl border-y border-r border-transparent">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <ViewSiteLink
                              href={`/${org.slug}`}
                              className="inline-flex items-center text-[14px] font-semibold px-4 py-2.5 rounded-full bg-neutral-100 text-neutral-950 hover:bg-neutral-200 transition-colors"
                              ariaLabel={`View ${org.name} site`}
                            >
                              View site
                            </ViewSiteLink>
                            <Link
                              href={`/console?org=${org.id}`}
                              className="inline-flex items-center text-[14px] font-semibold px-4 py-2.5 rounded-full bg-neutral-950 text-white hover:bg-neutral-800 transition-colors"
                            >
                              Console
                            </Link>
                            <DeleteRestaurantButton orgId={org.id} orgName={org.name} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-3xl bg-neutral-100 p-10 text-center">
              <p className="font-display text-[26px] leading-tight mb-3">No restaurants yet.</p>
              <p className="text-[16px] text-neutral-600 mb-7">Create your first restaurant and design its website in minutes.</p>
              <Link
                href="/restaurants/create"
                className="inline-block bg-[#d45200] text-white text-[16px] font-semibold px-7 py-4 rounded-full hover:bg-[#b54600] transition-colors"
              >
                Create your first restaurant
              </Link>
            </div>
          )}
        </section>

        {/* ─── Getting Started ──────────────────────────────────────────────── */}
        <section aria-labelledby="started-heading">
          <h2 id="started-heading" className="font-display text-[30px] leading-tight tracking-[-0.02em] mb-6">
            Getting started
          </h2>
          <div className="rounded-3xl bg-neutral-100 border border-black p-4 sm:p-6 space-y-2">
            {[
              { label: "Create a restaurant", href: "/restaurants/create" },
              { label: "Design website", href: withOrg("/console/design") },
              { label: "Add menu items", href: withOrg("/console/menu") },
              { label: "Set up tables", href: withOrg("/console/tables") },
              { label: "Make payment and go live", href: withOrg("/console/pricing") },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex items-center justify-between gap-4 rounded-2xl bg-white border border-black px-5 py-4 hover:bg-neutral-950 transition-colors"
              >
                <span className="text-[16px] font-medium text-neutral-950 group-hover:text-white transition-colors">
                  {item.label}
                </span>
                <span aria-hidden="true" className="text-[18px] text-[#d45200]">→</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── Pricing ──────────────────────────────────────────────────────── */}
        <DashboardPricingSection />
      </main>
    </div>
  );
}
