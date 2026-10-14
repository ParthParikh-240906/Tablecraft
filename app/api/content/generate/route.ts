import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import {
  normalizePlanTier,
  type PlanTier,
} from "@/lib/rate-limit";

const MAX_GALLERY_ITEMS = 20;

/**
 * Resolve the org's plan tier the same way /api/subscription/status does
 * (organizations.subscription_plan). Falls back to the Free tier when the
 * lookup is impractical — a safe default that never grants more than marketed.
 * Status-aware: a canceled subscription quotas as Free (matches displayPlan).
 */
async function resolvePlanTier(orgId: string): Promise<PlanTier> {
  try {
    const admin = createAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select("subscription_plan, subscription_status")
      .eq("id", orgId)
      .maybeSingle();
    const { displayPlan } = await import("@/lib/pricing");
    return normalizePlanTier(displayPlan((org as { subscription_plan?: unknown } | null)?.subscription_plan ?? null, (org as { subscription_status?: unknown } | null)?.subscription_status ?? null));
  } catch {
    return "free";
  }
}

/**
 * GET /api/content/generate?org_id=...
 * Lightweight staff-gated read for the AI console: current org website copy
 * (for before/after comparison), plan + monthly AI quota status, and the
 * persisted AI image gallery. Never consumes quota.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id") ?? searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ error: "org_id query parameter is required" }, { status: 400 });
    }
    const auth = await requireStaffForOrgId(orgId);
    if ("response" in auth) return auth.response;

    const tier = await resolvePlanTier(orgId);
    const admin = createAdminClient();
    const { data: org, error } = await admin
      .from("organizations")
      .select("tagline, about_text, design_settings")
      .eq("id", orgId)
      .maybeSingle();
    if (error) {
      console.error("[CONTENT GENERATE] GET org lookup failed:", error);
      return NextResponse.json({ error: "Could not load website copy. Please try again." }, { status: 500 });
    }
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const rawGallery = (org.design_settings as Record<string, unknown> | null)?.ai_gallery;
    const { normalizeGallery } = await import("@/lib/design");
    const galleryItems = normalizeGallery(rawGallery, MAX_GALLERY_ITEMS);
    const gallery = galleryItems.map((g) => g.url);

    // Single source of truth: per-OWNER monthly quota (shared pool across all
    // restaurants). Must match POST /api/design/ai-generate (checkOwnerQuota)
    // or the hint diverges after generation (298/300 vs 10/10 bug).
    const { getOwnerForOrg, getOwnerPlanContext, peekOwnerQuotaDb } = await import("@/lib/owner-quotas");
    const { ownerId } = await getOwnerForOrg(orgId);
    const ownerKey = ownerId ?? `org-fallback:${orgId}`;
    const ownerPlan: PlanTier = ownerId ? (await getOwnerPlanContext(ownerId)).plan : tier;
    const imageUsage = await peekOwnerQuotaDb(ownerKey, ownerPlan, "image");
    const image = { ...imageUsage, plan: ownerPlan };
    // Content hint kept generous; owner-quotas has no content category.
    const { peekAiQuota } = await import("@/lib/rate-limit");
    const content = { ...peekAiQuota({ orgId, tier, kind: "content" }), plan: tier };

    return NextResponse.json({
      tagline: typeof org.tagline === "string" ? org.tagline : null,
      about_text: typeof org.about_text === "string" ? org.about_text : null,
      plan: ownerPlan,
      image,
      content,
      gallery,
      galleryItems,
    });
  } catch (err) {
    console.error("[CONTENT GENERATE] GET unhandled:", err);
    return NextResponse.json({ error: "Could not load website copy. Please try again." }, { status: 500 });
  }
}
