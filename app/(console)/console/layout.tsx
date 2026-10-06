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
import type { SidebarOrgItem } from "./sidebar";
import { MobileMenuButton } from "./mobile-menu-button";
import { ConsoleSidebarOverlay } from "./console-sidebar-overlay";
import { DemoModeProvider } from "./demo-mode-provider";

const DEMO_EMAIL = "demo@tablecraft.app";

// Force per-request rendering so the header/sidebar reflect the current ?org=
// param. Without this, the layout is cached as part of the App Shell and
// ignores searchParams changes (Next.js 16 limitation).
export const dynamic = "force-dynamic";

/**
 * Console layout: resolves the logged-in staff member's organization.
 * Auth gating happens in middleware.ts; this adds the staff check.
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
          <h1 className="font-display text-xl mb-2">No restaurant linked</h1>
          <p className="text-sm text-[var(--ink-soft)] mb-6">
            This account ({user.email}) isn&apos;t linked to a restaurant yet.
            Create one to get started.
          </p>
          <div className="flex flex-col items-center gap-2">
            <Link href="/restaurants/create" className="btn btn-accent text-xs">
              Create your restaurant
            </Link>
            <Link href="/dashboard" className="btn btn-outline text-xs">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

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

  const activeOrgId = resolvedOrgId || staffRow.org_id;
  const org = userOrgs.find((o) => o?.id === activeOrgId) || userOrgs[0] || null;
  const orgParam = activeOrgId ? `?org=${activeOrgId}` : "";

  // Check if this is a demo session
  const isDemoOrg = staffRow.email === DEMO_EMAIL;

  return (
    <ConsoleThemeWrapper>
      {isDemoOrg && <DemoModeProvider isDemo={isDemoOrg} orgId={activeOrgId} orgSlug={org?.slug ?? ""} />}
      <header className="border-b border-[var(--rule)] bg-[var(--paper-raised)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MobileMenuButton />
            <div>
              <p className="label-caps text-[color:var(--accent)]">
                Operator Console
              </p>
              <p className="font-display text-lg text-[var(--ink)]">
                <HeaderOrg
                  userOrgs={userOrgs.filter((o): o is NonNullable<typeof o> => !!o).map((o) => ({ id: o.id, name: o.name, slug: o.slug }))}
                  fallback={org?.name ?? "Restaurant"}
                />
              </p>
            </div>
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
                  isDemoOrg
                    ? 'border-yellow-500/40 text-yellow-600 bg-yellow-50'
                    : staffRow.role === 'owner'
                    ? 'border-[var(--accent-border)] text-[var(--accent)] bg-[var(--accent-subtle)]'
                    : 'border-[var(--rule)] text-[var(--ink-soft)]'
                }`}>
                  {isDemoOrg ? 'DEMO' : staffRow.role}
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
              staffEmail={staffRow.email ?? ""}
              staffRole={staffRow.role}
              userOrgs={userOrgs as any}
              activeOrgId={activeOrgId}
              isDemo={isDemoOrg}
            />
          )}
          <div className="ticket flex-1 w-full rounded-sm border border-[var(--rule)] bg-[var(--paper-raised)] overflow-hidden">
            <main className="px-4 sm:px-6 py-6">{children}</main>
          </div>
        </div>
      </div>

      <ConsoleSidebarOverlay />
    </ConsoleThemeWrapper>
  );
}
