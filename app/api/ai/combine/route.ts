import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { verifyAndFixSiteHtml, COMBINE_MODEL } from "@/lib/ai-connect";

/**
 * POST /api/ai/combine
 * Body: { orgId, orgSlug }
 * Manual re-run of the automatic post-build connection pass (Haiku 5.5,
 * medium effort): loads the stored built HTML, verifies/fixes console wiring,
 * saves it back. Staff-gated (owners pass — it checks org staff membership,
 * not employment). GPT 6.1 Sol is reserved for edit.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const orgId = typeof body.orgId === "string" ? body.orgId : "";
  const orgSlug = typeof body.orgSlug === "string" ? body.orgSlug : "";
  if (!orgId || !orgSlug) return NextResponse.json({ error: "orgId and orgSlug are required" }, { status: 400 });
  const auth = await requireStaffForOrgId(orgId);
  if ("response" in auth) return auth.response;

  // Manual re-runs count toward the per-OWNER edit quota (same pool as /api/ai/edit).
  {
    const { getOwnerForOrg, getOwnerPlanContext, checkOwnerQuota, ownerQuotaExceededResponse } = await import("@/lib/owner-quotas");
    const { ownerId, ownerEmail } = await getOwnerForOrg(orgId);
    const ownerKey = ownerId ?? `org-fallback:${orgId}`;
    const plan = ownerId ? (await getOwnerPlanContext(ownerId)).plan : "free" as const;
    const emailFinal = ownerEmail ?? (ownerId ? (await getOwnerPlanContext(ownerId)).email : null);
    const q = await checkOwnerQuota({ ownerId: ownerKey, plan, category: "edit", ownerEmail: emailFinal });
    if (!q.allowed) return ownerQuotaExceededResponse(q.used, q.limit, "edit");
  }

  try {
    const admin = createAdminClient();
    const { data: orgRow } = await admin
      .from("organizations")
      .select("name, design_settings")
      .eq("id", orgId)
      .maybeSingle();
    const settings = ((orgRow as { design_settings?: unknown } | null)?.design_settings ?? {}) as Record<string, unknown>;
    const current = typeof settings.built_html === "string" ? settings.built_html : "";
    if (!current) {
      return NextResponse.json({ error: "No built site to connect yet — run the AI build first" }, { status: 400 });
    }
    const name = (orgRow as { name?: unknown } | null)?.name;
    const fixed = await verifyAndFixSiteHtml(current, { orgSlug, name: typeof name === "string" ? name : orgSlug });
    await admin
      .from("organizations")
      .update({ design_settings: { ...settings, built_html: fixed } })
      .eq("id", orgId);
    console.log(`[AI COMBINE] manual re-run for ${orgSlug}: ${current.length} → ${fixed.length} chars`);
    // Same demo-menu ingest as build, so a re-run backfills console items —
    // but seed-only (never resurrects items the owner deleted).
    try {
      const { ingestDemoMenuItems } = await import("@/lib/demo-menu");
      const { count: existingCount } = await admin
        .from("menu_items")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId);
      if ((existingCount ?? 0) === 0) {
        const count = await ingestDemoMenuItems(admin, orgId, fixed);
        if (count > 0) console.log(`[AI COMBINE] demo menu ingested for ${orgSlug}: ${count} items`);
      }
    } catch (e) {
      console.error("[AI COMBINE] demo menu ingest failed:", e instanceof Error ? e.message.slice(0, 200) : e);
    }
    return NextResponse.json({ model: COMBINE_MODEL, effort: "medium", applied: true, chars: fixed.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Combine failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("CLAUDE_API") ? 500 : 502 });
  }
}
