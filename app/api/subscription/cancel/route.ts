import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/subscription/cancel
 *
 * Cancels the active subscription for an org at the end of the current billing period.
 * The user retains access until the period end date, after which Stripe auto-cancels.
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
      .select("id, stripe_customer_id, stripe_subscription_id, subscription_status")
      .eq("slug", orgSlug)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!org.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 },
      );
    }

    if (org.subscription_status === "canceled") {
      return NextResponse.json(
        { error: "Subscription is already canceled" },
        { status: 400 },
      );
    }

    await stripe.subscriptions.update(org.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Cancel subscription failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to cancel subscription" },
      { status: 500 },
    );
  }
}
