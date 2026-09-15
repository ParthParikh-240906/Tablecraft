import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Restaurant selector page.
 * Shown when a user with multiple restaurants visits /console without ?org=.
 * Lets them pick which restaurant console to enter.
 */
export default async function SelectOrgPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/console/login");
  }

  // Use admin client to bypass RLS and fetch ALL orgs for this user
  const admin = createAdminClient();
  const { data: staffRows } = await admin
    .from("staff_users")
    .select("org_id, role, organizations(id, name, slug, logo_url, theme_color)")
    .eq("auth_user_id", user.id);

  const orgs = (staffRows ?? [])
    .map((r: any) => {
      const orgData = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
      return orgData ? { id: orgData.id, name: orgData.name, slug: orgData.slug, logo_url: orgData.logo_url, theme_color: orgData.theme_color } : null;
    })
    .filter(Boolean);

  if (orgs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--paper)] text-[var(--ink)]">
        <div className="max-w-md text-center ticket p-8">
          <h1 className="font-display text-xl mb-2">No restaurants found</h1>
          <p className="text-sm text-[var(--ink-soft)] mb-6">
            Your account isn't linked to any restaurant yet.
          </p>
          <Link href="/dashboard" className="btn btn-outline text-xs">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (orgs.length === 1) {
    // Only one restaurant — skip the selector
    redirect(`/console?org=${orgs[0]!.id}`);
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold text-[var(--ink)] mb-2">
            Select a Restaurant
          </h1>
          <p className="text-sm text-[var(--ink-faint)]">
            Choose which restaurant console you want to open.
          </p>
        </div>

        <div className="space-y-3">
          {orgs.map((org: any) => (
            <Link
              key={org.id}
              href={`/console?org=${org.id}`}
              className="block ticket p-4 hover:border-[var(--accent)] transition-colors"
              style={{ borderColor: "var(--rule)" }}
            >
              <div className="flex items-center gap-4">
                {org.logo_url ? (
                  <img
                    src={org.logo_url}
                    alt={org.name}
                    className="w-12 h-12 rounded-full object-cover bg-[var(--paper-raised)]"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[var(--paper-raised)] flex items-center justify-center text-lg font-bold text-[var(--ink-faint)]">
                    {org.name?.[0]?.toUpperCase() ?? "R"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{org.name}</p>
                  <p className="text-xs text-[var(--ink-faint)]">/{org.slug}</p>
                </div>
                <svg className="w-5 h-5 text-[var(--ink-faint)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link href="/dashboard" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink)] underline">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
