import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getPriceId, type PlanKey, type BillingInterval } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForSlug } from "@/lib/api-auth";
import { getOwnerOrgIds } from "@/lib/billing";

/**
 * POST /api/subscription/checkout
 *
 * Owner-wide billing: ONE plan covers ALL restaurants owned by the caller.
 * The `orgSlug`/`orgId` in the request is only the billing anchor (used for
 * the success URL + Stripe metadata). The Stripe customer + subscription are
 * shared across every org the owner holds, and the DB row is mirrored to all
 * of them so every surface agrees.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { plan, email, orgSlug, orgId, billing, forceNew } = body as {
      plan: PlanKey;
      email?: string;
      orgSlug?: string;
      orgId?: string;
      billing?: BillingInterval;
      /** Deliberate new purchase: skip the silent in-place upgrade and always open Stripe Checkout. */
      forceNew?: boolean;
    };
    const interval: BillingInterval = billing === "annual" ? "annual" : "monthly";

    if (plan !== "pro" && plan !== "max") {
      return NextResponse.json(
        { error: "Invalid plan. Use 'pro' or 'max'." },
        { status: 400 },
      );
    }
    if (email !== undefined && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    if (orgId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId)) {
      return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
    }

    // When an existing org is specified, the caller must own it.
    // Resolve the owner + anchor org for owner-wide fan-out.
    let ownerId: string | null = null;
    let anchorOrgId: string | null = orgId ?? null;
    let anchorOrgSlug: string | null = orgSlug ?? null;

    if (orgSlug) {
      const auth = await requireOwnerForSlug(orgSlug);
      if ("response" in auth) return auth.response;
      ownerId = auth.user.id;
      anchorOrgId = orgId ?? auth.orgId;
      anchorOrgSlug = orgSlug;
    } else if (orgId) {
      // orgId without slug: look up the slug so we can run the same owner check.
      const supabaseEarly = createAdminClient();
      const { data: orgRow } = await supabaseEarly
        .from("organizations")
        .select("slug")
        .eq("id", orgId)
        .maybeSingle();
      const slug = (orgRow as { slug?: string } | null)?.slug;
      if (!slug) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
      }
      const auth = await requireOwnerForSlug(slug);
      if ("response" in auth) return auth.response;
      ownerId = auth.user.id;
      anchorOrgId = orgId;
      anchorOrgSlug = slug;
    }

    if (!anchorOrgId && !anchorOrgSlug) {
      return NextResponse.json({ error: "orgSlug or orgId is required" }, { status: 400 });
    }

    const monthlyPriceId = await getPriceId(stripe, plan, interval);
    const supabase = createAdminClient();

    // Resolve base URL
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "";
    if (!origin) {
      return NextResponse.json({ error: "Server is misconfigured. Please try again later." }, { status: 500 });
    }

    // Owner-wide org set: every restaurant this owner holds shares one plan.
    let ownerOrgIds: string[] = [];
    if (ownerId) {
      try {
        ownerOrgIds = await getOwnerOrgIds(supabase, ownerId);
      } catch {
        ownerOrgIds = [];
      }
    }
    if (anchorOrgId && !ownerOrgIds.includes(anchorOrgId)) {
      ownerOrgIds = [...ownerOrgIds, anchorOrgId];
    }

    // Find existing Stripe customer ID across ALL owned orgs (one customer per owner).
    let customerId: string | undefined;
    if (ownerOrgIds.length > 0) {
      const { data: ownedOrgs } = await supabase
        .from("organizations")
        .select("id, stripe_customer_id")
        .in("id", ownerOrgIds);
      const rows = (ownedOrgs as Array<{ stripe_customer_id?: string | null }> | null) ?? [];
      customerId = rows.map((r) => r.stripe_customer_id).find((c): c is string => !!c);
    }
    // Legacy fallback: single-org lookup when owner set is unavailable.
    if (!customerId && anchorOrgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("stripe_customer_id")
        .eq("id", anchorOrgId)
        .single();
      customerId = (org as { stripe_customer_id?: string } | null)?.stripe_customer_id;
    }

    // Create or retrieve Stripe Customer
    let stripeCustomer: Stripe.Customer | null = null;

    if (customerId) {
      try {
        const retrieved = await stripe.customers.retrieve(customerId);
        if ("deleted" in retrieved || !retrieved.id) {
          stripeCustomer = null;
        } else {
          stripeCustomer = retrieved as Stripe.Customer;
        }
      } catch {
        stripeCustomer = null;
      }
    }

    if (!stripeCustomer) {
      stripeCustomer = await stripe.customers.create({
        email: email || undefined,
        metadata: {
          ownerId: ownerId || "",
          orgSlug: anchorOrgSlug || "",
          orgId: anchorOrgId || "",
          plan,
        },
      });
    }

    // Mirror the (single, owner-wide) customer ID onto every owned org.
    if (ownerOrgIds.length > 0) {
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ stripe_customer_id: stripeCustomer.id })
        .in("id", ownerOrgIds);
      if (updateError) {
        console.error("checkout: org update failed", updateError);
        return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
      }
    } else if (anchorOrgId) {
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ stripe_customer_id: stripeCustomer.id })
        .eq("id", anchorOrgId);
      if (updateError) {
        console.error("checkout: org update failed", updateError);
        return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
      }
    } else if (anchorOrgSlug) {
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ stripe_customer_id: stripeCustomer.id })
        .eq("slug", anchorOrgSlug);
      if (updateError) {
        console.error("checkout: org update failed", updateError);
        return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
      }
    }

    // Check if customer already has an active subscription (upgrade case).
    // A deliberate new purchase (forceNew) skips this silent in-place upgrade
    // so the buyer always lands on Stripe Checkout.
    const existingSubs =
      forceNew === true
        ? { data: [] as Stripe.Subscription[] }
        : await stripe.subscriptions.list({
            customer: stripeCustomer.id,
            status: "active",
            limit: 1,
          });

    const successSlug = anchorOrgSlug ?? "";
    const successUrl = successSlug
      ? `${origin}/console/pricing?org=${successSlug}&checkout=done`
      : `${origin}/signup?checkout=done&plan=${plan}`;

    if (existingSubs.data.length > 0) {
      // Upgrade: update existing subscription directly with proration,
      // then mirror the new plan to every owned org.
      const existingSub = existingSubs.data[0] as any;
      const updated = await stripe.subscriptions.update(existingSub.id, {
        items: [{ id: existingSub.items.data[0].id, price: monthlyPriceId }],
        proration_behavior: "create_prorations",
        metadata: {
          ownerId: ownerId || "",
          orgSlug: anchorOrgSlug || "",
          orgId: anchorOrgId || "",
          plan,
        },
      });
      const periodEnd = (updated as any).current_period_end
        ? new Date((updated as any).current_period_end * 1000).toISOString()
        : null;
      if (ownerOrgIds.length > 0) {
        await supabase
          .from("organizations")
          .update({
            stripe_subscription_id: updated.id,
            stripe_customer_id: stripeCustomer.id,
            subscription_status: "active",
            subscription_plan: plan,
            subscription_current_period_end: periodEnd,
          })
          .in("id", ownerOrgIds);
      }
      return NextResponse.json({ upgraded: true, successUrl });
    }

    // Shared metadata so the webhook can fan-out to every owned org even
    // though Checkout creates the Subscription asynchronously.
    const sharedMetadata = {
      ownerId: ownerId || "",
      orgSlug: anchorOrgSlug || "",
      orgId: anchorOrgId || "",
      plan,
      type: "subscription",
    };

    // New subscription: create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      mode: "subscription",
      line_items: [{ price: monthlyPriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: `${origin}/console`,
      client_reference_id: ownerId || undefined,
      subscription_data: {
        metadata: {
          ownerId: ownerId || "",
          orgSlug: anchorOrgSlug || "",
          orgId: anchorOrgId || "",
          plan,
        },
      },
      metadata: sharedMetadata,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Subscription checkout creation failed:", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 },
    );
  }
}
