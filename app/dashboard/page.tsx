import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LABELS } from "@/lib/pricing";
import { MARKETING_PLANS } from "@/lib/marketing-plans";
import { SignOutButton } from "./sign-out-button";
import { DeleteRestaurantButton } from "./delete-restaurant-button";

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

  // Per-org stats (menu items + tables counts) via admin client (server-side only)
  const orgStats: Record<string, { menuItems: number; tables: number }> = {};

  await Promise.all(
    orgs.map(async (org) => {
      const [menuRes, tablesRes] = await Promise.all([
        admin.from("menu_items").select("id", { count: "exact", head: true }).eq("org_id", org.id),
        admin.from("tables").select("id", { count: "exact", head: true }).eq("org_id", org.id),
      ]);
      orgStats[org.id] = {
        menuItems: menuRes.count ?? 0,
        tables: tablesRes.count ?? 0,
      };
    }),
  );

  const totalMenuItems = Object.values(orgStats).reduce((s, v) => s + v.menuItems, 0);
  const totalTables = Object.values(orgStats).reduce((s, v) => s + v.tables, 0);
  const hasRestaurants = orgs.length > 0;

  const planBadge = (plan: string | null) => {
    switch (plan) {
      case "pro": return "bg-orange-900/40 text-orange-300";
      case "max": return "bg-purple-900/40 text-purple-300";
      default: return "bg-[var(--paper-raised)] text-[var(--ink-faint)]";
    }
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-[var(--rule)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl tracking-tight">
              Welcome, {displayName}
            </h1>
            <p className="text-sm text-[var(--ink-soft)] mt-0.5">{user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="#pricing" className="btn btn-outline text-xs">
              Pricing
            </a>
            <Link href="/how-it-works" className="btn btn-outline-accent text-xs">
              How it works
            </Link>
            <Link href="/" className="btn btn-outline text-xs">
              ← Marketing site
            </Link>
            <SignOutButton className="btn btn-outline text-xs" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-12">

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
                <span className="text-center w-[5.5rem]">View Site</span>
                <span className="text-center w-[4.5rem]">Console</span>
                <span className="text-center w-[3.5rem]">Plan</span>
                <span className="text-center w-[3.5rem]">Delete</span>
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

                    <Link href={`/${org.slug}`} className="btn btn-outline text-xs py-1 justify-self-center w-[5.5rem] text-center">
                      View site
                    </Link>
                    <Link href="/console" className="btn btn-accent text-xs py-1 justify-self-center w-[4.5rem] text-center">
                      Console
                    </Link>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm text-center w-[3.5rem] ${planBadge(org.subscription_plan)}`}>
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

        {/* ─── AI-Powered Tools ─────────────────────────────────────────────── */}
        <section>
          <h2 className="font-display text-lg mb-4">AI-Powered Tools</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: "💬", title: "AI Booking Chatbot", desc: "Guests chat naturally to book tables. The AI handles dates, party sizes, and availability." },
              { icon: "📸", title: "AI Menu Scanner", desc: "Snap a photo of your printed menu. Our OCR extracts dishes, allergens, and prices instantly." },
              { icon: "✨", title: "AI Content Generator", desc: "Generate website paragraphs, taglines, and descriptions from a short description of your restaurant." },
              { icon: "🎨", title: "AI Image Generator", desc: "Create dish shots, interiors, and hero images from a text prompt — no photographer needed." },
            ].map((tool) => (
              <div key={tool.title} className="ticket p-5">
                <span className="text-2xl mb-2 block">{tool.icon}</span>
                <p className="text-sm font-semibold mb-1">{tool.title}</p>
                <p className="text-xs text-[var(--ink-soft)] leading-relaxed">{tool.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Getting Started Checklist ────────────────────────────────────── */}
        {hasRestaurants && (
          <section>
            <h2 className="font-display text-lg mb-4">Getting Started</h2>
            <div className="ticket p-5 space-y-3">
              {[
                { label: "Create a restaurant", done: true },
                { label: "Add menu items", done: totalMenuItems > 0 },
                { label: "Set up tables", done: totalTables > 0 },
                { label: "Design your website", done: false },
                { label: "Upgrade to Pro or Max", done: orgs.some((o) => o.subscription_plan && o.subscription_plan !== "free") },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    item.done
                      ? "bg-green-900/40 text-green-400"
                      : "bg-[var(--paper-raised)] text-[var(--ink-faint)] border border-[var(--rule)]"
                  }`}>
                    {item.done ? "✓" : ""}
                  </span>
                  <span className={`text-sm ${item.done ? "text-[var(--ink-faint)] line-through" : "text-[var(--ink)]"}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Pricing (same as marketing page) ─────────────────────────────── */}
        <section id="pricing">
          <h2 className="font-display text-lg mb-1">Pricing</h2>
          <p className="text-sm text-[var(--ink-soft)] mb-6">Upgrade when you&apos;re ready to go live.</p>

          <div className="grid md:grid-cols-3 gap-4">
            {MARKETING_PLANS.map((plan) => (
              <div
                key={plan.name}
                className={[
                  "ticket p-6 sm:p-8 flex flex-col",
                  plan.highlighted ? "ring-2 ring-[var(--accent)] shadow-xl" : "",
                ].filter(Boolean).join(" ")}
              >
                {plan.highlighted && (
                  <p className="label-caps text-xs mb-3" style={{ color: "var(--accent)" }}>Most popular</p>
                )}

                <p className="label-caps text-xs mb-1 text-[var(--ink-soft)]">{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-display text-4xl text-[var(--ink)]">{plan.price}</span>
                  <span className="text-sm text-[var(--ink-faint)]">AED</span>
                </div>
                <p className="text-xs text-[var(--ink-faint)] mb-4">{plan.period}</p>
                <p className="text-sm text-[var(--ink-soft)] leading-relaxed mb-6 flex-grow">{plan.description}</p>

                <ul className="space-y-2 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaLink}
                  className={[
                    "btn w-full text-center",
                    plan.planKey ? "btn-accent" : "btn-outline-accent",
                  ].join(" ")}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}