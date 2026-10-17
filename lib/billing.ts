import { LEGACY_PLAN_AED, PLAN_ANNUAL_AED, PLAN_MONTHLY_AED, displayPlan } from "@/lib/pricing";
import { resolveOwnerPlan } from "@/lib/owner-quotas";

/** Minimal admin-client shape we use (keeps unit tests simple). */
type AdminLike = {
  from: (table: string) => any;
};

export type OwnerSubscriptionPayload = {
  plan: "free" | "pro" | "max";
  status: string;
  subscriptionId: string | null;
  customerId: string | null;
  periodEnd: string | null;
};

/** All org IDs where this auth user is owner. */
export async function getOwnerOrgIds(
  admin: AdminLike,
  ownerAuthUserId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from("staff_users")
    .select("org_id")
    .eq("auth_user_id", ownerAuthUserId)
    .eq("role", "owner");
  if (error || !data) return [];
  const ids = (data as Array<{ org_id?: string }>)
    .map((r) => r.org_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return Array.from(new Set(ids));
}

/** Owner auth_user_id for a given org (role=owner). */
export async function getOwnerIdForOrg(
  admin: AdminLike,
  orgId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("staff_users")
    .select("auth_user_id")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  const row = data as { auth_user_id?: string } | null;
  return row?.auth_user_id ?? null;
}

/** Owner auth_user_id for an org slug. */
export async function getOwnerIdForOrgSlug(
  admin: AdminLike,
  orgSlug: string,
): Promise<{ ownerId: string | null; orgId: string | null }> {
  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();
  const orgId = (org as { id?: string } | null)?.id ?? null;
  if (!orgId) return { ownerId: null, orgId: null };
  const ownerId = await getOwnerIdForOrg(admin, orgId);
  return { ownerId, orgId };
}

/**
 * Infer plan from a Stripe price unit_amount (minor units, e.g. fils).
 * Matches monthly + annual AED amounts so old subscriptions without
 * metadata.plan still resolve correctly.
 */
export function inferPlanFromUnitAmount(
  unitAmount: number | null | undefined,
  currency?: string | null,
): "pro" | "max" | null {
  if (!unitAmount) return null;
  // Only AED prices are ours; ignore anything else.
  if (currency && currency.toLowerCase() !== "aed") return null;
  const aed = Math.round(unitAmount / 100);
  if (aed === PLAN_MONTHLY_AED.pro || aed === PLAN_ANNUAL_AED.pro || LEGACY_PLAN_AED.pro.includes(aed)) return "pro";
  if (aed === PLAN_MONTHLY_AED.max || aed === PLAN_ANNUAL_AED.max || LEGACY_PLAN_AED.max.includes(aed)) return "max";
  return null;
}

/** Read unit_amount + currency off a Stripe subscription's first item. */
export function inferPlanFromSubscription(
  sub: {
    metadata?: Record<string, string | undefined> | null;
    items?: {
      data?: Array<{ price?: { unit_amount?: number | null; currency?: string | null } | null }> | null;
    } | null;
  },
): "pro" | "max" | null {
  const metaPlan = sub.metadata?.plan;
  if (metaPlan === "pro" || metaPlan === "max") return metaPlan;
  const price = sub.items?.data?.[0]?.price;
  return inferPlanFromUnitAmount(price?.unit_amount, price?.currency);
}

/** Stripe subscription status -> our subscription_status column. */
export function toDbStatus(
  stripeStatus: string,
  cancelAtPeriodEnd?: boolean,
): "active" | "past_due" | "canceled" {
  if (cancelAtPeriodEnd === true && stripeStatus === "active") return "canceled";
  if (stripeStatus === "active") return "active";
  if (stripeStatus === "past_due") return "past_due";
  return "canceled";
}

/** Canceling is immediate: canceled status always shows Free. */
export function toDbPlan(
  plan: "pro" | "max" | "free" | null | undefined,
  dbStatus: string,
): "free" | "pro" | "max" {
  if (dbStatus === "canceled") return "free";
  return plan === "pro" || plan === "max" ? plan : "free";
}

/**
 * Fan-out write: apply the same subscription row to every org the owner holds.
 * Keeps the legacy per-org columns mirrored so every surface (console badge,
 * dashboard, quota resolver) agrees without a schema migration.
 */
export async function applySubscriptionToOwnerOrgs(
  admin: AdminLike,
  orgIds: string[],
  payload: OwnerSubscriptionPayload,
) {
  if (orgIds.length === 0) return { error: new Error("No orgs to update") as Error | null };
  const update: Record<string, string | null> = {
    subscription_plan: payload.plan,
    subscription_status: payload.status,
    stripe_subscription_id: payload.subscriptionId,
    subscription_current_period_end: payload.periodEnd,
  };
  if (payload.customerId) update.stripe_customer_id = payload.customerId;
  const { error } = await admin
    .from("organizations")
    .update(update)
    .in("id", orgIds);
  return { error: (error as Error | null) ?? null };
}

/** Owner plan = highest tier across owned org rows (status-aware). */
export function computeOwnerPlan(
  orgRows: Array<{ subscription_plan?: unknown; subscription_status?: unknown }>,
): "free" | "pro" | "max" {
  const plans = orgRows.map((o) => displayPlan(o.subscription_plan, o.subscription_status ?? null));
  return resolveOwnerPlan(plans);
}
