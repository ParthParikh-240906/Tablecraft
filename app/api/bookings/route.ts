import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/bookings
 * Public write path for table reservations.
 *
 * This route deliberately uses the service-role (admin) client because the
 * public site has no auth session. RLS is bypassed here ON PURPOSE — this is
 * the single sanctioned entry point for creating bookings. All inputs are
 * validated server-side before any write.
 */

type RouteTable = {
  id: string;
  capacity: number;
  label: string;
  table_type: "movable" | "non-movable";
};

function effectiveCapacity(t: RouteTable): number {
  if (t.table_type === "movable") return 4;
  return t.capacity;
}

/**
 * Find the best available table(s) for partySize.
 *
 * Rules:
 * - non-movable: single table only (no combining), actual capacity
 * - movable: single=4 seats, pair=6 seats (max 2 combined)
 * - Compare best non-movable single vs best movable option
 * - Tie-break: prefer non-movable
 *
 * Returns null when no single-table or movable option fits.
 */
function findBestCombination(
  tables: RouteTable[],
  partySize: number,
): { ids: string[]; waste: number; type: "non-movable" | "movable" } | null {
  const movable = tables.filter((t) => t.table_type === "movable");
  const nonMovable = tables.filter((t) => t.table_type === "non-movable");

  // Best single non-movable table (no combining allowed)
  let bestNM: { ids: string[]; waste: number } | null = null;
  for (const t of nonMovable) {
    if (effectiveCapacity(t) >= partySize) {
      const waste = effectiveCapacity(t) - partySize;
      if (!bestNM || waste < bestNM.waste) {
        bestNM = { ids: [t.id], waste };
      }
    }
  }

  // Best movable option: n tables = 2n+2 seats (1→4, 2→6, 3→8, ...)
  // First n that fits is optimal — smallest n = least waste.
  let bestMv: { ids: string[]; waste: number } | null = null;
  for (let n = 1; n <= movable.length; n++) {
    const seats = 2 * n + 2;
    if (seats >= partySize) {
      bestMv = { ids: movable.slice(0, n).map((t) => t.id), waste: seats - partySize };
      break;
    }
  }

  // Non-movable wins ties
  if (bestNM && (!bestMv || bestNM.waste <= bestMv.waste)) {
    return { ...bestNM, type: "non-movable" };
  }
  if (bestMv) return { ...bestMv, type: "movable" };
  return null;
}

/**
 * Find the best combination of non-movable tables whose combined capacity
 * covers partySize. Tables are sorted by capacity descending (largest first).
 * Greedy: pick largest available tables until total capacity ≥ partySize.
 *
 * Returns the selected tables or null if total non-movable capacity is insufficient.
 */
function findNonMovableCombo(
  tables: RouteTable[],
  partySize: number,
): { ids: string[]; waste: number } | null {
  const nonMovable = tables
    .filter((t) => t.table_type === "non-movable")
    .sort((a, b) => b.capacity - a.capacity);

  let total = 0;
  const ids: string[] = [];
  for (const t of nonMovable) {
    total += t.capacity;
    ids.push(t.id);
    if (total >= partySize) {
      return { ids, waste: total - partySize };
    }
  }
  return null;
}

