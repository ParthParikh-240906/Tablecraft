import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { STRIPE_PRICE_IDS, type PlanKey } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { plan, email, orgSlug } = body as {
      plan: PlanKey;
      email?: string;
      orgSlug?: string;
    };

    if (!plan || !STRIPE_PRICE_IDS[plan]) {
      return NextResponse.json(
        { error: "Invalid or unsupported plan. Use 'pro' or 'max'." },
        { status: 400 },
      );
    }

    const priceId = STRIPE_PRICE_IDS[plan];
    const supabase = createAdminClient();

    // Resolve base URL for success/cancel redirects
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}` ||
      "";

    let customerId: string | undefined;

    // If an existing org is provided, reuse or create its Stripe customer
    if (orgSlug) {
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, stripe_customer_id")
        .eq("slug", orgSlug)
        .single();

      if (!orgError && org?.stripe_customer_id) {
        customerId = org.stripe_customer_id;
      }
    }

    // Create or retrieve a Stripe Customer
    let stripeCustomer: Stripe.Customer | null = null;

    if (customerId) {
      try {
        const retrieved = await stripe.customers.retrieve(customerId);
        // retrieve() can return a DeletedCustomer; check it's still a valid Customer
        if ("deleted" in retrieved || !retrieved.id) {
          stripeCustomer = null;
        } else {
          stripeCustomer = retrieved as Stripe.Customer;
        }
      } catch {
        // Customer may have been deleted on Stripe side; create new
        stripeCustomer = null;
      }
    }

    if (!stripeCustomer) {
      stripeCustomer = await stripe.customers.create({
        email: email || undefined,
        metadata: { orgSlug: orgSlug || "", plan },
      });
    }

    // Create a Checkout Session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          orgSlug: orgSlug || "",
          plan,
          customerId: email || "",
        },
      },
      customer_email: email || stripeCustomer.email || undefined,
      success_url: `${origin}/signup?checkout=session_created&plan=${plan}${orgSlug ? `&orgSlug=${orgSlug}` : ""}`,
      cancel_url: `${origin}/#pricing`,
      metadata: {
        orgSlug: orgSlug || "",
        plan,
      },
    });

    // If we have an existing org, store the customer ID for future reference
    if (orgSlug && stripeCustomer) {
      await supabase
        .from("organizations")
        .update({ stripe_customer_id: stripeCustomer.id })
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
