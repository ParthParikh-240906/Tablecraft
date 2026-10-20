import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanTier } from "@/lib/rate-limit";

/**
 * lib/capacity.ts — Free-plan concurrent session leases.
 *
 * Free restaurants get 2 combined leases (website + console). Leases live in
 * Postgres so they are shared across serverless instances; the acquire RPC is
 * atomic per org. Paid plans bypass the gate entirely.
 */

export const FREE_SESSION_LIMIT = 2;
export const SLOT_TTL_SECONDS = 120;
export const HEARTBEAT_MS = 30_000;
export const SITE_SESSION_COOKIE = "tc_site_session";

/** Local plan helpers — avoids importing Stripe/pricing into the proxy bundle. */
function displayPlanLocal(plan: unknown, status: unknown): PlanTier {
  const s = typeof status === "string" ? status : "free";
  if (s === "canceled" || s === "canceling") return "free";
  return plan === "pro" || plan === "max" ? plan : "free";
}

function resolveOwnerPlanLocal(plans: PlanTier[]): PlanTier {
  if (plans.includes("max")) return "max";
  if (plans.includes("pro")) return "pro";
  return "free";
}

export type CapacityPlan = {
  plan: PlanTier;
  degraded: boolean;
};

const PLAN_TTL_MS = 60_000;
const planCache = new Map<string, { value: CapacityPlan; expires: number }>();

export function clearCapacityCache() {
  planCache.clear();
}

function cacheGet(orgId: string): CapacityPlan | undefined {
  const hit = planCache.get(orgId);
  if (!hit) return undefined;
  if (hit.expires <= Date.now()) {
    planCache.delete(orgId);
    return undefined;
  }
  return hit.value;
}

function cacheSet(orgId: string, value: CapacityPlan) {
  planCache.set(orgId, { value, expires: Date.now() + PLAN_TTL_MS });
}

/**
 * Owner-wide plan for an org. Fails open (degraded) if the DB is unreachable
 * so an outage never turns every Free site into a 429.
 */
export async function getCapacityPlan(orgId: string): Promise<CapacityPlan> {
  if (!orgId) return { plan: "free", degraded: true };
  const cached = cacheGet(orgId);
  if (cached) return cached;

  try {
    const admin = createAdminClient();
    const { data: ownerRow } = await admin
      .from("staff_users")
      .select("auth_user_id")
      .eq("org_id", orgId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    const owner = ownerRow as { auth_user_id?: string } | null;

    if (owner?.auth_user_id) {
      // Owner-wide plan: highest tier across all orgs the owner holds.
      const { data: ownerOrgRows, error: ownerOrgError } = await admin
        .from("staff_users")
        .select("org_id, organizations(subscription_plan, subscription_status)")
        .eq("auth_user_id", owner.auth_user_id)
        .eq("role", "owner");
      if (ownerOrgError) {
        return { plan: "free", degraded: true };
      }
      const plans = ((ownerOrgRows ?? []) as Array<{ organizations?: unknown }>).map((r) => {
        const o = Array.isArray(r.organizations)
          ? (r.organizations[0] as { subscription_plan?: unknown; subscription_status?: unknown } | undefined)
          : (r.organizations as { subscription_plan?: unknown; subscription_status?: unknown } | null);
        return displayPlanLocal(o?.subscription_plan, o?.subscription_status ?? null);
      });
      const value: CapacityPlan = {
        plan: resolveOwnerPlanLocal(plans),
        degraded: false,
      };
      cacheSet(orgId, value);
      return value;
    }

    // Fallback when no owner row is linked (legacy org): use the mirrored plan.
    const { data: orgRow } = await admin
      .from("organizations")
      .select("subscription_plan, subscription_status")
      .eq("id", orgId)
      .maybeSingle();
    const row = orgRow as { subscription_plan?: unknown; subscription_status?: unknown } | null;
    const value: CapacityPlan = {
      plan: displayPlanLocal(row?.subscription_plan, row?.subscription_status ?? null),
      degraded: false,
    };
    cacheSet(orgId, value);
    return value;
  } catch (err) {
    console.error("getCapacityPlan failed:", err);
    return { plan: "free", degraded: true };
  }
}

export async function getCapacityPlanBySlug(slug: string): Promise<CapacityPlan & { orgId: string | null }> {
  if (!slug) return { plan: "free", degraded: true, orgId: null };
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    const orgId = (data as { id?: string } | null)?.id ?? null;
    if (!orgId) return { plan: "free", degraded: true, orgId: null };
    return { ...(await getCapacityPlan(orgId)), orgId };
  } catch (err) {
    console.error("getCapacityPlanBySlug failed:", err);
    return { plan: "free", degraded: true, orgId: null };
  }
}

export function isFreeGated(plan: CapacityPlan): boolean {
  return !plan.degraded && plan.plan === "free";
}

const BOT_RE =
  /bot|crawler|spider|preview|facebookexternalhit|slackbot|discordbot|twitterbot|linkedinbot|whatsapp|telegrambot|googlebot|bingbot|yandex|baidu|semrush|ahrefs|headless/i;

export function isBot(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent && BOT_RE.test(userAgent));
}

