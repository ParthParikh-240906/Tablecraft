import { headers, cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveStaffRow, getOrgBySlug, resolveOrgIdForUser } from "@/lib/org";
import { LogoutButton } from "./logout-button";
import { ConsoleThemeWrapper } from "./theme-wrapper";
import { ConsoleSidebar } from "./sidebar";
import { HeaderOrg } from "./header-org";
import { HeaderNav } from "./header-nav";

// Force per-request rendering so the header/sidebar reflect the current ?org=
// param. Without this, the layout is cached as part of the App Shell and
// ignores searchParams changes (Next.js 16 limitation).
export const dynamic = "force-dynamic";

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
  searchParams,
}: {
  children: React.ReactNode;
  searchParams?: Promise<Record<string, string>>;
}) {
  const params = await (searchParams as Promise<Record<string, string>> | undefined) ?? {};
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/console/login");
  }

  // Resolve org in priority order: URL param > middleware header > cookie > default.
  // resolveOrgIdForUser accepts either a UUID or a slug, validates ownership,
  // and returns null (fallthrough) when the value isn't authorized for this user.
  let resolvedOrgId: string | undefined;
  const urlOrgParam = params.org || null;
  if (urlOrgParam) {
    resolvedOrgId = (await resolveOrgIdForUser(user.id, urlOrgParam)) || undefined;
  }
  if (!resolvedOrgId) {
    const headerList = await headers();
    const headerOrg = headerList.get("x-console-selected-org") || null;
    resolvedOrgId = headerOrg ? (await resolveOrgIdForUser(user.id, headerOrg)) || undefined : undefined;
  }
  if (!resolvedOrgId) {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get("selected_org")?.value || null;
    resolvedOrgId = cookieVal ? (await resolveOrgIdForUser(user.id, cookieVal)) || undefined : undefined;
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
  const isOwner = staffRow.role === 'owner';

  // Fetch all orgs linked to this user for the restaurant switcher
  const admin = createAdminClient();
  const { data: allStaffRows } = await admin
    .from("staff_users")
    .select("org_id, role, organizations(id, name, slug, logo_url, theme_color)")
    .eq("auth_user_id", user.id);

  const userOrgs = (allStaffRows ?? [])
    .map((r: any) => {
      const o = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
      return o ? { id: o.id, name: o.name, slug: o.slug, logo_url: o.logo_url } : null;
    })
    .filter(Boolean);

  // Use the resolved org (from header/cookie) for nav links and header display
  const activeOrgId = resolvedOrgId || staffRow.org_id;
  const org = userOrgs.find((o) => o?.id === activeOrgId) || userOrgs[0] || null;
  const orgParam = activeOrgId ? `?org=${activeOrgId}` : "";

  return (
    <ConsoleThemeWrapper>
      <header className="border-b border-[var(--rule)] bg-[var(--paper)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="label-caps text-[color:var(--accent)]">
              Operator Console
            </p>
            <p className="font-display text-lg text-[var(--ink)]">
              <HeaderOrg
                userOrgs={userOrgs.filter((o): o is NonNullable<typeof o> => !!o).map((o) => ({ id: o.id, name: o.name }))}
                fallback={org?.name ?? "Restaurant"}
              />
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <HeaderNav
              isOwner={isOwner}
              userOrgs={userOrgs.filter((o): o is NonNullable<typeof o> => !!o)}
              fallbackSlug={org?.slug ?? ""}
            />
            <div className="flex items-center gap-3 border-l border-[var(--rule)] pl-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--ink-faint)] hidden sm:inline">{staffRow.email}</span>
                <span className={`px-2 py-0.5 rounded-sm border text-[10px] font-medium uppercase tracking-wider ${
                  staffRow.role === 'owner'
                    ? 'border-[var(--accent-border)] text-[var(--accent)] bg-[var(--accent-subtle)]'
                    : 'border-[var(--rule)] text-[var(--ink-soft)]'
                }`}>
                  {staffRow.role}
                </span>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className={`flex flex-col lg:flex-row gap-8 items-start ${isOwner ? '' : 'lg:pl-0'}`}>
          {isOwner && (
            <ConsoleSidebar
              staffEmail={staffRow.email}
              staffRole={staffRow.role}
              userOrgs={userOrgs as any}
              activeOrgId={activeOrgId}
            />
          )}
          <div className="ticket flex-1 w-full rounded-sm border border-[var(--rule)] bg-[var(--paper-raised)] overflow-hidden">
            <main className="px-4 sm:px-6 py-6">{children}</main>
          </div>
        </div>
      </div>
    </ConsoleThemeWrapper>
  );
}
