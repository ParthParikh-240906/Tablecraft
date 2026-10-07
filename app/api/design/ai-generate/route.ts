import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import {
  PLAN_AI_LIMITS,
  normalizePlanTier,
  checkAiQuota,
  aiQuotaExceededResponse,
  getClientIp,
  rateLimit,
  rateLimitedResponse,
  type PlanTier,
} from "@/lib/rate-limit";

const DEFAULT_AGNES_IMAGE_URL = "https://apihub.agnes-ai.com/v1/images/generations";

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

async function callAgnes(apiKey: string, imageUrl: string, payload: Record<string, unknown>) {
  const res = await fetch(imageUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { res, data };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { prompt, imageBase64, org_id, orgId, ratio } = (body ?? {}) as {
      prompt?: unknown;
      imageBase64?: unknown;
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
    if (imageBase64 != null && (typeof imageBase64 !== "string" || imageBase64.length > 7_000_000)) {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }

    const wantRatio = parseRatio(ratio);

    // Monthly per-org quota (PLAN_AI_LIMITS.image) when the org is known.
    // Without an org (legacy callers) fall back to a per-IP daily brake at
    // the Free-tier level so the endpoint is never unauthenticated-unlimited.
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
      tier = await resolvePlanTier(orgIdValue);
      const q = checkAiQuota({ orgId: orgIdValue, tier, kind: "image" });
      if (!q.allowed) return aiQuotaExceededResponse(q.used, q.limit, "image");
      quota = q;
    } else {
      const ipRl = rateLimit(
        `ai-image:ip:${getClientIp(req)}`,
        PLAN_AI_LIMITS.free.image,
        24 * 60 * 60 * 1000,
      );
      if (!ipRl.allowed) return rateLimitedResponse(ipRl.resetMs);
    }

    const apiKey = process.env.AGNES_API_KEY;
    const imageUrl = process.env.AGNES_IMAGE_API_URL?.trim() || DEFAULT_AGNES_IMAGE_URL;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing AGNES_API_KEY" },
        { status: 500 },
      );
    }

    const buildPayload = (r: ImageRatio): Record<string, unknown> => {
      const payload: Record<string, unknown> = {
        model: "agnes-image-2.5-flash",
        prompt: (prompt as string).trim().slice(0, 1000),
        size: "1K",
        ratio: r,
        extra_body: {
          response_format: "url",
        },
      };
      if (imageBase64) {
        (payload.extra_body as Record<string, unknown>).image = [imageBase64];
      }
      return payload;
    };

    let { res, data } = await callAgnes(apiKey, imageUrl, buildPayload(wantRatio));

    // Graceful fallback: if the provider rejects a non-default ratio, retry
    // once with the 16:9 default instead of failing the request.
    if (!res.ok && wantRatio !== DEFAULT_RATIO && data !== null) {
      const errText = JSON.stringify(data).toLowerCase();
      if (errText.includes("ratio") || errText.includes("aspect") || errText.includes("size")) {
        console.warn(`[AI GENERATE] ratio ${wantRatio} rejected, retrying with ${DEFAULT_RATIO}`);
        ({ res, data } = await callAgnes(apiKey, imageUrl, buildPayload(DEFAULT_RATIO)));
      }
    }

    if (data === null) {
      console.error("[AI GENERATE] Image API returned non-JSON");
      return NextResponse.json({ error: "Image service error. Please try again." }, { status: 502 });
    }

    if (!res.ok) {
      console.error("[AI GENERATE] Image API failed:", res.status);
      return NextResponse.json(
        { error: "Could not generate the image. Please try again." },
        { status: 502 },
      );
    }

    const url = (data as { data?: { url?: unknown }[] } | null)?.data?.[0]?.url ?? null;
    if (typeof url !== "string") {
      return NextResponse.json({ error: "Could not generate the image. Please try again." }, { status: 500 });
    }
    return NextResponse.json({
      url,
      // Lets the console update its "X of Y left" hint without an extra round-trip.
      quota: quota ? { ...quota, plan: tier } : undefined,
    });
  } catch (err) {
    console.error("[AI GENERATE] unhandled:", err);
    return NextResponse.json({ error: "Could not generate the image. Please try again." }, { status: 500 });
  }
}
