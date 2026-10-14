import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import {
  PLAN_AI_LIMITS,
  normalizePlanTier,
  getClientIp,
  rateLimit,
  rateLimitedResponse,
  type PlanTier,
} from "@/lib/rate-limit";

const ALLOWED_RATIOS = ["1:1", "16:9", "9:16"] as const;
type ImageRatio = (typeof ALLOWED_RATIOS)[number];
const DEFAULT_RATIO: ImageRatio = "16:9";

function parseRatio(raw: unknown): ImageRatio {
  return typeof raw === "string" &&
    (ALLOWED_RATIOS as readonly string[]).includes(raw)
    ? (raw as ImageRatio)
    : DEFAULT_RATIO;
}

/**
 * Resolve the org's plan tier the same way /api/subscription/status does
 * (organizations.subscription_plan). Falls back to the Free tier when the
 * lookup is impractical — a safe default that never grants more than marketed.
 */
async function resolvePlanTier(orgId: string): Promise<PlanTier> {
  try {
    const admin = createAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select("subscription_plan")
      .eq("id", orgId)
      .maybeSingle();
    return normalizePlanTier(org?.subscription_plan);
  } catch {
    return "free";
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { prompt, org_id, orgId, ratio } = (body ?? {}) as {
      prompt?: unknown;
      org_id?: unknown;
      orgId?: unknown;
      ratio?: unknown;
    };

    if (typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }
    if (prompt.length > 1000) {
      return NextResponse.json({ error: "prompt must be under 1000 characters" }, { status: 400 });
    }

    const wantRatio = parseRatio(ratio);

    // Per-OWNER monthly image quota (free 10 / pro 100 / max 300) aggregated
    // across all restaurants the owner holds — covers editor, creation model
    // and direct user generations (all flow through this route).
    let tier: PlanTier = "free";
    let quota: { used: number; limit: number; remaining: number } | null = null;
    const orgIdValue =
      typeof org_id === "string" && org_id
        ? org_id
        : typeof orgId === "string" && orgId
          ? orgId
          : null;
    if (orgIdValue) {
      const auth = await requireStaffForOrgId(orgIdValue);
      if ("response" in auth) return auth.response;
      const { getOwnerForOrg, getOwnerPlanContext, checkOwnerQuota, ownerQuotaExceededResponse } = await import("@/lib/owner-quotas");
      const { ownerId, ownerEmail } = await getOwnerForOrg(orgIdValue);
      const ownerKey = ownerId ?? `org-fallback:${orgIdValue}`;
      tier = ownerId ? (await getOwnerPlanContext(ownerId)).plan : await resolvePlanTier(orgIdValue);
      const ownerEmailFinal = ownerEmail ?? (ownerId ? (await getOwnerPlanContext(ownerId)).email : null);
      const q = await checkOwnerQuota({ ownerId: ownerKey, plan: tier, category: "image", ownerEmail: ownerEmailFinal });
      if (!q.allowed) return ownerQuotaExceededResponse(q.used, q.limit, "image generation");
      quota = q;
    } else {
      const ipRl = rateLimit(
        `ai-image:ip:${getClientIp(req)}`,
        PLAN_AI_LIMITS.free.image,
        24 * 60 * 60 * 1000,
      );
      if (!ipRl.allowed) return rateLimitedResponse(ipRl.resetMs);
    }

    // OpenAI GPT Image 2.5 via OPENAI_API (same key as GPT 6.1 Sol). No fallback.
    try {
      const { callImageGen } = await import("@/lib/ai-models");
      const size = wantRatio === "1:1" ? "1024x1024" : wantRatio === "9:16" ? "1024x1536" : "1536x1024";
      let url = await callImageGen((prompt as string).trim().slice(0, 1000), { size });
      // GPT image models return base64 data URLs (hundreds of KB) — persisting
      // those would blow past the settings payload cap and lose the gallery on
      // the next save. Upload to storage and hand back a short public URL.
      if (orgIdValue && url.startsWith("data:image/")) {
        try {
          const m = url.match(/^data:(image\/[a-z+]+);base64,([\s\S]*)$/);
          if (!m) throw new Error("unparseable data URL");
          const mime = m[1];
          const buffer = Buffer.from(m[2], "base64");
          const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
          const admin = createAdminClient();
          const storagePath = `ai/${orgIdValue}/${Date.now()}.${ext}`;
          const { error: upErr } = await admin.storage
            .from("org-paragraph-images")
            .upload(storagePath, buffer, { contentType: mime, upsert: false });
          if (upErr) throw upErr;
          const { data: pub } = admin.storage.from("org-paragraph-images").getPublicUrl(storagePath);
          if (pub?.publicUrl) {
            url = pub.publicUrl;
          }
        } catch (e) {
          console.warn("[AI GENERATE] storage upload failed, falling back to data URL:", e instanceof Error ? e.message.slice(0, 200) : e);
        }
      }
      return NextResponse.json({
        url,
        // Lets the console update its "X of Y left" hint without an extra round-trip.
        quota: quota ? { ...quota, plan: tier } : undefined,
        model: "gpt-image-2.5-flare",
      });
    } catch (e) {
      console.error("[AI GENERATE] OpenAI image gen failed:", e instanceof Error ? e.message.slice(0, 200) : e);
      return NextResponse.json({ error: "Could not generate the image. Please try again." }, { status: 502 });
    }
  } catch (err) {
    console.error("[AI GENERATE] unhandled:", err);
    return NextResponse.json({ error: "Could not generate the image. Please try again." }, { status: 500 });
  }
}
