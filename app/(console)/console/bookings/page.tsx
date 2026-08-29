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

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, customer_name, party_size, datetime, status, table_id, tables(id, label)")
    .eq("org_id", orgId)
    .order("datetime", { ascending: true });

  const { data: tables } = await supabase
    .from("tables")
    .select("id, label, capacity, status")
    .eq("org_id", orgId)
    .order("label", { ascending: true });

  const upcoming = (bookings ?? []).filter(
    (b) => new Date(b.datetime) >= new Date(),
  );
  const past = (bookings ?? []).filter(
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