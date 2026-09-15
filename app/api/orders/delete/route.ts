import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  try {
    const supabase = createAdminClient();
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { orderId } = body as { orderId: string };
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    // Fetch order details before deletion to reconcile table status
    const { data: order } = await supabase
      .from("orders")
      .select("id, org_id, customer_name")
      .eq("id", orderId)
      .maybeSingle();

    if (order && order.customer_name && order.customer_name.startsWith("Table ")) {
      const labelsStr = order.customer_name.slice("Table ".length);
      const tableLabels: string[] = labelsStr
        .split(",")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      if (tableLabels.length > 0) {
        const labelVariants = tableLabels.flatMap((l: string) => [`Table ${l}`, l]);
        const { data: tables } = await supabase
          .from("tables")
          .select("id, label")
          .eq("org_id", order.org_id)
          .in("label", labelVariants);

        if (tables && tables.length > 0) {
          const tableIds = tables.map((t) => t.id);

          // Check for upcoming non-cancelled bookings to determine reserved vs open
          const now = new Date().toISOString();
          const { data: upcomingBookings } = await supabase
            .from("bookings")
            .select("id")
            .eq("org_id", order.org_id)
            .gte("datetime", now)
            .neq("status", "cancelled");

          const upcomingBookingIdsSet = new Set<string>(
            (upcomingBookings ?? []).map((b: { id: string }) => b.id)
          );

          if (upcomingBookingIdsSet.size > 0) {
            const { data: comboRows } = await supabase
              .from("booking_tables")
              .select("table_id")
              .eq("org_id", order.org_id)
              .in("booking_id", Array.from(upcomingBookingIdsSet));

            const reservedTableIds = new Set<string>(
              (comboRows ?? []).map((r: { table_id: string }) => r.table_id)
            );

            const toReserve = tableIds.filter((id) => reservedTableIds.has(id));
            const toOpen = tableIds.filter((id) => !reservedTableIds.has(id));

            if (toReserve.length > 0) {
              await supabase
                .from("tables")
                .update({ status: "reserved" })
                .in("id", toReserve);
            }
            if (toOpen.length > 0) {
              await supabase
                .from("tables")
                .update({ status: "open" })
                .in("id", toOpen);
            }
          } else {
            await supabase
              .from("tables")
              .update({ status: "open" })
              .in("id", tableIds);
          }
        }
      }
    }

    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
