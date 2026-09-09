import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgSlug } = body as { orgSlug: string };

    if (!orgSlug) {
      return NextResponse.json({ error: "orgSlug is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, stripe_customer_id, subscription_status")
      .eq("slug", orgSlug)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!org.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer linked to this organization" },
        { status: 400 },
      );
    }

    // Resolve base URL
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}` ||
      "";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${origin}/console`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    console.error("Billing portal creation failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create billing portal session" },
      { status: 500 },
    );
  }
}
