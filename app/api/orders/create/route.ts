import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface OrderItemInput {
  id: string;
  quantity: number;
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();

    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: staff } = await supabase
      .from("staff_users")
      .select("org_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!staff) {
      return NextResponse.json({ error: "Forbidden: Not a staff member" }, { status: 403 });
    }

    const body = await request.json();
    const { tableIds, items } = body as { tableIds: string[]; items: OrderItemInput[] };

    if (!tableIds || !Array.isArray(tableIds) || tableIds.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: tableIds (non-empty array) and items" },
        { status: 400 },
      );
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: tableIds and items (non-empty array)" },
        { status: 400 },
      );
    }

    // Fetch all table labels in one query
    const { data: tables, error: tableError } = await supabase
      .from("tables")
      .select("id, label")
      .in("id", tableIds)
      .eq("org_id", staff.org_id);

    if (tableError || !tables || tables.length !== tableIds.length) {
      return NextResponse.json({ error: "One or more tables not found" }, { status: 404 });
    }

    // Validate menu items
    const itemIds = items.map((i) => i.id);
    const { data: dbItems, error: itemsError } = await supabase
      .from("menu_items")
      .select("id, name, price")
      .eq("org_id", staff.org_id)
      .in("id", itemIds);

    if (itemsError || !dbItems || dbItems.length !== itemIds.length) {
      return NextResponse.json({ error: "One or more menu items not found" }, { status: 400 });
    }

    const dbItemMap = new Map(dbItems.map((item) => [item.id, item]));

    let calculatedTotal = 0;
    const validatedItems: { id: string; name: string; price: number; quantity: number }[] = [];

    for (const clientItem of items) {
      const dbItem = dbItemMap.get(clientItem.id);
      if (!dbItem) continue;
      const qty = Math.max(1, Math.floor(clientItem.quantity));
      const price = Number(dbItem.price);
      calculatedTotal += price * qty;
      validatedItems.push({ id: dbItem.id, name: dbItem.name, price, quantity: qty });
    }

    // Build customer_name: "Table 1, 2, 3"
    const tableLabels = tables.map((t) => t.label.replace(/^Table\s*/i, "")).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      return isNaN(na) ? a.localeCompare(b) : na - nb;
    });
    const customerName = `Table ${tableLabels.join(", ")}`;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        org_id: staff.org_id,
        customer_name: customerName,
        items: validatedItems,
        total: calculatedTotal,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("Order creation failed:", orderError);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    // Mark all selected tables as occupied
    await supabase
      .from("tables")
      .update({ status: "occupied" })
      .in("id", tableIds)
      .eq("org_id", staff.org_id);

    return NextResponse.json({ orderId: order.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
