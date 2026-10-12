import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForSlug } from "@/lib/api-auth";
import { getStripe } from "@/lib/stripe";

/**
 * POST /api/stripe/connect/start
 * Owner-only. Creates (or reuses) a Stripe Express account for the org and
 * returns an onboarding account link URL, opened in a popup. The owner can
 * create a new Stripe account or sign into an existing one; Stripe handles
 * both inside the same onboarding flow.
 * Body: { orgSlug }
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const orgSlug = typeof body.orgSlug === "string" ? body.orgSlug : "";
  if (!orgSlug) return NextResponse.json({ error: "orgSlug is required" }, { status: 400 });

  const auth = await requireOwnerForSlug(orgSlug);
  if ("response" in auth) return auth.response;

  try {
    const admin = createAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select("id, name, email:contact_email, stripe_connect_account_id")
      .eq("id", auth.orgId)
      .single();
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const stripe = getStripe();
    let accountId = (org as { stripe_connect_account_id?: string | null }).stripe_connect_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "AE",
        email: (org as { email?: string }).email || undefined,
        business_profile: { name: (org as { name?: string }).name },
        metadata: { orgId: auth.orgId, orgSlug },
      });
      accountId = account.id;
      await admin
        .from("organizations")
        .update({ stripe_connect_account_id: accountId, stripe_connect_status: "pending" })
        .eq("id", auth.orgId);
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "";
    if (!origin) {
      return NextResponse.json({ error: "Server is misconfigured" }, { status: 500 });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/stripe-connected?refresh=1`,
      return_url: `${origin}/stripe-connected`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    console.error("stripe/connect/start: unhandled", err);
    return NextResponse.json({ error: "Could not start Stripe onboarding" }, { status: 500 });
  }
}
