import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/subscription/sync
 *
 * Looks up the active Stripe subscription for an org's customer and
 * writes the subscription_id + latest plan/status/period_end into Supabase.
 * Use this when the webhook hasn't fired or data is stale.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgSlug } = body as { orgSlug: string };

    if (!orgSlug) {
      return NextResponse.json({ error: "orgSlug is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, stripe_customer_id, subscription_plan")
      .eq("slug", orgSlug)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!org.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer linked" }, { status: 400 });
    }

    // Fetch active subscriptions for this customer from Stripe
    const subs = await stripe.subscriptions.list({
      customer: org.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    if (!subs.data.length) {
      // No active subscription — mark as canceled
      await supabase
        .from("organizations")
        .update({
          stripe_subscription_id: null,
          subscription_status: "canceled",
          subscription_current_period_end: null,
        })
        .eq("slug", orgSlug);
      return NextResponse.json({ synced: true, status: "canceled" });
    }

    const sub = subs.data[0] as Stripe.Subscription & { current_period_end?: number };
    const plan = ((sub.metadata?.plan as "pro" | "max") || org.subscription_plan || "pro") as "pro" | "max";
    const periodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    await supabase
      .from("organizations")
      .update({
        stripe_subscription_id: sub.id,
        subscription_status: sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "canceled",
        subscription_plan: plan,
        subscription_current_period_end: periodEnd,
      })
      .eq("slug", orgSlug);

    console.log(`[SYNC] Updated ${orgSlug}: sub=${sub.id}, plan=${plan}, status=${sub.status}`);
    return NextResponse.json({ synced: true, subscription_id: sub.id, plan, status: sub.status, periodEnd });
  } catch (err: any) {
    console.error("[SYNC] Error:", err);
    return NextResponse.json({ error: err.message || "Sync failed" }, { status: 500 });
  }
}
