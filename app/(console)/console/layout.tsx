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
import { FullscreenToggle } from "./fullscreen-toggle";
import { ConsoleCapacityNotice } from "./console-capacity-notice";
import { SessionHeartbeat } from "@/components/SessionHeartbeat";
import { acquireConsoleSlot, getCapacityPlan, isFreeGated } from "@/lib/capacity";
import { getStockStatus } from "@/lib/inventory";
import { InventoryAlertToast } from "./inventory-alert-toast";

// Force per-request rendering so the header/sidebar reflect the current ?org=
// param. Without this, the layout is cached as part of the App Shell and
// ignores searchParams changes (Next.js 16 limitation).
export const dynamic = "force-dynamic";

/**
 * Console layout: resolves the logged-in staff member's organization.
 * Auth gating happens in proxy.ts; this adds the staff check.
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
    .select("org_id, role, organizations(id, name, slug, logo_url, theme_color, subscription_plan, subscription_status)")
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

  // Free-plan combined capacity: website leases are acquired in proxy.ts;
  // console leases are acquired here because this layout already resolved the
  // active org and staff member. Resolve the ORG OWNER's plan (not the current
  // staff member's owned orgs) so a waiter on a Pro restaurant is not gated.
  const capacityPlan = await getCapacityPlan(activeOrgId);
  const capacityGated = isFreeGated(capacityPlan);

  // Inventory alerts are optional: if migration 0040 has not been applied yet,
  // these queries return errors and the console still renders normally.
  let inventoryCounts = { unread: 0, low: 0, out: 0 };
  try {
    const [{ data: notifications }, { data: inventoryRows }] = await Promise.all([
      supabase
        .from("inventory_notifications")
        .select("id")
        .eq("org_id", activeOrgId)
        .is("cleared_at", null)
        .eq("status", "unread")
        .limit(100),
      supabase
        .from("inventory_items")
        .select("quantity_on_hand, par_level, low_stock_percent, track_stock, archived")
        .eq("org_id", activeOrgId)
        .eq("archived", false)
        .eq("track_stock", true),
    ]);

    inventoryCounts.unread = notifications?.length ?? 0;
    for (const item of inventoryRows ?? []) {
      const status = getStockStatus(item as {
        quantity_on_hand: number;
        par_level: number | null;
        low_stock_percent: number;
        track_stock: boolean;
        archived: boolean;
      });
      if (status === "low") inventoryCounts.low++;
      if (status === "out") inventoryCounts.out++;
    }
  } catch {
    // Inventory tables are not set up yet.
  }

  if (capacityGated) {
    const headerList = await headers();
    const slot = await acquireConsoleSlot({
      orgId: activeOrgId,
      authUserId: user.id,
      userAgent: headerList.get("user-agent"),
    });
    if (!slot.allowed) {
      return (
        <ConsoleThemeWrapper>
          <ConsoleCapacityNotice orgId={activeOrgId} />
        </ConsoleThemeWrapper>
      );
    }
  }

  return (
    <ConsoleThemeWrapper>
      {capacityGated && (
        <SessionHeartbeat kind="console" orgId={activeOrgId} enabled />
      )}
      <InventoryAlertToast orgId={activeOrgId} initialUnread={inventoryCounts.unread} />
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
              notificationCount={inventoryCounts.unread}
              lowStockCount={inventoryCounts.low + inventoryCounts.out}
            />
            <div className="flex items-center gap-3 border-l border-[var(--rule)] pl-4">
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
              lowStockCount={inventoryCounts.low + inventoryCounts.out}
              notificationCount={inventoryCounts.unread}
            />
          )}
          <div className="ticket flex-1 w-full rounded-sm border border-[var(--rule)] bg-[var(--paper-raised)] overflow-hidden">
            <div className="hidden md:flex justify-end px-4 sm:px-6 pt-4">
              <FullscreenToggle />
            </div>
            <main className="px-4 sm:px-6 py-6">{children}</main>
          </div>
        </div>
      </div>

      <ConsoleSidebarOverlay />
    </ConsoleThemeWrapper>
  );
}
