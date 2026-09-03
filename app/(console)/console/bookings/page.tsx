import { createClient } from "@/lib/supabase/server";
import { BookingActionsList } from "./booking-actions";

export default async function BookingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id")
    .eq("auth_user_id", user?.id ?? "")
    .maybeSingle();

  const orgId = staff?.org_id ?? "";

  const { data: tables } = await supabase
    .from("tables")
    .select("id, label, capacity, status")
    .eq("org_id", orgId)
    .order("label", { ascending: true });

  // Build a lookup from table_id → label for fallback when junction is missing rows.
  const tableLabelMap = new Map<string, string>();
  for (const t of tables ?? []) {
    tableLabelMap.set(t.id, t.label);
  }

  // Use the FK relation (bookings.table_id → tables.id) to get the primary table label.
  // Also pull the booking_tables junction to pick up combo tables.
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, customer_name, party_size, datetime, status, table_id, tables(id, label)")
    .eq("org_id", orgId)
    .order("datetime", { ascending: true });

  const { data: bookingTables } = await supabase
    .from("booking_tables")
    .select("booking_id, table_id, is_primary, tables(id, label)")
    .eq("org_id", orgId)
    .order("is_primary", { ascending: false });

  // Build map of booking_id -> all tables (junction + primary fallback)
  const tablesByBooking = new Map<string, { id: string; label: string }[]>();
  if (bookingTables) {
    for (const row of bookingTables) {
      const r = row as any;
      if (!tablesByBooking.has(r.booking_id)) {
        tablesByBooking.set(r.booking_id, []);
      }
      tablesByBooking.get(r.booking_id)!.push({
        id: r.table_id,
        label: r.tables?.label ?? tableLabelMap.get(r.table_id) ?? "",
      });
    }
  }

  // Merge combo tables into each booking
  const bookingsWithAllTables = (bookings ?? []).map((b) => {
    // Junction rows take precedence (they contain all combo tables)
    const junctionTables = tablesByBooking.get(b.id);
    if (junctionTables && junctionTables.length > 0) {
      return { ...b, tables: junctionTables };
    }
    // Fallback: primary table from FK relation or stored table_id
    const primaryTable = (b as any).tables;
    const label = primaryTable?.label
      ?? (b.table_id ? (tableLabelMap.get(b.table_id) ?? "") : "");
    return { ...b, tables: [{ id: b.table_id ?? "", label }] };
  });

  const upcoming = bookingsWithAllTables.filter(
    (b) => new Date(b.datetime) >= new Date(),
  );
  const past = bookingsWithAllTables.filter(
    (b) => new Date(b.datetime) < new Date(),
  );

  return (
    <div>
      <BookingActionsList
        orgId={orgId}
        initialBookings={upcoming as any}
        pastBookings={past as any}
        tables={tables ?? []}
      />
    </div>
  );
}