import { NextResponse } from "next/server";
import { stripe, getStripeConnect } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";
import {
  applySubscriptionToOwnerOrgs,
  computeOwnerPlan,
  getOwnerIdForOrg,
  getOwnerOrgIds,
  inferPlanFromSubscription,
  toDbPlan,
  toDbStatus,
} from "@/lib/billing";
import { removeDomainsForOrgIds } from "@/lib/domain-cleanup";
import { clearCapacityCache } from "@/lib/capacity";
import { retrieveConnectStatus } from "@/lib/stripe-connect";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;
type Meta = Record<string, string | undefined> | null | undefined;

/**
 * Resolve the full owner-wide org set from subscription/session metadata.
 * Priority: ownerId -> orgId -> orgSlug -> stripe customer lookup.
 */
async function resolveOwnerOrgIds(
  supabase: SupabaseAdmin,
  metadata: Meta,
  customerId?: string | null,
): Promise<{ orgIds: string[]; ownerId: string | null }> {
  const ownerIdMeta = metadata?.ownerId;
  if (ownerIdMeta) {
    const ids = await getOwnerOrgIds(supabase, ownerIdMeta).catch(() => [] as string[]);
    if (ids.length > 0) return { orgIds: ids, ownerId: ownerIdMeta };
  }

  const orgIdMeta = metadata?.orgId;
  if (orgIdMeta) {
    const ownerId = await getOwnerIdForOrg(supabase, orgIdMeta).catch(() => null);
    if (ownerId) {
      const ids = await getOwnerOrgIds(supabase, ownerId).catch(() => [] as string[]);
      if (ids.length > 0) return { orgIds: ids, ownerId };
    }
    return { orgIds: [orgIdMeta], ownerId };
  }

  const orgSlugMeta = metadata?.orgSlug;
  if (orgSlugMeta) {
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", orgSlugMeta)
      .maybeSingle();
    const orgId = (org as { id?: string } | null)?.id;
    if (orgId) {
      const ownerId = await getOwnerIdForOrg(supabase, orgId).catch(() => null);
      if (ownerId) {
        const ids = await getOwnerOrgIds(supabase, ownerId).catch(() => [] as string[]);
        if (ids.length > 0) return { orgIds: ids, ownerId };
      }
      return { orgIds: [orgId], ownerId: null };
    }
  }

  // Fallback: every org sharing this Stripe customer (owner-wide customer).
  if (customerId) {
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id")
      .eq("stripe_customer_id", customerId);
    const ids = ((orgs as Array<{ id?: string }> | null) ?? [])
      .map((o) => o.id)
      .filter((id): id is string => !!id);
    if (ids.length > 0) {
      const ownerId = await getOwnerIdForOrg(supabase, ids[0]).catch(() => null);
      if (ownerId) {
        const full = await getOwnerOrgIds(supabase, ownerId).catch(() => ids);
        return { orgIds: full.length > 0 ? full : ids, ownerId };
      }
      return { orgIds: ids, ownerId: null };
    }
  }

  return { orgIds: [], ownerId: ownerIdMeta ?? null };
}

function periodEndIso(currentPeriodEnd: unknown): string | null {
  return typeof currentPeriodEnd === "number"
    ? new Date(currentPeriodEnd * 1000).toISOString()
    : null;
}

/** Owner-wide persist for created/updated subscriptions. */
async function applySubscriptionEvent(
  supabase: SupabaseAdmin,
  sub: Stripe.Subscription & { current_period_end?: number },
  fallbackMetadata?: Meta,
) {
  const mergedMeta: Record<string, string | undefined> = {
    ...(fallbackMetadata ?? {}),
    ...(sub.metadata ?? {}),
  };
  // Prefer subscription metadata when it carries owner/org info.
  const effectiveMeta: Meta =
    sub.metadata?.ownerId || sub.metadata?.orgId || sub.metadata?.orgSlug
      ? sub.metadata
      : mergedMeta;

  const customerId =
    typeof sub.customer === "string" ? sub.customer : (sub.customer as Stripe.Customer)?.id ?? null;

  const { orgIds } = await resolveOwnerOrgIds(supabase, effectiveMeta, customerId);
  if (orgIds.length === 0) {
    console.error(`Webhook ${sub.id}: could not resolve org from metadata`);
    return NextResponse.json({ error: "Could not resolve organization" }, { status: 500 });
  }

  const dbStatus = toDbStatus(sub.status, (sub as any).cancel_at_period_end === true);
  let inferred = inferPlanFromSubscription(sub);
  if (!inferred && dbStatus === "active") {
    // Old subscriptions without metadata/price info: keep the current owner plan
    // instead of dropping to Free.
    const { data: rows } = await supabase
      .from("organizations")
      .select("subscription_plan, subscription_status")
      .in("id", orgIds);
    const current = computeOwnerPlan((rows as Array<{ subscription_plan?: unknown; subscription_status?: unknown }> | null) ?? []);
    inferred = current === "free" ? null : current;
  }
  const plan = toDbPlan(inferred, dbStatus);

  const { error: updateError } = await applySubscriptionToOwnerOrgs(supabase, orgIds, {
    plan,
    status: dbStatus,
    subscriptionId: sub.id,
    customerId,
    periodEnd: periodEndIso((sub as { current_period_end?: unknown }).current_period_end),
  });

  if (updateError) {
    console.error(`Webhook ${sub.id}: db update failed`, updateError);
    return NextResponse.json({ error: "Failed to persist subscription" }, { status: 500 });
  }

  // The plan cache is per-instance; clear it so a downgrade gate applies
  // immediately instead of waiting up to 60s.
  clearCapacityCache();

  // Max → Pro keeps domains (both allow 1/restaurant). Dropping to Free
  // removes them immediately; stale webhook misses are backstopped by the
  // Launch page.
  if (plan === "free") {
    await removeDomainsForOrgIds(orgIds, "plan_downgraded").catch((err) => {
      console.error(`Webhook ${sub.id}: domain cleanup failed`, err);
    });
  }

  console.log(`Subscription ${sub.id} for ${orgIds.length} org(s): ${dbStatus} (${plan})`);
  return NextResponse.json({ received: true });
}

