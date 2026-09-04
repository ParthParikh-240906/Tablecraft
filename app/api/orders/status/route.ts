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

    // Verify staff org
    const { data: staff } = await supabase
      .from("staff_users")
      .select("org_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!staff) {
      return NextResponse.json({ error: "Forbidden: Not a staff member" }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId)
      .eq("org_id", staff.org_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // When a table order is completed+paid or cancelled, free the table
    if (status === "paid" || status === "cancelled") {
      const { data: order } = await adminSupabase
        .from("orders")
        .select("customer_name")
        .eq("id", orderId)
        .single();

      if (order && order.customer_name.startsWith("Table ")) {
        const tableName = order.customer_name.replace("Table ", "");
        const { data: tables } = await adminSupabase
          .from("tables")
          .select("id")
          .eq("org_id", staff.org_id)
          .eq("label", `Table ${tableName}`);

        if (tables && tables.length > 0) {
          await adminSupabase
            .from("tables")
            .update({ status: "open" })
            .eq("id", tables[0].id);
        }
      }
    }

    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