export function newSiteCookieValue(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function getClientIpFromRequest(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function fallbackSiteKey(ip: string, userAgent: string | null): string {
  return `ip:${createHash("sha256").update(`${ip}|${userAgent ?? ""}`).digest("hex").slice(0, 32)}`;
}

export type SlotDecision = {
  allowed: boolean;
  activeCount: number;
  unlimited: boolean;
  degraded: boolean;
  cookieValue: string | null;
};

type RpcRow = { allowed?: boolean; active_count?: number };

async function acquireSlot(opts: {
  orgId: string;
  slotKey: string;
  kind: "site" | "console";
  authUserId?: string | null;
  userAgent?: string | null;
}): Promise<{ allowed: boolean; activeCount: number; degraded: boolean }> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("acquire_org_slot", {
      p_org_id: opts.orgId,
      p_slot_key: opts.slotKey,
      p_kind: opts.kind,
      p_limit: FREE_SESSION_LIMIT,
      p_ttl_seconds: SLOT_TTL_SECONDS,
    });

    if (error) {
      console.error("acquire_org_slot failed:", error);
      return { allowed: true, activeCount: 0, degraded: true };
    }

    const row = (Array.isArray(data) ? data[0] : data) as RpcRow | null;
    if (!row || typeof row.allowed !== "boolean") {
      return { allowed: true, activeCount: 0, degraded: true };
    }
    return {
      allowed: row.allowed,
      activeCount: Number(row.active_count ?? 0),
      degraded: false,
    };
  } catch (err) {
    console.error("acquireSlot failed:", err);
    return { allowed: true, activeCount: 0, degraded: true };
  }
}

export async function acquireSiteSlot(opts: {
  orgId: string;
  cookieValue: string | null;
  ip: string;
  userAgent: string | null;
}): Promise<SlotDecision> {
  const plan = await getCapacityPlan(opts.orgId);
  if (!isFreeGated(plan)) {
    return { allowed: true, activeCount: 0, unlimited: true, degraded: plan.degraded, cookieValue: opts.cookieValue };
  }
  if (isBot(opts.userAgent)) {
    return { allowed: true, activeCount: 0, unlimited: true, degraded: false, cookieValue: opts.cookieValue };
  }

  const isNewCookie = !opts.cookieValue;
  const cookieValue = opts.cookieValue || newSiteCookieValue();
  const slotKey = `site:${cookieValue || fallbackSiteKey(opts.ip, opts.userAgent)}`;
  const result = await acquireSlot({
    orgId: opts.orgId,
    slotKey,
    kind: "site",
    userAgent: opts.userAgent,
  });

  return {
    allowed: result.allowed,
    activeCount: result.activeCount,
    unlimited: false,
    degraded: result.degraded,
    cookieValue: isNewCookie || result.allowed ? cookieValue : opts.cookieValue,
  };
}

export async function acquireConsoleSlot(opts: {
  orgId: string;
  authUserId: string;
  userAgent?: string | null;
}): Promise<SlotDecision> {
  const plan = await getCapacityPlan(opts.orgId);
  if (!isFreeGated(plan)) {
    return { allowed: true, activeCount: 0, unlimited: true, degraded: plan.degraded, cookieValue: null };
  }

  const result = await acquireSlot({
    orgId: opts.orgId,
    slotKey: `console:${opts.authUserId}`,
    kind: "console",
    authUserId: opts.authUserId,
    userAgent: opts.userAgent ?? null,
  });

  return {
    allowed: result.allowed,
    activeCount: result.activeCount,
    unlimited: false,
    degraded: result.degraded,
    cookieValue: null,
  };
}

async function touchSlot(orgId: string, slotKey: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("touch_org_slot", {
      p_org_id: orgId,
      p_slot_key: slotKey,
      p_ttl_seconds: SLOT_TTL_SECONDS,
    });
    if (error) {
      console.error("touch_org_slot failed:", error);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.error("touchSlot failed:", err);
    return false;
  }
}

export async function touchSiteSlot(orgId: string, cookieValue: string | null): Promise<boolean> {
  if (!cookieValue) return false;
  return touchSlot(orgId, `site:${cookieValue}`);
}

export async function touchConsoleSlot(orgId: string, authUserId: string): Promise<boolean> {
  return touchSlot(orgId, `console:${authUserId}`);
}

export async function releaseSiteSlot(orgId: string, cookieValue: string | null): Promise<void> {
  if (!cookieValue) return;
  await releaseSlot(orgId, `site:${cookieValue}`);
}

export async function releaseConsoleSlot(orgId: string, authUserId: string): Promise<void> {
  await releaseSlot(orgId, `console:${authUserId}`);
}

async function releaseSlot(orgId: string, slotKey: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc("release_org_slot", { p_org_id: orgId, p_slot_key: slotKey });
  } catch (err) {
    console.error("releaseSlot failed:", err);
  }
}

export function capacityResponse(kind: "site" | "console" = "site") {
  return NextResponse.json(
    {
      error:
        kind === "console"
          ? "This restaurant's console is at capacity (2 active sessions). Try again in a minute."
          : "This site is temporarily at capacity. Please try again in a minute.",
      code: "capacity_reached",
    },
    { status: 429, headers: { "Retry-After": String(SLOT_TTL_SECONDS) } },
  );
}

/**
 * API-side gate for guest actions (bookings/chat/checkout) so the page gate
 * cannot be bypassed with a direct POST.
 */
export async function assertSiteSlot(
  orgId: string,
  request: Request,
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  const plan = await getCapacityPlan(orgId);
  if (!isFreeGated(plan)) return { allowed: true };

  const ua = request.headers.get("user-agent");
  if (isBot(ua)) return { allowed: true };

  const cookie = parseCookie(request.headers.get("cookie"), SITE_SESSION_COOKIE);
  const decision = await acquireSiteSlot({
    orgId,
    cookieValue: cookie,
    ip: getClientIpFromRequest(request),
    userAgent: ua,
  });

  if (!decision.allowed) {
    return { allowed: false, response: capacityResponse("site") };
  }
  return { allowed: true };
}
