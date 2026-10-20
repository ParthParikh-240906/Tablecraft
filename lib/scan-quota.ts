import { createAdminClient } from "@/lib/supabase/admin";
import { displayPlan } from "@/lib/pricing";
import {
  checkOwnerQuota,
  getOwnerForOrg,
  getOwnerPlanContext,
  ownerQuotaExceededResponse,
} from "@/lib/owner-quotas";
import type { PlanTier } from "@/lib/rate-limit";

/**
 * Consume one unit from the shared AI-scan pool (`menu_scanner`).
 * Menu scans and inventory scans both use this.
 */
export async function consumeSharedScanQuota(orgId: string): Promise<
  | { allowed: true; used: number; limit: number }
  | { allowed: false; response: ReturnType<typeof ownerQuotaExceededResponse> }
> {
  const { ownerId, ownerEmail } = await getOwnerForOrg(orgId);
  const ownerKey = ownerId ?? `org-fallback:${orgId}`;
  const ownerCtx = ownerId
    ? await getOwnerPlanContext(ownerId)
    : { plan: "free" as PlanTier, email: null as string | null };

  let effectiveTier = ownerCtx.plan;

  if (!ownerId) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("organizations")
        .select("subscription_plan, subscription_status")
        .eq("id", orgId)
        .maybeSingle();
      const row = data as { subscription_plan?: string | null; subscription_status?: string | null } | null;
      const fallback = displayPlan(row?.subscription_plan ?? null, row?.subscription_status ?? null);
      if (fallback === "pro" || fallback === "max") effectiveTier = fallback;
    } catch {
      // Fail open to Free on a plan lookup error.
    }
  }

  const check = await checkOwnerQuota({
    ownerId: ownerKey,
    plan: effectiveTier,
    category: "menu_scanner",
    ownerEmail: ownerEmail ?? ownerCtx.email,
  });

  if (!check.allowed) {
    return {
      allowed: false,
      response: ownerQuotaExceededResponse(check.used, check.limit, "AI scan"),
    };
  }

  return { allowed: true, used: check.used, limit: check.limit };
}
