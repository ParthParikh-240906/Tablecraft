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
