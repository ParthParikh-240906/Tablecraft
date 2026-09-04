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

    // Resolve staff org
    const { data: staff } = await supabase
      .from("staff_users")
      .select("org_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!staff) {
      return NextResponse.json({ error: "Forbidden: Not a staff member" }, { status: 403 });
    }

    const body = await request.json();
    const { tableId, items } = body as { tableId: string; items: OrderItemInput[] };

    if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: tableId and items (non-empty array)" },
        { status: 400 },
      );
    }

    // Validate table belongs to org
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("label")
      .eq("id", tableId)
      .eq("org_id", staff.org_id)
      .single();

    if (tableError || !table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Validate menu items against DB (prevent price tampering)
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
      validatedItems.push({
        id: dbItem.id,
        name: dbItem.name,
        price,
        quantity: qty,
      });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        org_id: staff.org_id,
        customer_name: `Table ${table.label}`,
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

    // Mark table as occupied when order is created
    await supabase
      .from("tables")
      .update({ status: "occupied" })
      .eq("id", tableId)
      .eq("org_id", staff.org_id);

    return NextResponse.json({ orderId: order.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
