import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForSlug } from "@/lib/api-auth";

/**
 * POST /api/subscription/cancel
 *
 * Cancels the active subscription for an org immediately.
 * The plan switches to Free right away (no grace period): the Stripe
 * subscription is canceled at once and the org row is reset to
 * subscription_plan='free' so every surface shows Free.
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

    // Cancel immediately in Stripe (no grace period — plan becomes Free at once).
    try {
      await stripe.subscriptions.cancel(org.stripe_subscription_id);
    } catch (stripeErr: any) {
      // If Stripe says the sub is already gone, still reset the local row below.
      const msg = String(stripeErr?.message ?? "");
      if (!/no such subscription|canceled|deleted/i.test(msg)) throw stripeErr;
    }

    // Fetch period end for reference before writing to DB
    let periodEnd: string | null = null;
    try {
      const stripeSub = (await stripe.subscriptions.retrieve(org.stripe_subscription_id)) as any;
      periodEnd = stripeSub.current_period_end
        ? new Date(stripeSub.current_period_end * 1000).toISOString()
        : null;
    } catch {
      // Subscription is gone — no period end to record.
    }

    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        subscription_plan: "free",
        subscription_status: "canceled",
        stripe_subscription_id: null,
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
