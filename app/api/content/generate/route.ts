import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import {
  AI_CONTENT_MONTHLY_LIMITS,
  normalizePlanTier,
  checkAiQuota,
  peekAiQuota,
  aiQuotaExceededResponse,
  getClientIp,
  rateLimit,
  rateLimitedResponse,
  type PlanTier,
} from "@/lib/rate-limit";

const SYSTEM_PROMPT = `You are a creative copywriter for a restaurant SaaS platform called Tablecraft.

Given a short description of a restaurant, generate:
1. A tagline: one compelling line, max 60 characters, no quotes.
2. An about paragraph: 3-4 sentences warm and inviting, describing the restaurant's vibe, cuisine, and story. No intro fluff like "Welcome to..." — just describe it directly.

Return ONLY valid JSON, nothing else:
{"tagline": "...", "about": "..."}`;

const MAX_GALLERY_ITEMS = 3;

function pickOrgId(body: Record<string, unknown>): string | null {
  const v = body.org_id ?? body.orgId;
  return typeof v === "string" && v ? v : null;
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
    const gallery = Array.isArray(rawGallery)
      ? rawGallery.filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, MAX_GALLERY_ITEMS)
      : [];

    const image = peekAiQuota({ orgId, tier, kind: "image" });
    const content = peekAiQuota({ orgId, tier, kind: "content" });

    return NextResponse.json({
      tagline: typeof org.tagline === "string" ? org.tagline : null,
      about_text: typeof org.about_text === "string" ? org.about_text : null,
      plan: tier,
      image: { ...image, plan: tier },
      content: { ...content, plan: tier },
      gallery,
    });
  } catch (err) {
    console.error("[CONTENT GENERATE] GET unhandled:", err);
    return NextResponse.json({ error: "Could not load website copy. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: { description?: string; orgName?: string; org_id?: unknown; orgId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { description, orgName } = body ?? {};
  if (!description || typeof description !== "string" || !description.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  if (description.length > 1000) {
    return NextResponse.json({ error: "description must be under 1000 characters" }, { status: 400 });
  }
  if (orgName !== undefined && (typeof orgName !== "string" || orgName.length > 100)) {
    return NextResponse.json({ error: "orgName must be under 100 characters" }, { status: 400 });
  }

  // Monthly per-org quota when the org is known (console regeneration).
  // Signup-time callers have no org yet — they get a per-IP daily brake at
  // the Free-tier level so the endpoint is never unauthenticated-unlimited.
  let tier: PlanTier = "free";
  let quota: { used: number; limit: number; remaining: number } | null = null;
  const orgIdValue = pickOrgId((body ?? {}) as Record<string, unknown>);
  if (orgIdValue) {
    const auth = await requireStaffForOrgId(orgIdValue);
    if ("response" in auth) return auth.response;
    tier = await resolvePlanTier(orgIdValue);
    const q = checkAiQuota({ orgId: orgIdValue, tier, kind: "content" });
    if (!q.allowed) return aiQuotaExceededResponse(q.used, q.limit, "content");
    quota = q;
  } else {
    const ipRl = rateLimit(
      `ai-content:ip:${getClientIp(request)}`,
      AI_CONTENT_MONTHLY_LIMITS.free,
      24 * 60 * 60 * 1000,
    );
    if (!ipRl.allowed) return rateLimitedResponse(ipRl.resetMs);
  }

  const apiKey = process.env.AGNES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AGNES_API_KEY not configured" }, { status: 500 });
  }

  const userPrompt = orgName
    ? `Restaurant name: ${orgName}. Description: ${description.trim()}`
    : `Description: ${description.trim()}`;

  try {
    const res = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "agnes-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[CONTENT GENERATE] API failed:", res.status, errText);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: "AI returned no content" }, { status: 500 });

    const jsonMatch = content.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonMatch) return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 });

    const result = JSON.parse(jsonMatch);
    return NextResponse.json({
      tagline: String(result.tagline ?? "").slice(0, 200).trim(),
      about: String(result.about ?? "").slice(0, 2000).trim(),
      quota: quota ? { ...quota, plan: tier } : undefined,
    });
  } catch (err) {
    console.error("[CONTENT GENERATE] Failed:", err);
    return NextResponse.json({ error: "Could not generate content. Please try again." }, { status: 500 });
  }
}
