import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePlanTier, type PlanTier } from "@/lib/rate-limit";
import { sendQuotaWarningEmail } from "@/lib/email";

/**
 * lib/owner-quotas.ts — per-OWNER monthly quotas (new source of truth).
 *
 * User requirement: if 1 owner has 3 restaurants, all 3 share one quota pool.
 * Old code tracked per-org (ai-{kind}:org:{orgId}). New code keys by owner
 * (owner:{ownerId}:{category}:{YYYY-MM}) so usage aggregates across orgs.
 *
 * Limits (monthly, except restaurant_create which is lifetime total):
 *   free: chatbot 50, scans 20, create 1, edit 3, image 10
 *   pro:  chatbot 300, scans 60, create 5, edit 30, image 100
 *   max:  chatbot 1000, scans 140, create 20, edit 100, image 300
 *
 * `menu_scanner` is the shared AI-scan pool: menu scans and inventory scans
 * both consume it.
 *
 * Persistence note: in-memory Map (per serverless instance) like lib/rate-limit.
 * A Supabase migration (0034) adds owner_usage_monthly + owner_quota_warnings
 * for durable counting — code tries DB first and falls back to memory when the
 * tables are absent, so it works before/after `supabase db push`.
 */

export type QuotaCategory =
  | "chatbot"
  | "menu_scanner"
  | "restaurant_create"
  | "edit"
  | "image";

export const OWNER_QUOTAS: Record<PlanTier, Record<QuotaCategory, number>> = {
  free: { chatbot: 50, menu_scanner: 20, restaurant_create: 1, edit: 3, image: 10 },
  pro: { chatbot: 300, menu_scanner: 60, restaurant_create: 5, edit: 30, image: 100 },
  max: { chatbot: 1000, menu_scanner: 140, restaurant_create: 20, edit: 100, image: 300 },
};

export function getOwnerQuotaLimit(plan: PlanTier, category: QuotaCategory): number {
  return OWNER_QUOTAS[plan][category];
}

/** Owner plan = highest tier among orgs they own (max > pro > free). */
export function resolveOwnerPlan(plans: Array<string | null | undefined>): PlanTier {
  const tiers = plans.map((p) => normalizePlanTier(p));
  if (tiers.includes("max")) return "max";
  if (tiers.includes("pro")) return "pro";
  return "free";
}

function monthBucket(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function msUntilMonthEnd(now: number = Date.now()): number {
  const d = new Date(now);
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return Math.max(1, end - now);
}

// ─── In-memory fallback stores ──────────────────────────────────────────────
const usageBuckets = new Map<string, number[]>();
const warnedKeys = new Set<string>();

function ownerKey(ownerId: string, category: QuotaCategory, month: string) {
  return `owner:${ownerId}:${category}:${month}`;
}

export type OwnerQuotaStatus = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetMs: number;
};

function memoryCheck(
  ownerId: string,
  category: QuotaCategory,
  limit: number,
  now: number,
): OwnerQuotaStatus {
  const month = monthBucket(new Date(now));
  const key = ownerKey(ownerId, category, month);
  const windowMs = msUntilMonthEnd(now);
  const cutoff = now - windowMs;
  const hits = (usageBuckets.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    usageBuckets.set(key, hits);
    const oldest = hits[0] ?? cutoff;
    return { allowed: false, used: hits.length, limit, remaining: 0, resetMs: Math.max(0, oldest + windowMs - now) };
  }
  hits.push(now);
  usageBuckets.set(key, hits);
  return { allowed: true, used: hits.length, limit, remaining: limit - hits.length, resetMs: windowMs };
}

