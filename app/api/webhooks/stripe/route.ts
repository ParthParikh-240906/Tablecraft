import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

/**
 * Resolves the organization slug from subscription metadata.
 * Prefers orgId (UUID, unchanging) over orgSlug (can be changed).
 */
async function resolveOrgSlug(
  supabase: ReturnType<typeof createAdminClient>,
  metadata: Record<string, string> | null | undefined,
): Promise<string | null> {
  const orgId = metadata?.orgId;
  const orgSlug = metadata?.orgSlug;

  // Try orgId first (most reliable)
  if (orgId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("slug")
      .eq("id", orgId)
      .single();
    if (org?.slug) return org.slug;
  }

  // Fallback to orgSlug directly
  if (orgSlug) return orgSlug;

  return null;
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

  // ─── Subscription lifecycle events ────────────────────────────────────────
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription & { current_period_end?: number };
    const orgSlug = await resolveOrgSlug(supabase, sub.metadata);

    if (!orgSlug) {
      console.error(`Webhook ${sub.id}: could not resolve org from metadata`);
      return NextResponse.json({ error: "Could not resolve organization" }, { status: 500 });
    }
      const shouldCancel = (sub as any).cancel_at_period_end === true && sub.status === "active";
      const status = shouldCancel
        ? "canceled"
        : sub.status === "active"
          ? "active"
          : sub.status === "past_due"
            ? "past_due"
            : "canceled";
      const plan = (sub.metadata?.plan as "pro" | "max") || "free";
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

      const { error: updateError } = await supabase
        .from("organizations")
        .update({
          stripe_subscription_id: sub.id,
          stripe_customer_id: sub.customer as string,
          subscription_status: status,
          subscription_plan: plan,
          subscription_current_period_end: periodEnd,
        })
        .eq("slug", orgSlug);

      if (updateError) {
        console.error(`Webhook ${sub.id}: db update failed`, updateError);
        return NextResponse.json({ error: "Failed to persist subscription" }, { status: 500 });
      }

      console.log(`Subscription ${sub.id} for org ${orgSlug}: ${status} (${plan})`);
  }

  else if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const orgSlug = await resolveOrgSlug(supabase, sub.metadata);

    if (orgSlug) {
      const { error: updateError } = await supabase
        .from("organizations")
        .update({
          subscription_status: "canceled",
          stripe_subscription_id: null,
          // preserve current_period_end — don't null it out
        })
        .eq("slug", orgSlug);

      if (updateError) {
        console.error(`Webhook ${sub.id}: db update failed`, updateError);
        return NextResponse.json({ error: "Failed to persist cancellation" }, { status: 500 });
      }

      console.log(`Subscription ${sub.id} for org ${orgSlug} canceled`);
    }
  }

  return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler failed:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}