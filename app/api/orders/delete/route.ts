import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isTableOrderName, normalizeTableLabel, parseTableLabelsFromCustomerName } from "@/lib/table-labels";

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const supabase = createAdminClient();
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { orderId } = body as { orderId: string };
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    // Fetch order details before deletion to reconcile table status
    const { data: order } = await supabase
      .from("orders")
      .select("id, org_id, customer_name")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { data: staffRows } = await supabase
      .from("staff_users")
      .select("org_id")
      .eq("auth_user_id", user.id);

    const isStaffOfOrg = (staffRows ?? []).some((s) => s.org_id === order.org_id);
    if (!isStaffOfOrg) {
      return NextResponse.json({ error: "Forbidden: Not a staff member of this restaurant" }, { status: 403 });
    }

    // Labels are normalized (trimmed, case-insensitive, "Table " prefix
    // stripped) so renames/case drift don't leave tables stuck occupied.
    const rawName = order?.customer_name ?? "";
    if (rawName && isTableOrderName(rawName)) {
      const tableLabels = parseTableLabelsFromCustomerName(rawName);

      if (tableLabels.length > 0) {
        // Only free tables if no other active order still references them
        const { data: otherActive } = await supabase
          .from("orders")
          .select("id, customer_name")
          .eq("org_id", order.org_id)
          .neq("id", orderId)
          .neq("status", "paid")
          .neq("status", "cancelled")
          .neq("status", "completed");

        const labelSet = new Set(tableLabels);
        const stillOccupied = (otherActive ?? []).some((o: { customer_name: string }) => {
          const otherLabels = parseTableLabelsFromCustomerName(o.customer_name);
          return otherLabels.some((l: string) => labelSet.has(l));
        });

        if (!stillOccupied) {
          const { data: allTables } = await supabase
            .from("tables")
            .select("id, label")
            .eq("org_id", order.org_id);

          const tables = (allTables ?? []).filter((t) =>
            labelSet.has(normalizeTableLabel(t.label)),
          );

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
    }

    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) {
      console.error("[orders/delete] failed", error);
      return NextResponse.json({ error: "Could not delete order. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[orders/delete] unhandled", err);
    return NextResponse.json({ error: "Could not delete order. Please try again." }, { status: 500 });
  }
}
