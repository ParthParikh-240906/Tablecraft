"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderRecord } from "./orders/orders-list";
import { ConsoleOrdersSection } from "./console-orders-section";
import { BookingActionsList } from "./bookings/booking-actions";
import { TableGrid } from "./tables/table-grid";

interface TableInfo {
  id: string;
  label: string;
  status: string;
  capacity?: number;
  table_type?: string;
}

interface BookingInfo {
  id: string;
  customer_name: string;
  party_size: number;
  datetime: string;
  status: string;
  table_id?: string;
}

interface DashboardStats {
  totalTables: number;
  availableTables: number;
  totalAvailableSeats: number;
  bookedToday: number;
  liveOrderCount: number;
}

interface DashboardClientProps {
  orgId: string;
  orgName: string;
  todayDate: string;
  initialTables: TableInfo[];
  initialBookings: BookingInfo[];
  initialOrders: OrderRecord[];
  tableLabelMap: Record<string, string>;
}

export default function DashboardClient({
  orgId,
  orgName,
  todayDate,
  initialTables,
  initialBookings,
  initialOrders,
  tableLabelMap,
}: DashboardClientProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<DashboardStats>(() => calculateStats(
    initialTables,
    initialBookings,
    initialOrders,
  ));
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [todayDateStr, setTodayDateStr] = useState(todayDate);

  // ── Recalculate stats from current tables & bookings ──
  function calculateStats(
    tables: TableInfo[],
    bookings: BookingInfo[],
    orders: OrderRecord[],
  ): DashboardStats {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const twoHoursFromNow = now.getTime() + 2 * 60 * 60 * 1000;

    // Booked tables today (non-cancelled, within today range)
    const bookedToday = bookings.filter((b) => {
      if (b.status === "cancelled") return false;
      const dt = new Date(b.datetime).getTime();
      return dt >= todayStart.getTime() && dt < tomorrowStart.getTime();
    }).length;

    // Available tables: status=open AND not in upcoming booking (next 2h)
    const bookedTableIds = new Set<string>();
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const bookingTime = new Date(b.datetime).getTime();
      if (bookingTime >= now.getTime() && bookingTime <= twoHoursFromNow) {
        if (b.table_id) bookedTableIds.add(b.table_id);
      }
    }

    const availableTables = tables.filter(
      (t) => t.status === "open" && !bookedTableIds.has(t.id),
    ).length;
    const totalAvailableSeats = tables
      .filter((t) => t.status === "open" && !bookedTableIds.has(t.id))
      .reduce((s, t) => s + (t.capacity ?? 0), 0);

    return {
      totalTables: tables.length,
      availableTables,
      totalAvailableSeats,
      bookedToday,
      liveOrderCount: orders.length,
    };
  }

  const refreshAll = useCallback(async () => {
    // Refresh tables
    const { data: tables } = await supabase
      .from("tables")
      .select("id, label, status, capacity, table_type")
      .eq("org_id", orgId);

    // Refresh today's bookings
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, customer_name, party_size, datetime, status, table_id")
      .eq("org_id", orgId)
      .gte("datetime", todayStart.toISOString())
      .lt("datetime", tomorrowStart.toISOString())
      .neq("status", "cancelled");

    // Refresh live orders
    const { data: orderData } = await supabase
      .from("orders")
      .select("id, customer_name, total, status, created_at, stripe_session_id, items")
      .eq("org_id", orgId)
      .not("status", "eq", "paid")
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: false });

    const freshTables = (tables ?? []) as TableInfo[];
    const freshBookings = (bookings ?? []) as BookingInfo[];
    const freshOrders = (orderData ?? []) as OrderRecord[];

    setOrders(freshOrders);
    setStats(calculateStats(freshTables, freshBookings, freshOrders));
  }, [orgId, supabase]);

  // ── Realtime subscriptions ──
  useEffect(() => {
    const bookingsChannel = supabase
      .channel(`dashboard-bookings-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `org_id=eq.${orgId}` },
        refreshAll,
      )
      .subscribe();

    const tablesChannel = supabase
      .channel(`dashboard-tables-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables", filter: `org_id=eq.${orgId}` },
        refreshAll,
      )
      .subscribe();

    const ordersChannel = supabase
      .channel(`dashboard-orders-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `org_id=eq.${orgId}` },
        (payload) => {
          const row = payload.new as OrderRecord | null;
          if (!row) return;
          setOrders((prev) => {
            // Remove completed/paid/cancelled orders from dashboard view
            if (row.status === "paid" || row.status === "cancelled" || row.status === "completed") {
              return prev.filter((o) => o.id !== row.id);
            }
            const exists = prev.some((o) => o.id === row.id);
            if (exists) {
              return prev.map((o) => (o.id === row.id ? row : o));
            }
            return [...prev, row].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [orgId, supabase, refreshAll]);

  // ── Rebuild today bookinigs data for BookingActionsList ──
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const todayUpcoming = (stats as any).bookedToday > 0
    ? initialBookings.filter((b) => {
        const dt = new Date(b.datetime).getTime();
        return dt >= now.getTime() && dt < tomorrowStart.getTime();
      })
    : [];
  const todayPast = initialBookings.filter((b) => {
    const dt = new Date(b.datetime).getTime();
    return dt < now.getTime();
  });

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-[var(--ink)]">
          {orgName}&apos;s Dashboard
        </h1>
        <p className="text-xs text-[var(--ink-soft)] mt-0.5">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Tables" value={String(stats.totalTables)} sub={`${stats.availableTables} available`} />
        <StatCard label="Booked Today" value={String(stats.bookedToday)} sub="reservations" />
        <StatCard label="Order Count" value={String(stats.liveOrderCount)} sub="live orders" />
        <StatCard
          label="Available Now"
          value={String(stats.availableTables)}
          sub={stats.totalAvailableSeats > 0 ? `${stats.totalAvailableSeats} seats` : "no seats"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Today&apos;s Bookings ── */}
        <div>
          <h2 className="label-caps text-[var(--ink-faint)] mb-3">Today&apos;s Bookings</h2>
          <BookingActionsList
            orgId={orgId}
            initialBookings={todayUpcoming as any}
            pastBookings={todayPast as any}
            tables={initialTables.map((t) => ({
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
          initialOrders={orders}
        />
      </div>

      {/* ── Tables ── */}
      <div className="mt-8">
        <TableGrid orgId={orgId} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="ticket p-4 bg-[var(--paper-raised)] border border-[var(--rule)] rounded-sm">
      <p className="label-caps text-[var(--ink-faint)] mb-1">{label}</p>
      <p className="font-display text-2xl text-[var(--ink)]">{value}</p>
      <p className="text-xs text-[var(--ink-soft)] mt-0.5">{sub}</p>
    </div>
  );
}
