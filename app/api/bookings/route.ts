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
/**
 * Find the best subset of available tables to seat partySize guests.
 * Always picks the option with minimum total capacity (least waste).
 * Single table is only chosen when its waste is strictly less than any combo.
 * Returns null when no valid combination exists.
 */
function findBestCombination(
  tables: Array<{ id: string; capacity: number; label: string }>,
  partySize: number,
): Array<{ id: string; capacity: number; label: string }> | null {
  // Tables big enough on their own
  const largeEnough = tables.filter((t) => t.capacity >= partySize);
  // Tables that must be combined
  const small = tables.filter((t) => t.capacity < partySize);

  // Best single-table fit (least waste)
  let bestSingle: typeof largeEnough[number] | null = null;
  if (largeEnough.length > 0) {
    bestSingle = largeEnough.reduce((a, b) =>
      a.capacity < b.capacity ? a : b,
    );
  }

  // Enumerate all subsets of small tables (2^N — restaurants have <20 tables)
  let bestCombo: typeof small | null = null;
  let bestComboCapacity = Infinity;

  for (let mask = 1; mask < (1 << small.length); mask++) {
    let total = 0;
    const subset: typeof small = [];
    for (let i = 0; i < small.length; i++) {
      if (mask & (1 << i)) {
        total += small[i].capacity;
        subset.push(small[i]);
      }
    }
    if (total >= partySize && total < bestComboCapacity) {
      bestComboCapacity = total;
      bestCombo = subset;
    }
  }

  // Pick whichever has less total capacity (less waste).
  // Only prefer single table when it's strictly better.
  if (bestCombo && (!bestSingle || bestComboCapacity < bestSingle.capacity)) {
    return bestCombo;
  }
  return bestSingle ? [bestSingle] : bestCombo;
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

  // Fetch ALL open/reserved tables for this org (not just large-enough ones).
  // Combination logic below may need small tables to reach the target size.
  const { data: orgTables, error: tablesError } = await admin
    .from("tables")
    .select("id, label, status, capacity")
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

  // 2-hour reservation window calculation:
  // Any booking with status IN ('confirmed', 'pending') overlapping [when - 2hr, when + 2hr] conflicts.
  // Check both bookings.table_id (legacy) and booking_tables.table_id (junction).
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

  const bookedTableIds = new Set<string>();
  for (const b of conflictingBookings ?? []) {
    bookedTableIds.add(b.table_id);
  }
  // Also check booking_tables junction for multi-table bookings
  if (bookedTableIds.size === 0) {
    const { data: jtBookings } = await admin
      .from("booking_tables")
      .select("table_id")
      .eq("org_id", org.id);
    for (const row of jtBookings ?? []) bookedTableIds.add(row.table_id);
  } else {
    const { data: jtBookings } = await admin
      .from("booking_tables")
      .select("table_id")
      .eq("org_id", org.id)
      .in("booking_id", (conflictingBookings ?? []).map((b) => b.id));
    for (const row of jtBookings ?? []) bookedTableIds.add(row.table_id);
  }

  // Determine which tables are free for this 2-hour window.
  // Note: if booking is for the immediate current time window (e.g. within 2 hrs from now),
  // we also verify table.status !== 'occupied'.
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

  // Convert available tables to the shape expected by findBestCombination
  const comboTables = availableTables.map((t) => ({
    id: t.id,
    capacity: t.capacity,
    label: t.label,
  }));

  // If a specific tableId was passed and is available, use it directly
  if (tableId) {
    const matched = comboTables.find((t) => t.id === tableId);
    if (matched) {
      // --- Create the booking with the single explicit table ---
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

  // --- Explicit tableIds path (operator console manual booking) ---
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

    // Insert ALL tables into junction (trigger already inserted primary — upsert handles conflict)
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

  // Auto-select: try combination logic first, fall back to single-table best fit
  const selectedCombination = findBestCombination(comboTables, partySize);

  if (!selectedCombination || selectedCombination.length === 0) {
    return NextResponse.json(
      { error: `No tables available for ${partySize} guests.` },
      { status: 400 },
    );
  }

  const primaryTable = selectedCombination[0];

  // --- Create the booking (primary table becomes table_id, inserted via trigger) ---
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

  // Insert remaining tables into booking_tables junction (trigger already inserted primary)
  if (selectedCombination.length > 1) {
    const otherIds = selectedCombination.slice(1).map((t) => t.id);
    await admin
      .from("booking_tables")
      .insert(otherIds.map((tid) => ({
        org_id: org.id,
        booking_id: booking.id,
        table_id: tid,
        is_primary: false,
      })));
  }

  // Mark ALL tables in the combination as reserved for immediate bookings
  if (isImmediate) {
    const ids = selectedCombination.map((t) => t.id);
    await admin.from("tables").update({ status: "reserved" }).in("id", ids);
  }

  return NextResponse.json(
    {
      booking,
      table: { id: primaryTable.id, label: primaryTable.label, capacity: primaryTable.capacity },
      tables: selectedCombination.map((t) => ({
        id: t.id,
        label: t.label,
        capacity: t.capacity,
      })),
    },
    { status: 201 },
  );
}