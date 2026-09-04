import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { BookingActionsList } from "./bookings/booking-actions";

/**
 * Dashboard landing page for the operator console.
 * Reuses the booking search/list component from /console/bookings for the
 * "Today's Bookings" section — no new booking UI built from scratch.
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
  const [{ data: tablesData }, { data: bookingsTodayData }, { data: ordersTodayData }, { data: ordersWeekData }, { data: bookingsUpcoming }] =
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

      // Weekly revenue: paid orders for current ISO week (Mon–Sun)
      supabase
        .from("orders")
        .select("total, created_at")
        .eq("org_id", orgId)
        .eq("status", "paid")
        .gte("created_at", getWeekStart(now).toISOString())
        .lt("created_at", getWeekEnd(now).toISOString()),

      // Upcoming confirmed bookings (within 2h) for available-table derivation
      supabase
        .from("bookings")
        .select("id, table_id, datetime")
        .eq("org_id", orgId)
        .eq("status", "confirmed")
        .gte("datetime", now.toISOString())
        .lte("datetime", twoHoursFromNow),
    ]);

  const allTables = (tablesData ?? []) as { id: string; label: string; status: string; capacity?: number; table_type?: string }[];
  const totalTables = allTables.length;

  // Available tables: status=open AND not in an upcoming booking (2h window)
  const upcomingBookingIds = new Set<string>();
  const bookedTableIds = new Set<string>();
  for (const b of bookingsUpcoming ?? []) {
    upcomingBookingIds.add(b.id);
    bookedTableIds.add(b.table_id);
  }
  if (upcomingBookingIds.size > 0) {
    const { data: jtData } = await supabase
      .from("booking_tables")
      .select("table_id")
      .in("booking_id", [...upcomingBookingIds]);
    for (const row of jtData ?? []) bookedTableIds.add(row.table_id);
  }
  const availableTableObjs = allTables.filter(
    (t) => t.status === "open" && !bookedTableIds.has(t.id),
  );
  const availableTables = availableTableObjs.length;
  const totalAvailableSeats = availableTableObjs.reduce((s, t) => s + (t.capacity ?? 0), 0);

  const bookedTables = bookingsTodayData?.length ?? 0;

  const todayRevenue = (ordersTodayData ?? [])
    .reduce((sum, o) => sum + Number(o.total ?? 0), 0);

  // --- Weekly revenue chart data ---
  const weekRows = (ordersWeekData ?? []) as { total: number; created_at: string }[];
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const dayTotals = new Array(7).fill(0);
  for (const row of weekRows) {
    const d = new Date(row.created_at);
    // Sunday=0 → shift to Mon=0..Sun=6
    const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
    dayTotals[dayIdx] += Number(row.total ?? 0);
  }
  const maxWeekTotal = Math.max(...dayTotals, 1);

  // Trend vs last week
  const lastWeekRows = (await supabase
    .from("orders")
    .select("total")
    .eq("org_id", orgId)
    .eq("status", "paid")
    .gte("created_at", getWeekStart(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).toISOString())
    .lt("created_at", getWeekStart(now).toISOString())
  ).data ?? [];
  const lastWeekTotal = lastWeekRows.reduce((s, r) => s + Number(r.total ?? 0), 0);
  const trendPct = lastWeekTotal === 0
    ? todayRevenue > 0 ? 100
    : 0
    : ((todayRevenue - lastWeekTotal) / lastWeekTotal) * 100;
  const trendArrow = trendPct > 0 ? "↑" : trendPct < 0 ? "↓" : "→";
  const trendColor = trendPct > 0 ? "text-emerald-400" : trendPct < 0 ? "text-red-400" : "text-[var(--ink-faint)]";

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
          sub={`trend ${trendArrow} ${Math.abs(trendPct).toFixed(0)}%`}
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

        {/* ── Weekly Revenue Chart ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="label-caps text-[var(--ink-faint)]">This Week&apos;s Revenue</h2>
            <span className={`text-xs font-medium ${trendColor}`}>
              {trendArrow} {Math.abs(trendPct).toFixed(0)}% vs last week
            </span>
          </div>
          <div className="ticket p-4">
            <div className="flex items-end gap-2 h-40">
              {days.map((day, i) => {
                const height = Math.round((dayTotals[i] / maxWeekTotal) * 100);
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-[var(--ink-faint)] font-mono">
                      {dayTotals[i] > 0 ? `AED ${dayTotals[i].toFixed(0)}` : ""}
                    </span>
                    <div
                      className="w-full bg-[var(--accent)] rounded-sm transition-all"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                    <span className="text-[10px] text-[var(--ink-faint)]">{day}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-[var(--rule)] mt-3 pt-2 flex justify-between text-xs text-[var(--ink-faint)]">
              <span>Mon – Sun</span>
              <span>Total: AED {dayTotals.reduce((a, b) => a + b, 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
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

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}
