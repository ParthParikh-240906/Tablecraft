import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForSlug } from "@/lib/api-auth";
import {
  applySubscriptionToOwnerOrgs,
  computeOwnerPlan,
  getOwnerOrgIds,
  inferPlanFromSubscription,
  toDbPlan,
  toDbStatus,
} from "@/lib/billing";

/**
 * POST /api/subscription/sync
 *
 * Owner-wide: looks up active Stripe subscriptions across EVERY customer
 * linked to the owner's restaurants and mirrors the result to all of them.
 * Use this when the webhook hasn't fired or data is stale.
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
    const anchorIds = ownerOrgIds.length > 0 ? ownerOrgIds : [auth.orgId];

    const { data: ownedOrgs, error: orgError } = await supabase
      .from("organizations")
      .select("id, stripe_customer_id, subscription_plan, subscription_status")
      .in("id", anchorIds);

    if (orgError || !ownedOrgs || ownedOrgs.length === 0) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const rows = ownedOrgs as Array<{
      id: string;
      stripe_customer_id?: string | null;
      subscription_plan?: string;
      subscription_status?: string;
    }>;
    const customerIds = Array.from(
      new Set(rows.map((r) => r.stripe_customer_id).filter((c): c is string => !!c)),
    );

    if (customerIds.length === 0) {
      return NextResponse.json({ error: "No Stripe customer linked" }, { status: 400 });
    }

    // Find the first active subscription across all owner customers.
    let activeSub: (Stripe.Subscription & { current_period_end?: number }) | null = null;
    let activeCustomerId: string | null = null;
    for (const customerId of customerIds) {
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 5,
      });
      if (subs.data.length > 0) {
        activeSub = subs.data[0] as Stripe.Subscription & { current_period_end?: number };
        activeCustomerId = customerId;
        break;
      }
    }

    const targetIds = ownerOrgIds.length > 0 ? ownerOrgIds : rows.map((r) => r.id);

    if (!activeSub) {
      // No active subscription — drop every owned org to Free (no grace period).
      const { error: updateError } = await applySubscriptionToOwnerOrgs(supabase, targetIds, {
        plan: "free",
        status: "canceled",
        subscriptionId: null,
        customerId: customerIds[0] ?? null,
        periodEnd: null,
      });
      if (updateError) {
        console.error("[SYNC] db update failed", updateError);
        return NextResponse.json({ error: "Could not sync subscription. Please try again." }, { status: 500 });
      }
      return NextResponse.json({ synced: true, status: "canceled", ownerOrgCount: targetIds.length });
    }

    const dbStatus = toDbStatus(activeSub.status, (activeSub as any).cancel_at_period_end === true);
    const inferred =
      inferPlanFromSubscription(activeSub) ??
      (computeOwnerPlan(rows) === "free" ? null : computeOwnerPlan(rows));
    const plan = toDbPlan(inferred, dbStatus);
    const periodEnd = activeSub.current_period_end
      ? new Date(activeSub.current_period_end * 1000).toISOString()
      : null;

    const { error: updateError } = await applySubscriptionToOwnerOrgs(supabase, targetIds, {
      plan,
      status: dbStatus,
      subscriptionId: activeSub.id,
      customerId: activeCustomerId,
      periodEnd,
    });

    if (updateError) {
      console.error("[SYNC] db update failed", updateError);
      return NextResponse.json({ error: "Could not sync subscription. Please try again." }, { status: 500 });
    }

    console.log(`[SYNC] Updated ${targetIds.length} org(s): sub=${activeSub.id}, plan=${plan}, status=${activeSub.status}`);
    return NextResponse.json({
      synced: true,
      subscription_id: activeSub.id,
      plan,
      status: activeSub.status,
      periodEnd,
      ownerOrgCount: targetIds.length,
    });
  } catch (err) {
    console.error("[SYNC] Error:", err);
    return NextResponse.json({ error: "Could not sync subscription. Please try again." }, { status: 500 });
  }
}
