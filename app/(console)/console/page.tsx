import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/org";
import DashboardClient from "./dashboard-client";

/**
 * Dashboard landing page for the operator console.
 * Server component fetches initial data, then hands off to a client component
 * that subscribes to realtime changes for books, tables, and orders.
 */

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/console/login");

  // Read selected org from URL param first, then header (set by middleware),
  // then cookie, falling back to the default active org.
  const urlOrgParam = params.org || null;
  const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  let orgId: string | null = null;
  if (urlOrgParam && isUUID(urlOrgParam)) {
    orgId = urlOrgParam;
  }
  if (!orgId) {
    const { headers: getHeaders } = await import("next/headers");
    const headerList = await getHeaders();
    const headerOrg = headerList.get("x-console-selected-org") || null;
    if (headerOrg && isUUID(headerOrg)) orgId = headerOrg;
  }
  if (!orgId) {
    const { cookies: getCookieStore } = await import("next/headers");
    const cookieStore = await getCookieStore();
    const cookieOrg = cookieStore.get("selected_org")?.value || null;
    if (cookieOrg && isUUID(cookieOrg)) orgId = cookieOrg;
  }
  if (!orgId) {
    orgId = (await getActiveOrgId(user.id, urlOrgParam ?? undefined)) ?? "";
  }
  const orgName = orgId ? "Restaurant" : "";

  // --- "Today" in local time (matches existing app convention) ---
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  // --- Fetch all data for initial render ---
  const [
    { data: tablesData },
    { data: bookingsData },
    { data: ordersData },
    { data: bookingTablesData },
  ] = await Promise.all([
    supabase.from("tables").select("id, label, status, capacity, table_type").eq("org_id", orgId),
    supabase
      .from("bookings")
      .select("id, customer_name, party_size, datetime, status, table_id")
      .eq("org_id", orgId)
      .order("datetime", { ascending: true }),
    supabase
      .from("orders")
      .select("id, customer_name, total, status, created_at, stripe_session_id, items")
      .eq("org_id", orgId)
      .not("status", "eq", "paid")
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: false }),
    supabase
      .from("booking_tables")
      .select("booking_id, table_id, is_primary, tables(id, label)")
      .eq("org_id", orgId),
  ]);

  const allTables = (tablesData ?? []) as { id: string; label: string; status: string; capacity?: number; table_type?: string }[];

  // Build table label map for junction table fallback
  const tableLabelMap: Record<string, string> = {};
  for (const t of allTables) tableLabelMap[t.id] = t.label;

  // Merge junction tables into each booking
  const tablesByBooking = new Map<string, { id: string; label: string }[]>();
  if (bookingTablesData) {
    for (const row of bookingTablesData as any[]) {
      if (!tablesByBooking.has(row.booking_id)) {
        tablesByBooking.set(row.booking_id, []);
      }
      tablesByBooking.get(row.booking_id)!.push({
        id: row.table_id,
        label: row.tables?.label ?? tableLabelMap[row.table_id] ?? "",
      });
    }
  }

  const bookingsWithTables = ((bookingsData ?? []) as any[]).map((b) => {
    const jTables = tablesByBooking.get(b.id);
    return {
      ...b,
      tables: jTables && jTables.length > 0 ? jTables : [
        { id: b.table_id ?? "", label: tableLabelMap[b.table_id ?? ""] ?? "" },
      ],
    };
  });

  // Filter for today's upcoming and past
  const todayBookings = bookingsWithTables.filter((b: any) => {
    const dt = new Date(b.datetime).getTime();
    return dt >= todayStart.getTime() && dt < tomorrowStart.getTime();
  });

  const todayUpcoming = todayBookings.filter((b: any) => new Date(b.datetime) >= now);
  const todayPast = todayBookings.filter((b: any) => new Date(b.datetime) < now);

  const todayDateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <DashboardClient
      key={orgId}
      orgId={orgId}
      orgName={orgName}
      todayDate={todayDateStr}
      initialTables={allTables}
      initialBookings={todayUpcoming as any}
      initialOrders={(ordersData ?? []) as any}
      tableLabelMap={tableLabelMap}
    />
  );
}
