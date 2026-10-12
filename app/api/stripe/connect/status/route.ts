import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForSlug } from "@/lib/api-auth";
import { getStripe } from "@/lib/stripe";

/**
 * GET /api/stripe/connect/status?orgSlug=...
 * Owner-only. Polls the Express account state and syncs
 * organizations.stripe_connect_status. Returns { status } where status is
 * one of: none | pending | active | restricted.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgSlug = searchParams.get("orgSlug") ?? "";
  if (!orgSlug) return NextResponse.json({ error: "orgSlug is required" }, { status: 400 });

  const auth = await requireOwnerForSlug(orgSlug);
  if ("response" in auth) return auth.response;

  try {
    const admin = createAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select("id, stripe_connect_account_id, stripe_connect_status")
      .eq("id", auth.orgId)
      .single();
    if (!org || !(org as { stripe_connect_account_id?: string | null }).stripe_connect_account_id) {
      return NextResponse.json({ status: "none" });
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(
      (org as { stripe_connect_account_id: string }).stripe_connect_account_id,
    );
    const status =
      account.details_submitted && account.charges_enabled
        ? "active"
        : account.requirements?.disabled_reason
          ? "restricted"
          : "pending";

    if (status !== (org as { stripe_connect_status?: string }).stripe_connect_status) {
      await admin
        .from("organizations")
        .update({ stripe_connect_status: status })
        .eq("id", auth.orgId);
    }
    return NextResponse.json({ status });
  } catch (err) {
    console.error("stripe/connect/status: unhandled", err);
    return NextResponse.json({ error: "Could not check Stripe status" }, { status: 500 });
  }
}
