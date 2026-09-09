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

  // ─── Subscription lifecycle events ────────────────────────────────────────
  else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription & { current_period_end?: number };
    const orgSlug = sub.metadata?.orgSlug;

    if (orgSlug) {
      const status = sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "canceled";
      const plan = (sub.metadata?.plan as "pro" | "max") || "pro";
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

      await supabase
        .from("organizations")
        .upsert(
          {
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer as string,
            subscription_status: status,
            subscription_plan: plan,
            subscription_current_period_end: periodEnd,
          },
          { onConflict: "slug" },
        )
        .eq("slug", orgSlug);

      console.log(`Subscription ${sub.id} for org ${orgSlug}: ${status} (${plan})`);
    }
  }

  else if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const orgSlug = sub.metadata?.orgSlug;

    if (orgSlug) {
      await supabase
        .from("organizations")
        .update({
          subscription_status: "canceled",
          stripe_subscription_id: null,
          subscription_current_period_end: null,
        })
        .eq("slug", orgSlug);

      console.log(`Subscription ${sub.id} for org ${orgSlug} canceled`);
    }
  }

  return NextResponse.json({ received: true });
}