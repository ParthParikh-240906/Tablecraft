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

    const { data: staff } = await supabase
      .from("staff_users")
      .select("org_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { orderId, items } = body as { orderId: string; items: OrderItemInput[] };

    if (!orderId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing orderId or items" }, { status: 400 });
    }

    // Validate menu items against DB prices
    const itemIds = items.map((i) => i.id);
    const { data: dbItems } = await supabase
      .from("menu_items")
      .select("id, name, price")
      .eq("org_id", staff.org_id)
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

    const { error } = await supabase
      .from("orders")
      .update({ items: validatedItems, total: calculatedTotal })
      .eq("id", orderId)
      .eq("org_id", staff.org_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
