import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForSlug } from "@/lib/api-auth";
import { getStripeConnect } from "@/lib/stripe";
import {
  createConnectAccount,
  describeStripeError,
} from "@/lib/stripe-connect";

/**
 * POST /api/stripe/connect/start
 * Owner-only. Creates (or reuses) a Stripe Connect account for the org and
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

    const stripe = getStripeConnect();
    let accountId = (org as { stripe_connect_account_id?: string | null }).stripe_connect_account_id;

    if (!accountId) {
      try {
        const account = await createConnectAccount(stripe, {
          name: (org as { name?: string }).name || orgSlug,
          email: (org as { email?: string }).email,
          orgId: auth.orgId,
          orgSlug,
        });
        accountId = account.id;
      } catch (err) {
        console.error("stripe/connect/start: account create failed", err);
        return NextResponse.json(
          { error: describeStripeError(err) },
          { status: 502 },
        );
      }

      const { error: saveError } = await admin
        .from("organizations")
        .update({
          stripe_connect_account_id: accountId,
          stripe_connect_status: "pending",
        })
        .eq("id", auth.orgId);

      if (saveError) {
        console.error("stripe/connect/start: account save failed", saveError);
        return NextResponse.json(
          {
            error:
              "Stripe account was created but could not be linked to this restaurant. Please try again.",
          },
          { status: 500 },
        );
      }
    }

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(request.url).origin;
    if (!origin) {
      return NextResponse.json({ error: "Server is misconfigured" }, { status: 500 });
    }

    try {
      const link = await stripe.v2.core.accountLinks.create({
        account: accountId,
        use_case: {
          type: "account_onboarding",
          account_onboarding: {
            configurations: ["recipient"],
            refresh_url: `${origin}/stripe-connected?refresh=1`,
            return_url: `${origin}/stripe-connected`,
          },
        },
      });

      return NextResponse.json({ url: link.url });
    } catch (err) {
      console.error("stripe/connect/start: account link failed", err);
      return NextResponse.json(
        { error: describeStripeError(err) },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error("stripe/connect/start: unhandled", err);
    return NextResponse.json(
      { error: describeStripeError(err) },
      { status: 500 },
    );
  }
}
