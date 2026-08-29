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
  if (!tableId || typeof tableId !== "string") {
    return NextResponse.json({ error: "tableId is required" }, { status: 400 });
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

  // --- Validate the table belongs to this org and is open ---
  const { data: table, error: tableError } = await admin
    .from("tables")
    .select("id, status, capacity")
    .eq("id", tableId)
    .eq("org_id", org.id)
    .maybeSingle();

  if (tableError) {
    console.error("bookings: table lookup failed", tableError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (!table) {
    return NextResponse.json({ error: "Table not found for this organization" }, { status: 404 });
  }
  if (table.status !== "open") {
    return NextResponse.json({ error: "Table is not available" }, { status: 409 });
  }
  if (partySize > table.capacity) {
    return NextResponse.json(
      { error: `Table seats ${table.capacity} people max` },
      { status: 400 },
    );
  }

  // --- Create the booking ---
  const { data: booking, error: insertError } = await admin
    .from("bookings")
    .insert({
      org_id: org.id,
      table_id: table.id,
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

  return NextResponse.json({ booking }, { status: 201 });
}