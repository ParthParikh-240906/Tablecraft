import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

interface CartItemInput {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgSlug, items, customerName, customerEmail, orderType, tableNumber } = body as {
      orgSlug: string;
      items: CartItemInput[];
      customerName: string;
      customerEmail?: string;
      orderType?: "online" | "table";
      tableNumber?: string | null;
    };

    if (!orgSlug || !items || !Array.isArray(items) || items.length === 0 || !customerName) {
      return NextResponse.json(
        { error: "Missing required checkout parameters (orgSlug, items, customerName)" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Fetch organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("slug", orgSlug)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // 2. Fetch authoritative menu items from database to prevent price tampering
    const itemIds = items.map((i) => i.id);
    const { data: dbItems, error: itemsError } = await supabase
      .from("menu_items")
      .select("id, name, price, available")
      .eq("org_id", org.id)
      .in("id", itemIds);

    if (itemsError || !dbItems || dbItems.length === 0) {
      return NextResponse.json(
        { error: "Failed to validate menu items or items not found" },
        { status: 400 }
      );
    }

    const dbItemMap = new Map(dbItems.map((item) => [item.id, item]));

    // 3. Construct validated line items & calculate total
    let calculatedTotal = 0;
    const validatedItems: { id: string; name: string; price: number; quantity: number }[] = [];
    const stripeLineItems = [];

    for (const clientItem of items) {
      const dbItem = dbItemMap.get(clientItem.id);
      if (!dbItem) {
        return NextResponse.json(
          { error: `Item ${clientItem.name} (${clientItem.id}) is not available at this restaurant` },
          { status: 400 }
        );
      }
      if (!dbItem.available) {
        return NextResponse.json(
          { error: `Item "${dbItem.name}" is currently sold out / unavailable` },
          { status: 400 }
        );
      }

      const itemPrice = Number(dbItem.price);
      const qty = Math.max(1, Math.floor(clientItem.quantity));
      calculatedTotal += itemPrice * qty;

      validatedItems.push({
        id: dbItem.id,
        name: dbItem.name,
        price: itemPrice,
        quantity: qty,
      });

      stripeLineItems.push({
        price_data: {
          currency: "aed",
          product_data: {
            name: dbItem.name,
          },
          unit_amount: Math.round(itemPrice * 100), // Stripe expects minor units (fils)
        },
        quantity: qty,
      });
    }

    // 4. Create pending order in database
    const finalCustomerName = orderType === "table" && tableNumber
      ? `Table ${tableNumber} (${customerName.trim()})`
      : customerName.trim();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        org_id: org.id,
        customer_name: finalCustomerName,
        items: validatedItems,
        total: calculatedTotal,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("Order creation failed:", orderError);
      return NextResponse.json({ error: "Failed to create order record" }, { status: 500 });
    }

    // 5. Determine base URL
    // Prefer explicit config (Vercel/Prod), then request origin (works on any dev host),
    // then fall back to a configurable env var. Never hardcode localhost.
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      request.headers.get("x-forwarded-proto") + "://" + request.headers.get("x-forwarded-host") ||
      "";

    // 6. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: stripeLineItems,
      mode: "payment",
      customer_email: customerEmail || undefined,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        orgId: org.id,
        orgSlug: org.slug,
        customerName,
      },
      success_url: `${origin}/${org.slug}/orders/${order.id}?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${org.slug}/cart?status=cancelled`,
    });

    // Update order with stripe_session_id
    await supabase
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return NextResponse.json({ url: session.url, orderId: order.id, sessionId: session.id });
  } catch (error: any) {
    console.error("Stripe checkout session creation failed:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error during checkout" },
      { status: 500 }
    );
  }
}