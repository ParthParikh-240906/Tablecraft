import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // In dev or test environments without signature verification configured
      console.warn("Processing webhook event without verification (STRIPE_WEBHOOK_SECRET missing or no signature)");
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.client_reference_id || session.metadata?.orderId;

    if (orderId) {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "paid",
          stripe_session_id: session.id,
        })
        .eq("id", orderId);

      if (error) {
        console.error("Failed to mark order as paid:", error);
        return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
      }
      console.log(`Order ${orderId} marked as paid successfully`);
    }
  } else if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.client_reference_id || session.metadata?.orderId;

    if (orderId) {
      await supabase
        .from("orders")
        .update({ status: "failed" })
        .eq("id", orderId);
    }
  }

  return NextResponse.json({ received: true });
}