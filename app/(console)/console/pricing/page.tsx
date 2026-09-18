import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrgId } from "@/lib/org";
import { PricingClient, type OrgMetricData } from "./pricing-client";
export const dynamic = "force-dynamic";

export default async function ConsolePricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/console/login");
  }

  const activeOrgId = (await getActiveOrgId(user.id, params.org)) ?? "";
  if (!activeOrgId) {
    redirect("/console/login");
  }

  const admin = createAdminClient();

  // Fetch all staff rows for this user to discover all linked restaurants
  const { data: staffRows } = await admin
    .from("staff_users")
    .select("org_id, role, organizations(id, name, slug, logo_url, subscription_plan, stripe_customer_id, stripe_subscription_id, subscription_status)")
    .eq("auth_user_id", user.id);

  const orgMap = new Map<string, any>();
  for (const r of staffRows ?? []) {
    const o = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
    if (o && !orgMap.has(o.id)) {
      orgMap.set(o.id, {
        ...o,
        staffRole: r.role,
      });
    }
  }

  const orgs = Array.from(orgMap.values());
  const orgIds = orgs.map((o) => o.id);

  // Fetch orders (with customer_name + items for detail display), bookings, and tables
  const [{ data: allOrders }, { data: allBookings }, { data: allTables }] = await Promise.all([
    orgIds.length > 0
      ? admin
          .from("orders")
          .select("id, org_id, total, status, customer_name, created_at")
          .in("org_id", orgIds)
      : { data: [] },
    orgIds.length > 0
      ? admin
          .from("bookings")
          .select("id, org_id, status, datetime")
          .in("org_id", orgIds)
      : { data: [] },
    orgIds.length > 0
      ? admin
          .from("tables")
          .select("id, org_id, status")
          .in("org_id", orgIds)
      : { data: [] },
  ]);

  // Aggregate metrics per organization
  const orgMetrics: OrgMetricData[] = orgs.map((org) => {
    const orgOrders = (allOrders ?? []).filter((o) => o.org_id === org.id);
    const orgBookings = (allBookings ?? []).filter((b) => b.org_id === org.id && b.status !== "cancelled");
    const orgTablesList = (allTables ?? []).filter((t) => t.org_id === org.id);

    const paidOrders = orgOrders.filter((o) => o.status === "paid" || o.status === "completed");
    const totalEarningsAed = paidOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    const pendingOrders = orgOrders.filter((o) => o.status !== "paid" && o.status !== "completed" && o.status !== "cancelled");
    const pendingOrdersAed = pendingOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    const pendingOrdersCount = pendingOrders.length;

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo_url: org.logo_url ?? null,
      plan: (org.subscription_plan as "free" | "pro" | "max") || "free",
      subscription_status: org.subscription_status ?? "inactive",
      stripe_customer_id: org.stripe_customer_id ?? null,
      stripe_subscription_id: org.stripe_subscription_id ?? null,
      staffRole: org.staffRole,
      totalEarningsAed,
      totalOrdersCount: orgOrders.length,
      paidOrdersCount: paidOrders.length,
      pendingOrdersCount,
      pendingOrdersAed,
      paidOrders: paidOrders.map((o) => ({
        id: o.id,
        customer_name: o.customer_name ?? "Table Order",
        total: Number(o.total) || 0,
        status: o.status,
        created_at: o.created_at,
      })),
      totalBookingsCount: orgBookings.length,
      totalTablesCount: orgTablesList.length,
    };
  });

  return (
    <PricingClient
      activeOrgId={activeOrgId}
      userEmail={user.email ?? ""}
      orgs={orgMetrics}
    />
  );
}
