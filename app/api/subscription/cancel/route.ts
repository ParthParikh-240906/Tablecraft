import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForSlug } from "@/lib/api-auth";

/**
 * POST /api/subscription/cancel
 *
 * Cancels the active subscription for an org at the end of the current billing period.
 * The user retains access until the period end date, after which Stripe auto-cancels.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { orgSlug } = body as { orgSlug: string };

    if (!orgSlug) {
      return NextResponse.json({ error: "orgSlug is required" }, { status: 400 });
    }

    const auth = await requireOwnerForSlug(orgSlug);
    if ("response" in auth) return auth.response;

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

    // Fetch period end before writing to DB
    const stripeSub = (await stripe.subscriptions.retrieve(org.stripe_subscription_id)) as any;
    const periodEnd = stripeSub.current_period_end
      ? new Date(stripeSub.current_period_end * 1000).toISOString()
      : null;

    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        subscription_status: "canceling",
        subscription_current_period_end: periodEnd,
      })
      .eq("slug", orgSlug);

    if (updateError) {
      console.error("cancel: db update failed", updateError);
      return NextResponse.json({ error: "Subscription will cancel, but we could not update your dashboard. Please refresh." }, { status: 500 });
    }

    return NextResponse.json({ success: true, periodEnd });
  } catch (err) {
    console.error("Cancel subscription failed:", err);
    return NextResponse.json(
      { error: "Could not cancel subscription. Please try again." },
      { status: 500 },
    );
  }
}