export async function POST(request: Request) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const signature = request.headers.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (!webhookSecret || !signature) {
      console.error("Webhook missing secret or signature — rejecting (fail-closed)");
      return NextResponse.json({ error: "Webhook signature required" }, { status: 400 });
    }
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

  // ─── Subscription lifecycle events (owner-wide fan-out) ───────────────────
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription & { current_period_end?: number };
    return await applySubscriptionEvent(supabase, sub);
  }

  else if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId =
      typeof sub.customer === "string" ? sub.customer : (sub.customer as Stripe.Customer)?.id ?? null;
    const { orgIds } = await resolveOwnerOrgIds(supabase, sub.metadata as Meta, customerId);

    if (orgIds.length > 0) {
      const { error: updateError } = await applySubscriptionToOwnerOrgs(supabase, orgIds, {
        plan: "free",
        status: "canceled",
        subscriptionId: null,
        customerId,
        periodEnd: null,
      });

      if (updateError) {
        console.error(`Webhook ${sub.id}: db update failed`, updateError);
        return NextResponse.json({ error: "Failed to persist cancellation" }, { status: 500 });
      }

      clearCapacityCache();
      await removeDomainsForOrgIds(orgIds, "subscription_canceled").catch((err) => {
        console.error(`Webhook ${sub.id}: domain cleanup failed`, err);
      });

      console.log(`Subscription ${sub.id} canceled for ${orgIds.length} org(s)`);
    }
  }

  // ─── Checkout completed ───────────────────────────────────────────────────
  else if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.type === "guest_order" && session.metadata?.orderId) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({ status: "paid" })
        .eq("id", session.metadata.orderId)
        .eq("status", "pending");
      if (updateError) {
        console.error(`Webhook ${session.id}: order paid update failed`, updateError);
        return NextResponse.json({ error: "Failed to persist order payment" }, { status: 500 });
      }
      console.log(`Guest order ${session.metadata.orderId} paid`);
    } else if (
      session.metadata?.type === "subscription" ||
      session.mode === "subscription" ||
      session.subscription
    ) {
      // Owner-wide subscription purchase: the Subscription object is created
      // asynchronously, so reconcile here from session metadata.
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription as Stripe.Subscription | null)?.id ?? null;
      if (subId) {
        try {
          const sub = (await stripe.subscriptions.retrieve(subId)) as Stripe.Subscription & {
            current_period_end?: number;
          };
          return await applySubscriptionEvent(supabase, sub, session.metadata as Meta);
        } catch (err) {
          console.error(`Webhook ${session.id}: subscription retrieve failed`, err);
          return NextResponse.json({ error: "Failed to persist subscription" }, { status: 500 });
        }
      }
      // No subscription id yet (edge): fall back to customer mapping so a
      // later subscription.created event can still resolve.
      const customerId =
        typeof session.customer === "string" ? session.customer : null;
      if (customerId && (session.metadata?.ownerId || session.metadata?.orgId || session.metadata?.orgSlug)) {
        const { orgIds } = await resolveOwnerOrgIds(
          supabase,
          session.metadata as Meta,
          customerId,
        );
        if (orgIds.length > 0) {
          await supabase
            .from("organizations")
            .update({ stripe_customer_id: customerId })
            .in("id", orgIds);
        }
      }
    }
  }

  // ─── Stripe Connect onboarding state ───────────────────────────────────────
  else if (
    event.type === "account.updated" ||
    event.type.startsWith("v2.core.account.") ||
    event.type.startsWith("v2.core.account[")
  ) {
    // Accounts v1 events carry the account; Accounts v2 events are thin events
    // that only reference the account id.
    const thin = event as unknown as {
      related_object?: { id?: string };
      data?: { object?: { id?: string } };
    };
    const accountId =
      (event.type === "account.updated"
        ? (event.data.object as Stripe.Account).id
        : thin.related_object?.id ?? thin.data?.object?.id) ?? null;

    if (accountId) {
      try {
        const status = await retrieveConnectStatus(getStripeConnect(), accountId);
        const { error: updateError } = await supabase
          .from("organizations")
          .update({ stripe_connect_status: status })
          .eq("stripe_connect_account_id", accountId);
        if (updateError) {
          console.error(`Webhook ${accountId}: connect status update failed`, updateError);
          return NextResponse.json({ error: "Failed to persist connect status" }, { status: 500 });
        }
        console.log(`Connect account ${accountId}: ${status}`);
      } catch (err) {
        // Legacy/nonexistent accounts shouldn't fail delivery; status is also
        // refreshed by polling from the create flow and console config.
        console.error(`Webhook ${accountId}: connect status lookup failed`, err);
      }
    }
  }

  return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler failed:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
