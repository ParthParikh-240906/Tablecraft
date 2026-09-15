import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveStaffRow, getOrgBySlug } from "@/lib/org";
import { LogoutButton } from "./logout-button";

/**
 * Console layout: resolves the logged-in staff member's organization.
 * Auth gating happens in middleware.ts; this adds the staff check.
 *
 * Multi-restaurant support:
 *   - Reads the `selected_org` cookie (set by middleware when ?org=<id> is present).
 *   - If the user has multiple restaurants and no selection is active,
 *     redirects to /console/select so they can choose.
 */
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/console/login");
  }

  // Read ?org= from the request URL so each tab can independently select
  // its org, even when the shared cookie has a stale value from another tab.
  // We read it from the Referer header (set by the previous navigation)
  // since server components don't have direct access to the current URL.
  const { headers: getHeaders } = await import("next/headers");
  const headerList = await getHeaders();
  const referer = headerList.get("referer") || "";
  let urlOrgParam: string | null = null;
  try {
    const url = new URL(referer);
    urlOrgParam = url.searchParams.get("org");
  } catch {}

  let resolvedOrgId: string | undefined;
  if (urlOrgParam) {
    // Check if it's a UUID (org id) or a slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(urlOrgParam);
    if (isUUID) {
      resolvedOrgId = urlOrgParam;
    } else {
      const org = await getOrgBySlug(urlOrgParam);
      resolvedOrgId = org?.id;
    }
  }

  const result = await getActiveStaffRow(user.id, resolvedOrgId);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--paper)] text-[var(--ink)]">
        <div className="max-w-md text-center ticket p-8">
          <h1 className="font-display text-xl mb-2">Not a staff member</h1>
          <p className="text-sm text-[var(--ink-soft)] mb-6">
            This account ({user.email}) isn't linked to a restaurant
            staff role. Ask the restaurant owner to add you.
          </p>
          <Link href="/" className="btn btn-outline text-xs">
            ← Back to Tablecraft
          </Link>
        </div>
      </div>
    );
  }

  // If user has multiple restaurants and no selection is persisted,
  // redirect them to the org selector page.
  if (result.isMultiOrg) {
    redirect("/console/select");
  }

  const { staff: staffRow } = result;
  const org = Array.isArray(staffRow.organizations)
    ? staffRow.organizations[0]
    : staffRow.organizations;

  // Build the ?org= param to attach to every internal link so the
  // selected_org cookie stays in sync when navigating between pages.
  const orgParam = staffRow.org_id ? `?org=${staffRow.org_id}` : "";

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--rule)] bg-[var(--paper)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="label-caps text-[color:var(--accent)]">
              Operator Console
            </p>
            <p className="font-display text-lg text-[var(--ink)]">{org?.name ?? "Restaurant"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <nav className="flex items-center gap-3">
              <Link href={`/console${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Dashboard
              </Link>
              <Link href={`/console/tables${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Tables
              </Link>
              <Link href={`/console/bookings${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Bookings
              </Link>
              <Link href={`/console/orders${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Orders
              </Link>
              <Link href={`/console/kitchen${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Kitchen
              </Link>
              <Link href={`/console/menu${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Menu
              </Link>
              <Link href={`/console/design${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Design
              </Link>
              <span className="text-[var(--rule)]">|</span>
              {org?.slug && (
                <Link href={`/${org.slug}`} className="text-[var(--accent)] hover:underline font-medium">
                  Public Storefront →
                </Link>
              )}
            </nav>
            <div className="flex items-center gap-3 border-l border-[var(--rule)] pl-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--ink-faint)] hidden sm:inline">{staffRow.email}</span>
                <span className="px-2 py-0.5 rounded-sm border border-[var(--rule)] text-[10px] font-medium uppercase tracking-wider text-[var(--ink-soft)]">
                  {staffRow.role}
                </span>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>
      <div className="bg-[#161311] border border-white/20 max-w-5xl mx-auto mt-8 mb-12 rounded-sm">
        <main className="px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
