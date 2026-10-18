import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { normalizeCartConfig } from "@/lib/design";
import { rateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { getStorefrontContext } from "@/lib/site-url";
import { assertSiteSlot } from "@/lib/capacity";

type CartItemInput = { id: string; quantity: number };

/**
 * POST /api/cart/checkout
 * Public guest checkout for a restaurant cart.
 * Body: { orgSlug, items: [{id, quantity}], fulfillment?: "pickup"|"delivery",
 *         customerName?, customerPhone? }
 * Validates items against menu_items (server-side prices, qty 1-99),
 * enforces cart_config (mode/delivery fee/min order), inserts a pending
 * order, then creates a Stripe Checkout Session with a destination charge
 * to the org's connected Stripe account. Returns { url, orderId }.
 */
export async function POST(request: Request) {
  const rl = rateLimit(`cart-checkout:${getClientIp(request)}`, 20, 60_000);
  if (!rl.allowed) return rateLimitedResponse(rl.resetMs);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const orgSlug = typeof body.orgSlug === "string" ? body.orgSlug : "";
    const items = Array.isArray(body.items) ? (body.items as CartItemInput[]) : [];
    const fulfillment = body.fulfillment === "delivery" ? "delivery" : "pickup";
    const customerName = typeof body.customerName === "string" ? body.customerName.trim().slice(0, 100) : "";
    const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim().slice(0, 30) : "";

    if (!orgSlug || !/^[a-z0-9-]{1,80}$/.test(orgSlug)) {
      return NextResponse.json({ error: "A valid orgSlug is required" }, { status: 400 });
    }
    if (items.length === 0 || items.length > 50) {
      return NextResponse.json({ error: "Cart must have 1-50 line items" }, { status: 400 });
    }
    if (!customerName || customerName.length < 2) {
      return NextResponse.json({ error: "A customer name is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, slug, stripe_connect_account_id, stripe_connect_status, design_settings")
      .eq("slug", orgSlug)
      .maybeSingle();

    if (!org) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

    const capacity = await assertSiteSlot(org.id, request);
    if (!capacity.allowed) return capacity.response;

    if (org.stripe_connect_status !== "active" || !org.stripe_connect_account_id) {
      return NextResponse.json({ error: "Online ordering is not enabled for this restaurant yet" }, { status: 400 });
    }

    const cart = normalizeCartConfig((org.design_settings as Record<string, unknown> | null)?.cart_config);
    const mode = fulfillment === "delivery" && cart.delivery_enabled ? "delivery" : "pickup";

    const itemIds = items.map((i) => i.id);
    const { data: dbItems } = await supabase
      .from("menu_items")
      .select("id, name, price")
      .eq("org_id", org.id)
      .eq("available", true)
      .in("id", itemIds);

    if (!dbItems || dbItems.length !== itemIds.length) {
      return NextResponse.json({ error: "One or more menu items are unavailable" }, { status: 400 });
    }
    const dbItemMap = new Map(dbItems.map((item) => [item.id, item]));
    let subtotal = 0;
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
      subtotal += price * qty;
      validatedItems.push({ id: dbItem.id, name: dbItem.name, price, quantity: qty });
    }

    const deliveryFee = mode === "delivery" ? cart.delivery_fee : 0;
    const total = Math.round((subtotal + deliveryFee) * 100) / 100;
    if (cart.min_order > 0 && subtotal < cart.min_order) {
      return NextResponse.json(
        { error: `Minimum order is AED ${cart.min_order}` },
        { status: 400 },
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        org_id: org.id,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        items: validatedItems,
        total,
        fulfillment: mode,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("cart/checkout: order insert failed", orderError);
      return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
    }

    // Prefer a validated active custom domain over the platform origin so the
    // customer returns to the restaurant's branded site after checkout.
    const storefront = await getStorefrontContext(request, org.id, org.slug);
    const origin = storefront.origin;

    const stripe = getStripe();
    const lineItems = validatedItems.map((i) => ({
      price_data: {
        currency: "aed",
        product_data: { name: i.name },
        unit_amount: Math.round(i.price * 100),
      },
      quantity: i.quantity,
    }));
    if (deliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: "aed",
          product_data: { name: "Delivery fee" },
          unit_amount: Math.round(deliveryFee * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${origin}${storefront.basePath}/cart/success?order=${order.id}`,
      cancel_url: `${origin}${storefront.basePath}/cart?cancelled=1`,
      metadata: { orgId: org.id, orderId: order.id, type: "guest_order" },
      payment_intent_data: {
        transfer_data: { destination: org.stripe_connect_account_id },
      },
    });

    await supabase.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

    return NextResponse.json({ url: session.url, orderId: order.id });
  } catch (err) {
    console.error("cart/checkout: unhandled", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
