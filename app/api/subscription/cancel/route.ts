import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForSlug } from "@/lib/api-auth";
import { applySubscriptionToOwnerOrgs, getOwnerOrgIds } from "@/lib/billing";

/**
 * POST /api/subscription/cancel
 *
 * Owner-wide: cancels the active subscription and drops EVERY restaurant
 * owned by the caller to Free immediately (no grace period).
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

    const ownerOrgIds = await getOwnerOrgIds(supabase, auth.user.id).catch(() => [] as string[]);
    const targetIds = ownerOrgIds.length > 0 ? ownerOrgIds : [auth.orgId];

    const { data: ownedOrgs, error: orgError } = await supabase
      .from("organizations")
      .select("id, stripe_customer_id, stripe_subscription_id, subscription_status")
      .in("id", targetIds);

    if (orgError || !ownedOrgs || ownedOrgs.length === 0) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const rows = ownedOrgs as Array<{
      id: string;
      stripe_customer_id?: string | null;
      stripe_subscription_id?: string | null;
    }>;

    // Prefer a stored subscription id; fall back to Stripe lookup by customer.
    let subscriptionId = rows.map((r) => r.stripe_subscription_id).find((s): s is string => !!s) ?? null;
    if (!subscriptionId) {
      const customerId = rows.map((r) => r.stripe_customer_id).find((c): c is string => !!c);
      if (customerId) {
        try {
          const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
          subscriptionId = subs.data[0]?.id ?? null;
        } catch {
          subscriptionId = null;
        }
      }
    }

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 },
      );
    }

    // Cancel immediately in Stripe (no grace period — plan becomes Free at once).
    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (stripeErr: any) {
      // If Stripe says the sub is already gone, still reset the local rows below.
      const msg = String(stripeErr?.message ?? "");
      if (!/no such subscription|canceled|deleted/i.test(msg)) throw stripeErr;
    }

    // Fetch period end for reference before writing to DB
    let periodEnd: string | null = null;
    try {
      const stripeSub = (await stripe.subscriptions.retrieve(subscriptionId)) as any;
      periodEnd = stripeSub.current_period_end
        ? new Date(stripeSub.current_period_end * 1000).toISOString()
        : null;
    } catch {
      // Subscription is gone — no period end to record.
    }

    const { error: updateError } = await applySubscriptionToOwnerOrgs(supabase, targetIds, {
      plan: "free",
      status: "canceled",
      subscriptionId: null,
      customerId: null,
      periodEnd,
    });

    if (updateError) {
      console.error("cancel: db update failed", updateError);
      return NextResponse.json({ error: "Subscription will cancel, but we could not update your dashboard. Please refresh." }, { status: 500 });
    }

    return NextResponse.json({ success: true, periodEnd, ownerOrgCount: targetIds.length });
  } catch (err) {
    console.error("Cancel subscription failed:", err);
    return NextResponse.json(
      { error: "Could not cancel subscription. Please try again." },
      { status: 500 },
    );
  }
}
