import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getMonthlyPriceId, type PlanKey } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/checkout/subscribe?plan=pro&email=...&orgSlug=...&orgId=...
 *
 * Bridge endpoint: called after the one-time setup fee succeeds.
 * Creates a Stripe Checkout Session for the monthly subscription.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const plan = searchParams.get("plan") as PlanKey | null;
    const email = searchParams.get("email") || undefined;
    const orgSlug = searchParams.get("orgSlug") || undefined;
    const orgId = searchParams.get("orgId") || undefined;

    if (plan !== "pro" && plan !== "max") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const cfg = (await import("@/lib/pricing")).getPlanConfig(plan);
    const supabase = createAdminClient();

    // Resolve base URL
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}` ||
      "";

    // Find or create Stripe Customer
    let stripeCustomer: Stripe.Customer;
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
        .select("stripe_customer_id")
        .eq("slug", orgSlug)
        .single();
      customerId = org?.stripe_customer_id;
    }

    if (customerId) {
      try {
        const retrieved = await stripe.customers.retrieve(customerId);
        if ("deleted" in retrieved || !retrieved.id) {
          throw new Error("deleted");
        }
        stripeCustomer = retrieved as Stripe.Customer;
      } catch {
        stripeCustomer = await stripe.customers.create({
          email: email || undefined,
          metadata: { orgSlug: orgSlug || "", orgId: orgId || "", plan },
        });
        // Update org with new customer ID
        if (orgId) {
          await supabase
            .from("organizations")
            .update({ stripe_customer_id: stripeCustomer.id })
            .eq("id", orgId);
        }
      }
    } else {
      stripeCustomer = await stripe.customers.create({
        email: email || undefined,
        metadata: { orgSlug: orgSlug || "", orgId: orgId || "", plan },
      });
    }

    // Get the monthly recurring price ID
    const monthlyPriceId = await getMonthlyPriceId(stripe, plan);

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
      customer_email: email || stripeCustomer.email || undefined,
      success_url: `${origin}/signup?checkout=done&plan=${plan}${orgSlug ? `&orgSlug=${orgSlug}` : ""}`,
      cancel_url: `${origin}/#pricing`,
      metadata: {
        orgSlug: orgSlug || "",
        orgId: orgId || "",
        plan,
        type: "subscription",
      },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    console.error("Subscription checkout creation failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create subscription checkout" },
      { status: 500 },
    );
  }
}
