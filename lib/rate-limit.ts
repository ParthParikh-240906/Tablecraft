import { NextResponse } from "next/server";

/**
 * In-memory token bucket / sliding-window rate limiter.
 *
 * No new deps — a module-level Map<string, number[]> of hit timestamps.
 * Note: in-memory state is per serverless instance, so this is a
 * best-effort abuse brake, not a hard global quota. Monthly AI quotas
 * (PLAN_AI_LIMITS) are enforced separately where the org is known.
 */

const buckets = new Map<string, number[]>();

/** Monthly AI quotas per plan (from lib/marketing-plans.ts). Chatbot bookings are unlimited in marketing copy — capped here generously to prevent AI bill burn. */
export const PLAN_AI_LIMITS = {
  free: { scan: 10, image: 5, chatbotPerDay: 100 },
  pro: { scan: 15, image: 10, chatbotPerDay: 500 },
  max: { scan: 40, image: 25, chatbotPerDay: 500 },
} as const;

export type PlanTier = keyof typeof PLAN_AI_LIMITS;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const existing = buckets.get(key) ?? [];
  const hits = existing.filter((t) => t > cutoff);

  if (hits.length >= limit) {
    const oldest = hits[0] ?? cutoff;
    buckets.set(key, hits);
    return { allowed: false, remaining: 0, resetMs: Math.max(0, oldest + windowMs - now) };
  }

  hits.push(now);
  buckets.set(key, hits);

  // Opportunistic cleanup so the map can't grow unbounded.
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) {
      const fresh = v.filter((t) => t > cutoff);
      if (fresh.length === 0) buckets.delete(k);
      else buckets.set(k, fresh);
      if (buckets.size < 5000) break;
    }
  }

  return { allowed: true, remaining: limit - hits.length, resetMs: windowMs };
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  return "unknown";
}

/** 429 JSON response with a Retry-After header (seconds, rounded up). */
export function rateLimitedResponse(resetMs: number) {
  const retryAfter = Math.max(1, Math.ceil(resetMs / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/* ── Monthly AI quotas (additive helpers; existing exports untouched) ────────
 * Used by /api/design/ai-generate and /api/content/generate to enforce the
 * marketed per-plan monthly limits (PLAN_AI_LIMITS) per org.
 * Same caveat as above: in-memory per serverless instance, so a best-effort
 * abuse brake, not a hard global counter. When the org's plan cannot be
 * resolved, callers fall back to the Free-tier limit (safe default).
 */

export type AiQuotaKind = "image" | "content";

/**
 * Monthly AI website-copy generations per plan. Marketing lists the content
 * generator as included on all plans (no marketed cap), so these are
 * generous anti-abuse monthly caps, not marketed quotas.
 */
export const AI_CONTENT_MONTHLY_LIMITS = {
  free: 30,
  pro: 60,
  max: 150,
} as const;

/** Normalize a raw subscription_plan value to a known tier (safe default: free). */
export function normalizePlanTier(raw: unknown): PlanTier {
  return raw === "pro" || raw === "max" ? raw : "free";
}

/** Monthly generation limit for an AI quota kind on a plan tier. */
export function getAiMonthlyLimit(tier: PlanTier, kind: AiQuotaKind): number {
  if (kind === "content") return AI_CONTENT_MONTHLY_LIMITS[tier];
  return PLAN_AI_LIMITS[tier].image;
}

/** "2026-10" style UTC month bucket key. */
export function monthBucket(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Milliseconds from now until the end of the current UTC month (quota window). */
export function msUntilMonthEnd(now: number = Date.now()): number {
  const d = new Date(now);
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return Math.max(1, end - now);
}

function aiQuotaKey(orgId: string, kind: AiQuotaKind, now: number): { key: string; windowMs: number } {
  return {
    key: `ai-${kind}:org:${orgId}:${monthBucket(new Date(now))}`,
    windowMs: msUntilMonthEnd(now),
  };
}

export type AiQuotaStatus = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetMs: number;
};

/**
 * Check AND consume one unit of monthly AI quota for an org.
 * Only allowed attempts consume quota; blocked attempts do not.
 */
export function checkAiQuota(opts: {
  orgId: string;
  tier: PlanTier;
  kind: AiQuotaKind;
  now?: number;
}): AiQuotaStatus {
  const now = opts.now ?? Date.now();
  const limit = getAiMonthlyLimit(opts.tier, opts.kind);
  const { key, windowMs } = aiQuotaKey(opts.orgId, opts.kind, now);
  const r = rateLimit(key, limit, windowMs);
  return { allowed: r.allowed, used: limit - r.remaining, limit, remaining: r.remaining, resetMs: r.resetMs };
}

/** Non-consuming peek at monthly AI usage (for quota hint UI). */
export function peekAiQuota(opts: {
  orgId: string;
  tier: PlanTier;
  kind: AiQuotaKind;
  now?: number;
}): { used: number; limit: number; remaining: number } {
  const now = opts.now ?? Date.now();
  const limit = getAiMonthlyLimit(opts.tier, opts.kind);
  const { key, windowMs } = aiQuotaKey(opts.orgId, opts.kind, now);
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  const used = Math.min(hits.length, limit);
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/** 429 JSON for an exhausted monthly AI quota. */
export function aiQuotaExceededResponse(used: number, limit: number, label: string) {
  return NextResponse.json(
    { error: `Monthly AI ${label} limit reached (${used}/${limit} used). Upgrade for more.` },
    { status: 429 },
  );
}
