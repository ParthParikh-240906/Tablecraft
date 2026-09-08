import { createClient } from "@/lib/supabase/server";
import { BookingActionsList } from "./bookings/booking-actions";
import { ConsoleOrdersSection } from "./console-orders-section";
import { TableGrid } from "./tables/table-grid";
import type { OrderRecord } from "./orders/orders-list";

/**
 * Dashboard landing page for the operator console.
 */

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id, organizations(name)")
    .eq("auth_user_id", user?.id ?? "")
    .maybeSingle();

  const orgId = staff?.org_id ?? "";
  const orgName = (staff as any)?.organizations?.name ?? "Restaurant";

  // --- "Today" in local time (matches existing app convention) ---
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  // --- Stats queries ---
  const [{ data: tablesData }, { data: bookingsTodayData }, { data: ordersTodayData }, { data: ordersData }] =
    await Promise.all([
      // Total tables (all statuses)
      supabase.from("tables").select("id, label, status, capacity, table_type").eq("org_id", orgId),

      // Booked tables today: non-cancelled bookings whose datetime falls today
      supabase
        .from("bookings")
        .select("id, customer_name, party_size, datetime, status, table_id")
        .eq("org_id", orgId)
        .gte("datetime", todayStart.toISOString())
        .lt("datetime", tomorrowStart.toISOString())
        .neq("status", "cancelled")
        .order("datetime", { ascending: true }),

      // Today's revenue: paid orders today
      supabase
        .from("orders")
        .select("total, status, created_at")
        .eq("org_id", orgId)
        .eq("status", "paid")
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", tomorrowStart.toISOString()),

      // Active orders for dashboard: exclude paid and cancelled only
      supabase
        .from("orders")
        .select("id, customer_name, total, status, created_at, stripe_session_id, items")
        .eq("org_id", orgId)
        .not("status", "eq", "paid")
        .not("status", "eq", "cancelled")
        .order("created_at", { ascending: false }),
    ]);

  const allTables = (tablesData ?? []) as { id: string; label: string; status: string; capacity?: number; table_type?: string }[];
  const totalTables = allTables.length;

  // Available tables: status=open AND not in an upcoming booking (2h window)
  const twoHoursFromNowMs = now.getTime() + 2 * 60 * 60 * 1000;
  const bookedTableIds = new Set<string>();
  for (const b of bookingsTodayData ?? []) {
    if ((b as any).status === "cancelled") continue;
    const bookingTime = new Date((b as any).datetime).getTime();
    if (bookingTime >= now.getTime() && bookingTime <= twoHoursFromNowMs) {
      bookedTableIds.add((b as any).table_id);
    }
  }
  // Also include tables from booking_tables junction (combo bookings) — within 2h window
  const { data: todayBookingIds } = await supabase
    .from("bookings")
    .select("id, datetime")
    .eq("org_id", orgId)
    .gte("datetime", todayStart.toISOString())
    .lt("datetime", tomorrowStart.toISOString());
  const todayIdsWithTime: { id: string; datetime: string }[] = todayBookingIds ?? [];
  if (todayIdsWithTime.length > 0) {
    const upcomingIds = todayIdsWithTime.filter(
      (b) => {
        const t = new Date(b.datetime).getTime();
        return t >= now.getTime() && t <= twoHoursFromNowMs;
      },
    ).map((b) => b.id);
    if (upcomingIds.length > 0) {
      const { data: bookingTablesJunction } = await supabase
        .from("booking_tables")
        .select("table_id")
        .in("booking_id", upcomingIds);
      for (const row of bookingTablesJunction ?? []) {
        bookedTableIds.add((row as any).table_id);
      }
    }
  }
  const availableTableObjs = allTables.filter(
    (t) => t.status === "open" && !bookedTableIds.has(t.id),
  );
  const availableTables = availableTableObjs.length;
  const totalAvailableSeats = availableTableObjs.reduce((s, t) => s + (t.capacity ?? 0), 0);

  const bookedTables = bookingsTodayData?.length ?? 0;

  const todayRevenue = (ordersTodayData ?? [])
    .reduce((sum, o) => sum + Number(o.total ?? 0), 0);

  // --- Today's bookings for the list (reuse BookingActionsList) ---
  const { data: bookingTablesData } = await supabase
    .from("booking_tables")
    .select("booking_id, table_id, is_primary, tables(id, label)")
    .eq("org_id", orgId);

  const tableLabelMap = new Map<string, string>();
  for (const t of allTables) tableLabelMap.set(t.id, t.label);

  const tablesByBooking = new Map<string, { id: string; label: string }[]>();
  if (bookingTablesData) {
    for (const row of bookingTablesData as any[]) {
      if (!tablesByBooking.has(row.booking_id)) {
        tablesByBooking.set(row.booking_id, []);
      }
      tablesByBooking.get(row.booking_id)!.push({
        id: row.table_id,
        label: row.tables?.label ?? tableLabelMap.get(row.table_id) ?? "",
      });
    }
  }

  const todayBookings = ((bookingsTodayData ?? []) as any[]).map((b) => {
    const jTables = tablesByBooking.get(b.id);
    return {
      ...b,
      tables: jTables && jTables.length > 0 ? jTables : [
        { id: b.table_id ?? "", label: tableLabelMap.get(b.table_id ?? "") ?? "" },
      ],
    };
  });

  const todayUpcoming = todayBookings.filter((b) => new Date(b.datetime) >= now);
  const todayPast = todayBookings.filter((b) => new Date(b.datetime) < now);

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-[var(--ink)]">
          {orgName}&apos;s Dashboard
        </h1>
        <p className="text-xs text-[var(--ink-soft)] mt-0.5">
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total Tables"
          value={String(totalTables)}
          sub={`${availableTables} available`}
        />
        <StatCard
          label="Booked Today"
          value={String(bookedTables)}
          sub="reservations"
        />
        <StatCard
          label="Today&apos;s Revenue"
          value={`AED ${todayRevenue.toFixed(2)}`}
          sub="paid orders"
        />
        <StatCard
          label="Available Now"
          value={String(availableTables)}
          sub={totalAvailableSeats > 0 ? `${totalAvailableSeats} seats` : "no seats"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Today's Bookings ── */}
        <div>
          <h2 className="label-caps text-[var(--ink-faint)] mb-3">Today&apos;s Bookings</h2>
          <BookingActionsList
            orgId={orgId}
            initialBookings={todayUpcoming as any}
            pastBookings={todayPast as any}
            tables={allTables.map((t) => ({
              id: t.id,
              label: t.label,
              capacity: t.capacity ?? 4,
              status: t.status,
              table_type: t.table_type as "movable" | "non-movable",
            }))}
          />
        </div>

        {/* ── Orders Dashboard ── */}
        <ConsoleOrdersSection
          orgId={orgId}
          initialOrders={(ordersData ?? []) as OrderRecord[]}
        />
      </div>

      {/* ── Tables ── */}
      <div className="mt-8">
        <TableGrid orgId={orgId} />
      </div>
    </div>
  );
}

// ── Sub-components ──

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="ticket p-4 bg-[var(--paper-raised)] border border-[var(--rule)] rounded-sm">
      <p className="label-caps text-[var(--ink-faint)] mb-1">{label}</p>
      <p className="font-display text-2xl text-[var(--ink)]">{value}</p>
      <p className="text-xs text-[var(--ink-soft)] mt-0.5">{sub}</p>
    </div>
  );
}
