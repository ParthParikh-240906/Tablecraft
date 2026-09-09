import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/subscription/status?orgSlug=...
 *
 * Returns the current subscription plan and status for an organization.
 * Used by the console to gate features based on plan tier.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgSlug = searchParams.get("orgSlug");

  if (!orgSlug) {
    return NextResponse.json({ error: "orgSlug query parameter is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: org, error } = await supabase
    .from("organizations")
    .select("subscription_plan, subscription_status, subscription_current_period_end")
    .eq("slug", orgSlug)
    .single();

  if (error || !org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({
    plan: org.subscription_plan ?? "free",
    status: org.subscription_status ?? "free",
    periodEnd: org.subscription_current_period_end ?? null,
  });
}