export function peekOwnerQuota(
  ownerId: string,
  plan: PlanTier,
  category: QuotaCategory,
  now: number = Date.now(),
): { used: number; limit: number; remaining: number } {
  const limit = getOwnerQuotaLimit(plan, category);
  if (category === "restaurant_create") {
    // Lifetime quota — callers compare DB org count directly; memory peek is 0.
    return { used: 0, limit, remaining: limit };
  }
  const month = monthBucket(new Date(now));
  const key = ownerKey(ownerId, category, month);
  const windowMs = msUntilMonthEnd(now);
  const cutoff = now - windowMs;
  const hits = (usageBuckets.get(key) ?? []).filter((t) => t > cutoff);
  const used = Math.min(hits.length, limit);
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/** DB-backed peek at per-owner monthly usage (no consumption). Falls back to memory. */
export async function peekOwnerQuotaDb(
  ownerId: string,
  plan: PlanTier,
  category: Exclude<QuotaCategory, "restaurant_create">,
): Promise<{ used: number; limit: number; remaining: number }> {
  const limit = getOwnerQuotaLimit(plan, category);
  try {
    const admin = createAdminClient();
    const month = monthBucket();
    const { data, error } = await admin
      .from("owner_usage_monthly")
      .select("used")
      .eq("owner_id", ownerId)
      .eq("category", category)
      .eq("month", month)
      .maybeSingle();
    if (error) throw error;
    const used = Math.max(0, Math.min((data as { used?: number } | null)?.used ?? 0, limit));
    return { used, limit, remaining: Math.max(0, limit - used) };
  } catch {
    return peekOwnerQuota(ownerId, plan, category);
  }
}

// ─── DB-backed helpers (best-effort, fail-open to memory) ──────────────────

async function dbIncrementUsage(
  ownerId: string,
  category: QuotaCategory,
  month: string,
): Promise<number | null> {
  try {
    const admin = createAdminClient();
    // Try to read existing row
    const { data, error } = await admin
      .from("owner_usage_monthly")
      .select("used")
      .eq("owner_id", ownerId)
      .eq("category", category)
      .eq("month", month)
      .maybeSingle();
    if (error && (error.code === "PGRST204" || error.message?.includes("owner_usage_monthly") || error.message?.includes("does not exist") || error.message?.includes("schema cache"))) {
      return null; // table missing → memory fallback
    }
    const next = ((data as { used?: number } | null)?.used ?? 0) + 1;
    const { error: upErr } = await admin.from("owner_usage_monthly").upsert(
      { owner_id: ownerId, category, month, used: next, updated_at: new Date().toISOString() },
      { onConflict: "owner_id,category,month" },
    );
    if (upErr) return null;
    return next;
  } catch {
    return null;
  }
}

async function dbAlreadyWarned(ownerId: string, category: QuotaCategory, month: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("owner_quota_warnings")
      .select("warned_at")
      .eq("owner_id", ownerId)
      .eq("category", category)
      .eq("month", month)
      .maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

async function dbMarkWarned(ownerId: string, category: QuotaCategory, month: string) {
  try {
    const admin = createAdminClient();
    await admin.from("owner_quota_warnings").upsert(
      { owner_id: ownerId, category, month, warned_at: new Date().toISOString() },
      { onConflict: "owner_id,category,month" },
    );
  } catch {
    // non-fatal
  }
}

async function maybeSend75Warning(opts: {
  ownerId: string;
  ownerEmail: string | null;
  category: QuotaCategory;
  used: number;
  limit: number;
  month: string;
}) {
  const { ownerId, ownerEmail, category, used, limit, month } = opts;
  if (!ownerEmail || limit <= 0) return;
  const pct = used / limit;
  if (pct < 0.75 || pct >= 1) return; // only the 75%–99% band, once
  const memKey = `${ownerKey(ownerId, category, month)}:warned75`;
  if (warnedKeys.has(memKey)) return;
  if (await dbAlreadyWarned(ownerId, category, month)) {
    warnedKeys.add(memKey);
    return;
  }
  warnedKeys.add(memKey);
  await dbMarkWarned(ownerId, category, month);
  // Fire-and-forget (don't block the API response on email latency)
  void sendQuotaWarningEmail(ownerEmail, category, used, limit).catch(() => {});
}

/**
 * Check AND consume 1 unit of per-owner monthly quota.
 * For restaurant_create (lifetime), pass currentCount instead — no consumption here.
 */
export async function checkOwnerQuota(opts: {
  ownerId: string;
  plan: PlanTier;
  category: Exclude<QuotaCategory, "restaurant_create">;
  ownerEmail?: string | null;
  now?: number;
}): Promise<OwnerQuotaStatus> {
  const now = opts.now ?? Date.now();
  const limit = getOwnerQuotaLimit(opts.plan, opts.category);
  const month = monthBucket(new Date(now));

  // Prefer DB counter when tables exist (durable across instances)
  const dbUsed = await dbIncrementUsage(opts.ownerId, opts.category, month);
  if (dbUsed !== null) {
    const allowed = dbUsed <= limit;
    const status: OwnerQuotaStatus = {
      allowed,
      used: Math.min(dbUsed, limit + 1),
      limit,
      remaining: Math.max(0, limit - dbUsed),
      resetMs: msUntilMonthEnd(now),
    };
    if (allowed) {
      await maybeSend75Warning({
        ownerId: opts.ownerId,
        ownerEmail: opts.ownerEmail ?? null,
        category: opts.category,
        used: dbUsed,
        limit,
        month,
      });
    }
    return status;
  }

  // Memory fallback
  const mem = memoryCheck(opts.ownerId, opts.category, limit, now);
  if (mem.allowed) {
    await maybeSend75Warning({
      ownerId: opts.ownerId,
      ownerEmail: opts.ownerEmail ?? null,
      category: opts.category,
      used: mem.used,
      limit,
      month,
    });
  }
  return mem;
}

/** Lifetime check for restaurant creation (no consumption — caller creates the org). */
export function checkRestaurantCreateAllowed(currentCount: number, plan: PlanTier): { allowed: boolean; used: number; limit: number; remaining: number } {
  const limit = getOwnerQuotaLimit(plan, "restaurant_create");
  return { allowed: currentCount < limit, used: currentCount, limit, remaining: Math.max(0, limit - currentCount) };
}

export function ownerQuotaExceededResponse(used: number, limit: number, label: string) {
  return NextResponse.json(
    { error: `Monthly ${label} limit reached (${used}/${limit} used across all your restaurants). Upgrade for more.` },
    { status: 429 },
  );
}

// ─── Owner resolution (org → owner) ─────────────────────────────────────────

/** Find the owner auth_user_id + email for an org (role=owner). */
export async function getOwnerForOrg(orgId: string): Promise<{ ownerId: string | null; ownerEmail: string | null }> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("staff_users")
      .select("auth_user_id, email")
      .eq("org_id", orgId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    const row = data as { auth_user_id?: string; email?: string } | null;
    return { ownerId: row?.auth_user_id ?? null, ownerEmail: row?.email ?? null };
  } catch {
    return { ownerId: null, ownerEmail: null };
  }
}

/** Aggregate owner plan + email + org count across all orgs they own. */
export async function getOwnerPlanContext(authUserId: string): Promise<{
  plan: PlanTier;
  email: string | null;
  orgCount: number;
  orgIds: string[];
}> {
  try {
    const admin = createAdminClient();
    const { data: rows, error } = await admin
      .from("staff_users")
      .select("org_id, email, organizations(subscription_plan, subscription_status)")
      .eq("auth_user_id", authUserId)
      .eq("role", "owner");
    if (error || !rows) return { plan: "free", email: null, orgCount: 0, orgIds: [] };
    const { displayPlan } = await import("@/lib/pricing");
    const plans: string[] = [];
    const orgIds: string[] = [];
    let email: string | null = null;
    for (const r of rows as Array<{ org_id?: string; email?: string; organizations?: unknown }>) {
      if (r.org_id) orgIds.push(r.org_id);
      if (!email && typeof r.email === "string") email = r.email;
      const org = Array.isArray(r.organizations) ? r.organizations[0] : (r.organizations as { subscription_plan?: string; subscription_status?: string } | null);
      // Status-aware: a canceled subscription shows (and quotas) as Free even
      // if the raw subscription_plan row still holds a paid value.
      if (org?.subscription_plan) plans.push(displayPlan(org.subscription_plan, org?.subscription_status ?? null));
    }
    return { plan: resolveOwnerPlan(plans), email, orgCount: orgIds.length, orgIds };
  } catch {
    return { plan: "free", email: null, orgCount: 0, orgIds: [] };
  }
}
