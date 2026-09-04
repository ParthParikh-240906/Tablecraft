import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json({ error: "Missing orderId or status" }, { status: 400 });
    }

    const validStatuses = ["pending", "paid", "preparing", "ready", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    // Verify staff org using anon client (needs auth for row-level checks)
    const { data: staff } = await supabase
      .from("staff_users")
      .select("org_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!staff) {
      return NextResponse.json({ error: "Forbidden: Not a staff member" }, { status: 403 });
    }

    // Update order status with admin client to bypass RLS and ensure consistency
    const { error: updateError } = await adminSupabase
      .from("orders")
      .update({ status })
      .eq("id", orderId)
      .eq("org_id", staff.org_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Free tables when order is paid or cancelled
    if (status === "paid" || status === "cancelled") {
      const { data: order } = await adminSupabase
        .from("orders")
        .select("customer_name")
        .eq("id", orderId)
        .single();

      if (order && order.customer_name && order.customer_name.startsWith("Table ")) {
        // Parse table labels from customer_name: "Table 1, 2, 3" or "Table 7"
        const labelsStr = order.customer_name.slice("Table ".length);
        const tableLabels: string[] = labelsStr
          .split(",")
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);

        if (tableLabels.length === 0) {
          return NextResponse.json({ success: true, status });
        }

        // Try both formats: raw label ("Group Table 1") and with prefix ("Table Group Table 1")
        const labelVariants = tableLabels.flatMap((l: string) => [`Table ${l}`, l]);
        const { data: tables } = await adminSupabase
          .from("tables")
          .select("id, label")
          .eq("org_id", staff.org_id)
          .in("label", labelVariants);

        if (!tables || tables.length === 0) {
          console.warn(`[orders/status] No tables found for labels: ${tableLabels.join(", ")}`);
          return NextResponse.json({ success: true, status });
        }

        const tableIds = (tables ?? []).map((t) => t.id);
        if (tableIds.length === 0) {
          return NextResponse.json({ success: true, status });
        }

        // Check for upcoming non-cancelled bookings to determine reserved vs open
        const now = new Date().toISOString();
        const { data: upcomingBookings } = await adminSupabase
          .from("bookings")
          .select("id")
          .eq("org_id", staff.org_id)
          .gte("datetime", now)
          .neq("status", "cancelled");

        const upcomingBookingIdsSet = new Set<string>(
          (upcomingBookings ?? []).map((b: { id: string }) => b.id)
        );

        // Tables with upcoming bookings should go to "reserved", others to "open"
        if (upcomingBookingIdsSet.size > 0) {
          const { data: comboRows } = await adminSupabase
            .from("booking_tables")
            .select("table_id")
            .eq("org_id", staff.org_id)
            .in("booking_id", Array.from(upcomingBookingIdsSet));

          const reservedTableIds = new Set<string>(
            (comboRows ?? []).map((r: { table_id: string }) => r.table_id)
          );

          // Set reserved tables
          if (reservedTableIds.size > 0) {
            await adminSupabase
              .from("tables")
              .update({ status: "reserved" })
              .in("id", Array.from(reservedTableIds));
          }

          // Set remaining to open
          const openTableIds = tableIds.filter((id) => !reservedTableIds.has(id));
          if (openTableIds.length > 0) {
            await adminSupabase
              .from("tables")
              .update({ status: "open" })
              .in("id", openTableIds);
          }
        } else {
          // No upcoming bookings — set all to open
          await adminSupabase
            .from("tables")
            .update({ status: "open" })
            .in("id", tableIds);
        }
      }
    }

    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    console.error("[orders/status] Error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
