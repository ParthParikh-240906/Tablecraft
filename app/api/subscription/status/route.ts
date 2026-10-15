import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { computeOwnerPlan } from "@/lib/billing";

/**
 * GET /api/subscription/status?orgSlug=...
 *
 * Returns the owner-wide subscription plan covering all restaurants the owner
 * holds, plus the raw single-org row for debugging.
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
      .eq("org_id", (orgIdRow as { id: string }).id)
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

    const typed = org as {
      subscription_plan?: string | null;
      subscription_status?: string | null;
      subscription_current_period_end?: string | null;
    };

    // Owner-wide plan: highest tier across every org this owner holds.
    let ownerPlan: "free" | "pro" | "max" = (typed.subscription_plan as "free" | "pro" | "max" | null) ?? "free";
    let ownerOrgCount = 1;
    try {
      const { data: ownerRow } = await admin
        .from("staff_users")
        .select("auth_user_id")
        .eq("org_id", (orgIdRow as { id: string }).id)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle();
      const ownerId = (ownerRow as { auth_user_id?: string } | null)?.auth_user_id;
      if (ownerId) {
        const { data: ownedLinks } = await admin
          .from("staff_users")
          .select("org_id")
          .eq("auth_user_id", ownerId)
          .eq("role", "owner");
        const ids = ((ownedLinks as Array<{ org_id?: string }> | null) ?? [])
          .map((r) => r.org_id)
          .filter((id): id is string => !!id);
        if (ids.length > 0) {
          ownerOrgCount = ids.length;
          const { data: ownedOrgs } = await admin
            .from("organizations")
            .select("subscription_plan, subscription_status")
            .in("id", ids);
          ownerPlan = computeOwnerPlan(
            (ownedOrgs as Array<{ subscription_plan?: unknown; subscription_status?: unknown }> | null) ?? [],
          );
        }
      }
    } catch {
      // Fall back to the single-org plan.
    }

    return NextResponse.json({
      // Owner-wide: ONE plan covers ALL restaurants. `plan` is the aggregated
      // owner plan (previously this returned the single-org row, which
      // diverged after fan-out writes — 1 org Max, 2 Free).
      plan: ownerPlan,
      orgPlan: typed.subscription_plan ?? "free",
      status: typed.subscription_status ?? "free",
      periodEnd: typed.subscription_current_period_end ?? null,
      ownerPlan,
      ownerOrgCount,
    });
  } catch (err) {
    console.error("subscription/status: unhandled", err);
    return NextResponse.json({ error: "Could not load subscription. Please try again." }, { status: 500 });
  }
}
