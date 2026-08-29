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
export async function POST(request: Request) {
  let body: {
    orgSlug?: string;
    tableId?: string;
    customerName?: string;
    partySize?: number;
    datetime?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { orgSlug, tableId, customerName, partySize, datetime } = body;

  // --- Validate required fields ---
  if (!orgSlug || typeof orgSlug !== "string") {
    return NextResponse.json({ error: "orgSlug is required" }, { status: 400 });
  }
  if (!customerName || typeof customerName !== "string" || customerName.trim().length < 2) {
    return NextResponse.json({ error: "customerName must be at least 2 characters" }, { status: 400 });
  }
  if (typeof partySize !== "number" || !Number.isInteger(partySize) || partySize < 1 || partySize > 20) {
    return NextResponse.json({ error: "partySize must be an integer between 1 and 20" }, { status: 400 });
  }
  const when = new Date(datetime ?? "");
  if (Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: "datetime must be a valid ISO date" }, { status: 400 });
  }
  if (when.getTime() < Date.now() - 60000) {
    return NextResponse.json({ error: "Booking date & time cannot be in the past" }, { status: 400 });
  }

  const admin = createAdminClient();

  // --- Resolve org by slug ---
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (orgError) {
    console.error("bookings: org lookup failed", orgError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Fetch all tables for this org that have enough capacity for the party
  const { data: orgTables, error: tablesError } = await admin
    .from("tables")
    .select("id, label, status, capacity")
    .eq("org_id", org.id)
    .gte("capacity", partySize)
    .order("capacity", { ascending: true });

  if (tablesError) {
    console.error("bookings: tables lookup failed", tablesError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  if (!orgTables || orgTables.length === 0) {
    return NextResponse.json(
      { error: `No tables available with capacity for ${partySize} guests.` },
      { status: 400 }
    );
  }

  // 2-hour reservation window calculation:
  // Any booking with status IN ('confirmed', 'pending') overlapping [when - 2hr, when + 2hr] conflicts with that table.
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const windowStart = new Date(when.getTime() - TWO_HOURS_MS).toISOString();
  const windowEnd = new Date(when.getTime() + TWO_HOURS_MS).toISOString();

  const { data: conflictingBookings, error: bookingsError } = await admin
    .from("bookings")
    .select("table_id, datetime")
    .eq("org_id", org.id)
    .in("status", ["confirmed", "pending"])
    .gt("datetime", windowStart)
    .lt("datetime", windowEnd);

  if (bookingsError) {
    console.error("bookings: conflict lookup failed", bookingsError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const bookedTableIds = new Set((conflictingBookings || []).map((b) => b.table_id));

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

  // If a specific tableId was passed and is available, use it; otherwise auto-select the best fit
  // (already ordered by ascending capacity for least empty seats)
  let selectedTable = availableTables[0];
  if (tableId) {
    const matched = availableTables.find((t) => t.id === tableId);
    if (matched) {
      selectedTable = matched;
    }
  }

  // --- Create the booking ---
  const { data: booking, error: insertError } = await admin
    .from("bookings")
    .insert({
      org_id: org.id,
      table_id: selectedTable.id,
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

  // If the booking is immediate (starts within 2 hours), update the table live status to 'reserved'
  if (isImmediate) {
    await admin
      .from("tables")
      .update({ status: "reserved" })
      .eq("id", selectedTable.id);
  }

  return NextResponse.json(
    {
      booking,
      table: { id: selectedTable.id, label: selectedTable.label, capacity: selectedTable.capacity },
    },
    { status: 201 }
  );
}