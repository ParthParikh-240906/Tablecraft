import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/subscription/status?orgSlug=...
 *
 * Returns the current subscription plan and status for an organization.
 * Used by the console to gate features based on plan tier.
 * Requires a signed-in staff member of the org (billing data is sensitive).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgSlug = searchParams.get("orgSlug");

    if (!orgSlug) {
      return NextResponse.json({ error: "orgSlug query parameter is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: orgIdRow, error: orgIdError } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", orgSlug)
      .maybeSingle();

    if (orgIdError) {
      console.error("subscription/status: org lookup failed", orgIdError);
      return NextResponse.json({ error: "Could not load subscription. Please try again." }, { status: 500 });
    }
    if (!orgIdRow) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const { data: staffRows } = await admin
      .from("staff_users")
      .select("org_id")
      .eq("org_id", orgIdRow.id)
      .eq("auth_user_id", user.id);
    if (!staffRows || staffRows.length === 0) {
      return NextResponse.json({ error: "You do not have access to this restaurant" }, { status: 403 });
    }

    const { data: org, error } = await admin
      .from("organizations")
      .select("subscription_plan, subscription_status, subscription_current_period_end")
      .eq("slug", orgSlug)
      .maybeSingle();

    if (error) {
      console.error("subscription/status: query failed", error);
      return NextResponse.json({ error: "Could not load subscription. Please try again." }, { status: 500 });
    }
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({
      plan: org.subscription_plan ?? "free",
      status: org.subscription_status ?? "free",
      periodEnd: org.subscription_current_period_end ?? null,
    });
  } catch (err) {
    console.error("subscription/status: unhandled", err);
    return NextResponse.json({ error: "Could not load subscription. Please try again." }, { status: 500 });
  }
}
