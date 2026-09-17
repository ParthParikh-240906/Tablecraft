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
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { parentId, tableLabel, items, orgId } = body as {
      parentId: string;
      tableLabel: string;
      items: OrderItemInput[];
      orgId?: string;
    };

    if (!parentId || !tableLabel || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Look up the parent order to get org_id
    const { data: parentOrder, error: parentErr } = await supabase
      .from("orders")
      .select("id, org_id")
      .eq("id", parentId)
      .maybeSingle();

    if (parentErr || !parentOrder) {
      return NextResponse.json({ error: "Parent order not found" }, { status: 404 });
    }

    const targetOrgId = orgId ?? parentOrder.org_id;

    // Validate staff membership
    const { data: staffRows } = await supabase
      .from("staff_users")
      .select("org_id")
      .eq("auth_user_id", user.id);

    if (!staffRows?.some((s) => s.org_id === targetOrgId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate menu items
    const itemIds = items.map((i) => i.id);
    const { data: dbItems } = await supabase
      .from("menu_items")
      .select("id, name, price")
      .eq("org_id", targetOrgId)
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
      const qty = Math.max(1, Math.floor(clientItem.quantity));
      const price = Number(dbItem.price);
      calculatedTotal += price * qty;
      validatedItems.push({ id: dbItem.id, name: dbItem.name, price, quantity: qty });
    }

    // Create the extra order — does NOT affect table status
    const extraName = `Extra (${tableLabel})`;
    const { data: order, error: insertErr } = await supabase
      .from("orders")
      .insert({
        org_id: targetOrgId,
        customer_name: extraName,
        parent_order_id: parentId,
        items: validatedItems,
        total: calculatedTotal,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr || !order) {
      console.error("Extra order creation failed:", insertErr);
      return NextResponse.json({ error: "Failed to create extra order" }, { status: 500 });
    }

    return NextResponse.json({ orderId: order.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
