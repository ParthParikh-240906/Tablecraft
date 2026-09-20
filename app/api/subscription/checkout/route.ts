import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getMonthlyPriceId, type PlanKey } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/subscription/checkout
 *
 * Creates a Stripe Checkout Session for a subscription plan.
 * Used by existing orgs that want to upgrade, or as a fallback path.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
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

    const monthlyPriceId = await getMonthlyPriceId(stripe, plan);
    const supabase = createAdminClient();

    // Resolve base URL
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}` ||
      "";

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

    // Create subscription Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      mode: "subscription",
      line_items: [{ price: monthlyPriceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          orgSlug: orgSlug || "",
          orgId: orgId || "",
          plan,
        },
      },
      success_url: orgSlug ? `${origin}/console/pricing?org=${orgSlug}&checkout=done` : `${origin}/signup?checkout=done&plan=${plan}`,
      cancel_url: `${origin}/console`,
      metadata: {
        orgSlug: orgSlug || "",
        orgId: orgId || "",
        plan,
        type: "subscription",
      },
    });

    // Store customer ID on the org
    if (orgId) {
      await supabase
        .from("organizations")
        .update({ stripe_customer_id: stripeCustomer!.id })
        .eq("id", orgId);
    } else if (orgSlug) {
      await supabase
        .from("organizations")
        .update({ stripe_customer_id: stripeCustomer!.id })
        .eq("slug", orgSlug);
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    console.error("Subscription checkout creation failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create subscription checkout" },
      { status: 500 },
    );
  }
}
