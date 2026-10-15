import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForSlug } from "@/lib/api-auth";
import { getOwnerOrgIds } from "@/lib/billing";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { orgSlug } = body as { orgSlug: string };

    if (!orgSlug) {
      return NextResponse.json({ error: "orgSlug is required" }, { status: 400 });
    }

    const auth = await requireOwnerForSlug(orgSlug);
    if ("response" in auth) return auth.response;

    const supabase = createAdminClient();

    // Owner-wide customer: first linked customer across all owned orgs.
    const ownerOrgIds = await getOwnerOrgIds(supabase, auth.user.id).catch(() => [] as string[]);
    const targetIds = ownerOrgIds.length > 0 ? ownerOrgIds : [auth.orgId];

    const { data: ownedOrgs, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, stripe_customer_id, subscription_status, slug")
      .in("id", targetIds);

    if (orgError || !ownedOrgs || ownedOrgs.length === 0) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const rows = ownedOrgs as Array<{
      stripe_customer_id?: string | null;
      slug?: string;
    }>;
    const customerId = rows.map((r) => r.stripe_customer_id).find((c): c is string => !!c);

    if (!customerId) {
      return NextResponse.json(
        { error: "No Stripe customer linked to this organization" },
        { status: 400 },
      );
    }

    // Resolve base URL
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "";
    if (!origin) {
      return NextResponse.json({ error: "Server is misconfigured. Please try again later." }, { status: 500 });
    }

    const anchorSlug =
      rows.find((r) => r.slug === orgSlug)?.slug ?? rows[0]?.slug ?? orgSlug;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/console/pricing?org=${anchorSlug}`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("Billing portal creation failed:", err);
    return NextResponse.json(
      { error: "Could not open billing portal. Please try again." },
      { status: 500 },
    );
  }
}