export async function POST(request: Request) {
  let body: {
    orgSlug?: string;
    orgId?: string;
    tableId?: string;
    tableIds?: string[];
    customerName?: string;
    partySize?: number;
    datetime?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { orgSlug, orgId, tableId, tableIds, customerName, partySize, datetime } = body;

  // --- Validate required fields ---
  if ((!orgSlug || typeof orgSlug !== "string") && !orgId) {
    return NextResponse.json({ error: "orgSlug or orgId is required" }, { status: 400 });
  }
  if (!customerName || typeof customerName !== "string" || customerName.trim().length < 2) {
    return NextResponse.json({ error: "customerName must be at least 2 characters" }, { status: 400 });
  }
  if (typeof partySize !== "number" || !Number.isInteger(partySize) || partySize < 1 || partySize > 20) {
    return NextResponse.json({ error: "partySize must be an integer between 1 and 20" }, { status: 400 });
  }
  if (tableIds && (!Array.isArray(tableIds) || tableIds.length === 0 || !tableIds.every((t) => typeof t === "string"))) {
    return NextResponse.json({ error: "tableIds must be a non-empty array of strings" }, { status: 400 });
  }
  const when = new Date(datetime ?? "");
  if (Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: "datetime must be a valid ISO date" }, { status: 400 });
  }
  if (when.getTime() < Date.now() - 60000) {
    return NextResponse.json({ error: "Booking date & time cannot be in the past" }, { status: 400 });
  }

  const admin = createAdminClient();

  // --- Resolve org by slug or id ---
  let org: { id: string } | null = null;
  let orgError: any = null;
  if (orgSlug) {
    const result = await admin.from("organizations").select("id").eq("slug", orgSlug).maybeSingle();
    org = result.data;
    orgError = result.error;
  } else {
    const result = await admin.from("organizations").select("id").eq("id", orgId!).maybeSingle();
    org = result.data;
    orgError = result.error;
  }

  if (orgError) {
    console.error("bookings: org lookup failed", orgError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Fetch ALL open/reserved tables for this org.
  const { data: orgTables, error: tablesError } = await admin
    .from("tables")
    .select("id, label, status, capacity, table_type")
    .eq("org_id", org.id)
    .order("capacity", { ascending: true });

  if (tablesError) {
    console.error("bookings: tables lookup failed", tablesError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  if (!orgTables || orgTables.length === 0) {
    return NextResponse.json(
      { error: `No tables available for ${partySize} guests.` },
      { status: 400 }
    );
  }

  // 2-hour reservation window: check for overlapping confirmed/pending bookings.
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const windowStart = new Date(when.getTime() - TWO_HOURS_MS).toISOString();
  const windowEnd = new Date(when.getTime() + TWO_HOURS_MS).toISOString();

  const { data: conflictingBookings, error: bookingsError } = await admin
    .from("bookings")
    .select("id, table_id, datetime")
    .eq("org_id", org.id)
    .in("status", ["confirmed", "pending"])
    .gt("datetime", windowStart)
    .lt("datetime", windowEnd);

  if (bookingsError) {
    console.error("bookings: conflict lookup failed", bookingsError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // Build set of table IDs occupied by conflicting bookings.
  // FIX: Always query booking_tables junction when conflicts exist — never skip it.
  const bookedTableIds = new Set<string>();
  for (const b of conflictingBookings ?? []) {
    bookedTableIds.add(b.table_id);
  }
  if ((conflictingBookings?.length ?? 0) > 0) {
    const { data: jtBookings } = await admin
      .from("booking_tables")
      .select("table_id")
      .in("booking_id", conflictingBookings.map((b) => b.id));
    for (const row of jtBookings ?? []) bookedTableIds.add(row.table_id);
  }

  // Determine which tables are free for this 2-hour window.
  // Also exclude occupied tables for immediate bookings.
  const isImmediate = Math.abs(when.getTime() - Date.now()) < TWO_HOURS_MS;

  const availableTables = orgTables.filter((t) => {
    if (bookedTableIds.has(t.id)) return false;
    if (isImmediate && t.status === "occupied") return false;
    return true;
  });

  if (availableTables.length === 0) {
    return NextResponse.json(
      {
        error:
          "All suitable tables are fully booked for this time slot (reservations are 2 hours). Please choose a different time.",
      },
      { status: 409 }
    );
  }

  // Convert available tables to the shape expected by combination logic.
  const comboTables: RouteTable[] = availableTables.map((t) => ({
    id: t.id,
    capacity: t.capacity,
    label: t.label,
    table_type: (t as any).table_type ?? "non-movable",
  }));

  // ---------------------------------------------------------------------------
  // Path 1: Explicit single tableId selected by user
  // ---------------------------------------------------------------------------
  if (tableId) {
    const matched = comboTables.find((t) => t.id === tableId);
    if (matched) {
      const { data: booking, error: insertError } = await admin
        .from("bookings")
        .insert({
          org_id: org.id,
          table_id: matched.id,
          customer_name: customerName.trim(),
          party_size: partySize,
          datetime: when.toISOString(),
          status: "confirmed",
        })
        .select()
        .single();

      if (insertError) {
        console.error("bookings: insert failed", insertError);
        return NextResponse.json({ error: "Could not create booking" }, { status: 500 });
      }

      if (isImmediate) {
        await admin.from("tables").update({ status: "reserved" }).eq("id", matched.id);
      }

      return NextResponse.json(
        {
          booking,
          table: { id: matched.id, label: matched.label, capacity: matched.capacity },
        },
        { status: 201 },
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Path 2: Explicit tableIds (operator console manual booking)
  // ---------------------------------------------------------------------------
  if (tableIds && tableIds.length > 0) {
    const allOrgTableMap = new Map(orgTables.map((t) => [t.id, t]));
    const selected = tableIds.map((id) => allOrgTableMap.get(id)).filter(Boolean) as typeof orgTables;
    if (selected.length !== tableIds.length) {
      return NextResponse.json({ error: "One or more requested tables were not found for this org." }, { status: 400 });
    }
    const primaryTable = selected[0];

    const { data: booking, error: insertError } = await admin
      .from("bookings")
      .insert({
        org_id: org.id,
        table_id: primaryTable.id,
        customer_name: customerName.trim(),
        party_size: partySize,
        datetime: when.toISOString(),
        status: "confirmed",
      })
      .select()
      .single();

    if (insertError) {
      console.error("bookings: insert failed", insertError);
      return NextResponse.json({ error: "Could not create booking" }, { status: 500 });
    }

    // Insert remaining tables into junction (trigger already inserted primary — upsert handles conflict)
    if (selected.length > 1) {
      const otherIds = selected.slice(1).map((t) => t.id);
      await admin
        .from("booking_tables")
        .upsert(
          otherIds.map((tid) => ({
            org_id: org.id,
            booking_id: booking.id,
            table_id: tid,
            is_primary: false,
          })),
          { onConflict: "booking_id,table_id" },
        );
    }

    if (isImmediate) {
      await admin.from("tables").update({ status: "reserved" }).in("id", selected.map((t) => t.id));
    }

    return NextResponse.json(
      {
        booking,
        table: { id: primaryTable.id, label: primaryTable.label, capacity: primaryTable.capacity },
        tables: selected.map((t) => ({ id: t.id, label: t.label, capacity: t.capacity })),
      },
      { status: 201 },
    );
  }

  // ---------------------------------------------------------------------------
  // Path 3: Auto-select — single-table or movable combination
  // ---------------------------------------------------------------------------
  const selection = findBestCombination(comboTables, partySize);

  if (selection) {
    const tableMap = new Map(comboTables.map((t) => [t.id, t]));
    const selected = selection.ids.map((id) => tableMap.get(id)!).filter(Boolean);
    const primaryTable = selected[0];

    const { data: booking, error: insertError } = await admin
      .from("bookings")
      .insert({
        org_id: org.id,
        table_id: primaryTable.id,
        customer_name: customerName.trim(),
        party_size: partySize,
        datetime: when.toISOString(),
        status: "confirmed",
      })
      .select()
      .single();

    if (insertError) {
      console.error("bookings: insert failed", insertError);
      return NextResponse.json({ error: "Could not create booking" }, { status: 500 });
    }

    if (selected.length > 1) {
      const otherIds = selected.slice(1).map((t) => t.id);
      await admin
        .from("booking_tables")
        .upsert(
          otherIds.map((tid) => ({
            org_id: org.id,
            booking_id: booking.id,
            table_id: tid,
            is_primary: false,
          })),
          { onConflict: "booking_id,table_id" },
        );
    }

    if (isImmediate) {
      await admin.from("tables").update({ status: "reserved" }).in("id", selected.map((t) => t.id));
    }

    return NextResponse.json(
      {
        booking,
        table: { id: primaryTable.id, label: primaryTable.label, capacity: primaryTable.capacity },
        tables: selected.map((t) => ({ id: t.id, label: t.label, capacity: t.capacity })),
      },
      { status: 201 },
    );
  }

  // ---------------------------------------------------------------------------
  // Path 4: No single table fits — check non-movable combo fallback (public storefront)
  // ---------------------------------------------------------------------------
  const combo = findNonMovableCombo(comboTables, partySize);
  if (combo) {
    const tableMap = new Map(comboTables.map((t) => [t.id, t]));
    const tables = combo.ids.map((id) => tableMap.get(id)!).filter(Boolean);
    return NextResponse.json(
      {
        needsConfirmation: true,
        message: `We currently have no single table for ${partySize} available at ${when.toLocaleString()}. Will ${tables.length} table${tables.length > 1 ? "s" : ""} of ${tables.map((t) => `${t.label} (${t.capacity} seats)`).join(" and ")} be fine for the reservation?`,
        tables: tables.map((t) => ({ id: t.id, label: t.label, capacity: t.capacity })),
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    { error: `No tables available for ${partySize} guests.` },
    { status: 400 },
  );
}
