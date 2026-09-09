import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getSetupFeePriceId, type PlanKey } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/checkout/one-time
 *
 * Creates a Stripe Checkout Session for the one-time setup fee.
 * On success, redirects the customer to /api/checkout/subscribe to complete the subscription.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { plan, email, orgSlug } = body as {
      plan: PlanKey;
      email?: string;
      orgSlug?: string;
    };

    if (plan !== "pro" && plan !== "max") {
      return NextResponse.json(
        { error: "Invalid plan. Use 'pro' or 'max'." },
        { status: 400 },
      );
    }

    const cfg = (await import("@/lib/pricing")).getPlanConfig(plan);
    const supabase = createAdminClient();

    // Resolve base URL
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}` ||
      "";

    // Fetch org to get its UUID (for reliable linking)
    let orgId: string | undefined;
    if (orgSlug) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id, stripe_customer_id")
        .eq("slug", orgSlug)
        .single();
      orgId = org?.id;
    }

    // Get or create Stripe Customer
    let stripeCustomer: Stripe.Customer;

    if (orgId) {
      // Check if this org already has a Stripe customer
      const { data: existing } = await supabase
        .from("organizations")
        .select("stripe_customer_id")
        .eq("id", orgId)
        .single();

      if (existing?.stripe_customer_id) {
        try {
          const retrieved = await stripe.customers.retrieve(existing.stripe_customer_id);
          if (!("deleted" in retrieved)) {
            stripeCustomer = retrieved as Stripe.Customer;
          } else {
            throw new Error("deleted");
          }
        } catch {
          stripeCustomer = await stripe.customers.create({
            email: email || undefined,
            metadata: { orgSlug: orgSlug || "", orgId, plan },
          });
          await supabase
            .from("organizations")
            .update({ stripe_customer_id: stripeCustomer.id })
            .eq("id", orgId);
        }
      } else {
        stripeCustomer = await stripe.customers.create({
          email: email || undefined,
          metadata: { orgSlug: orgSlug || "", orgId, plan },
        });
        await supabase
          .from("organizations")
          .update({ stripe_customer_id: stripeCustomer.id })
          .eq("id", orgId);
      }
    } else {
      stripeCustomer = await stripe.customers.create({
        email: email || undefined,
        metadata: { orgSlug: orgSlug || "", orgId: "", plan },
      });
    }

    // Get the one-time setup fee price ID
    const setupPriceId = await getSetupFeePriceId(stripe, plan);

    // Build the subscribe URL with params
    const subscribeUrl = `${origin}/api/checkout/subscribe?plan=${plan}&email=${encodeURIComponent(email || "")}${orgSlug ? `&orgSlug=${orgSlug}` : ""}${orgId ? `&orgId=${orgId}` : ""}`;

    // Create one-time payment Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      mode: "payment",
      line_items: [{ price: setupPriceId, quantity: 1 }],
      customer_email: email || stripeCustomer.email || undefined,
      success_url: subscribeUrl,
      cancel_url: `${origin}/#pricing`,
      metadata: {
        orgSlug: orgSlug || "",
        orgId: orgId || "",
        plan,
        type: "setup-fee",
      },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    console.error("One-time checkout creation failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create one-time checkout" },
      { status: 500 },
    );
  }
}
