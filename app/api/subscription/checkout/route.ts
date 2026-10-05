import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getMonthlyPriceId, type PlanKey } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForSlug } from "@/lib/api-auth";

/**
 * POST /api/subscription/checkout
 *
 * Creates a Stripe Checkout Session for a subscription plan.
 * Used by existing orgs that want to upgrade, or as a fallback path.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { plan, email, orgSlug, orgId } = body as {
      plan: PlanKey;
      email?: string;
      orgSlug?: string;
      orgId?: string;
    };

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
    if (orgSlug) {
      const auth = await requireOwnerForSlug(orgSlug);
      if ("response" in auth) return auth.response;
    }

    const monthlyPriceId = await getMonthlyPriceId(stripe, plan);
    const supabase = createAdminClient();

    // Resolve base URL
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "";
    if (!origin) {
      return NextResponse.json({ error: "Server is misconfigured. Please try again later." }, { status: 500 });
    }

    // Find existing Stripe customer ID (by orgId first, then orgSlug)
    let customerId: string | undefined;

    if (orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("stripe_customer_id")
        .eq("id", orgId)
        .single();
      customerId = org?.stripe_customer_id;
    } else if (orgSlug) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id, stripe_customer_id")
        .eq("slug", orgSlug)
        .single();
      customerId = org?.stripe_customer_id;
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
        metadata: { orgSlug: orgSlug || "", orgId: orgId || "", plan },
      });
    }

    // Store customer ID on the org
    if (orgId) {
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ stripe_customer_id: stripeCustomer.id })
        .eq("id", orgId);
      if (updateError) {
        console.error("checkout: org update failed", updateError);
        return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
      }
    } else if (orgSlug) {
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ stripe_customer_id: stripeCustomer.id })
        .eq("slug", orgSlug);
      if (updateError) {
        console.error("checkout: org update failed", updateError);
        return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
      }
    }

    // Check if customer already has an active subscription (upgrade case)
    const existingSubs = await stripe.subscriptions.list({
      customer: stripeCustomer.id,
      status: "active",
      limit: 1,
    });

    const successUrl = orgSlug
      ? `${origin}/console/pricing?org=${orgSlug}&checkout=done`
      : `${origin}/signup?checkout=done&plan=${plan}`;

    if (existingSubs.data.length > 0) {
      // Upgrade: update existing subscription directly with proration
      const existingSub = existingSubs.data[0] as any;
      await stripe.subscriptions.update(existingSub.id, {
        items: [{ id: existingSub.items.data[0].id, price: monthlyPriceId }],
        proration_behavior: "create_prorations",
        metadata: {
          orgSlug: orgSlug || "",
          orgId: orgId || "",
          plan,
        },
      });
      return NextResponse.json({ upgraded: true, successUrl });
    }

    // New subscription: create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      mode: "subscription",
      line_items: [{ price: monthlyPriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: `${origin}/console`,
      metadata: {
        orgSlug: orgSlug || "",
        orgId: orgId || "",
        plan,
        type: "subscription",
      },
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
