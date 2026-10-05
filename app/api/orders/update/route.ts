import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface OrderItemInput {
  id: string;
  quantity: number;
}

export async function POST(request: Request) {
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

    const { orderId, items } = body as { orderId: string; items: OrderItemInput[] };

    if (!orderId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing orderId or items" }, { status: 400 });
    }

    // Look up the order to identify its org_id
    const { data: order, error: orderLookupErr } = await supabase
      .from("orders")
      .select("id, org_id, customer_name")
      .eq("id", orderId)
      .single();

    if (orderLookupErr || !order) {
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

    // Validate menu items against DB prices
    const itemIds = items.map((i) => i.id);
    const { data: dbItems } = await supabase
      .from("menu_items")
      .select("id, name, price")
      .eq("org_id", order.org_id)
      .in("id", itemIds);

    if (!dbItems || dbItems.length !== itemIds.length) {
      return NextResponse.json({ error: "One or more menu items not found" }, { status: 400 });
    }

    const dbItemMap = new Map(dbItems.map((item) => [item.id, item]));
    let calculatedTotal = 0;
    const validatedItems: { id: string; name: string; price: number; quantity: number }[] = [];

    for (const clientItem of items) {
      const dbItem = dbItemMap.get(clientItem.id);
      if (!dbItem) continue;
      const qty = Math.floor(Number(clientItem.quantity));
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        return NextResponse.json({ error: "Each item quantity must be an integer 1–99" }, { status: 400 });
      }
      const price = Number(dbItem.price);
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: "Invalid item price" }, { status: 500 });
      }
      calculatedTotal += price * qty;
      validatedItems.push({ id: dbItem.id, name: dbItem.name, price, quantity: qty });
    }

    const { error } = await supabase
      .from("orders")
      .update({ items: validatedItems, total: calculatedTotal })
      .eq("id", orderId)
      .eq("org_id", order.org_id);

    if (error) {
      console.error("orders/update: failed", error);
      return NextResponse.json({ error: "Could not update order. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (err) {
    console.error("orders/update: unhandled", err);
    return NextResponse.json({ error: "Could not update order. Please try again." }, { status: 500 });
  }
}
