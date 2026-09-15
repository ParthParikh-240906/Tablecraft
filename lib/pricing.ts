import Stripe from "stripe";

/**
 * Tablecraft pricing configuration.
 *
 * Each plan has a recurring monthly charge (mode: "subscription").
 * No setup fee — just one monthly price.
 *
 * Stripe Products & Prices are auto-created on first use via ensurePriceIds().
 */

export const PLAN_MONTHLY_AED: Record<"pro" | "max", number> = {
  pro: 500,
  max: 850,
};

/** Human-readable plan labels. */
export const PLAN_LABELS = {
  pro: "Pro",
  max: "Max",
  free: "Free",
} as const;

/** Valid paid plan identifiers (excludes "free"). */
export type PaidPlanKey = "pro" | "max";

/** All plan identifiers. */
export type PlanKey = keyof typeof PLAN_LABELS;

/** Full plan config for a paid plan. */
export function getPlanConfig(plan: PaidPlanKey) {
  return {
    label: PLAN_LABELS[plan],
    monthlyAed: PLAN_MONTHLY_AED[plan],
  };
}

// ─── Cached Stripe Price IDs ────────────────────────────────────────────────

type PriceIds = {
  proMonthly: string;
  maxMonthly: string;
};

let _priceIds: PriceIds | null = null;

/** Look up an existing price on a product that matches the expected amount/type. */
async function findPriceById(
  stripe: Stripe,
  productId: string,
  unitAmount: number,
  isRecurring: boolean,
): Promise<string | null> {
  const page = await stripe.prices.list({ product: productId, limit: 100 });
  return page.data.find((p) => p.unit_amount === unitAmount && p.active === true && (!isRecurring || p.type === "recurring"))?.id ?? null;
}

/**
 * Ensures all Stripe Prices exist (2 recurring monthly).
 * Auto-creates on first run using your Stripe account.
 * Safe to call multiple times — finds or creates, never collides with cached idempotency keys.
 */
export async function ensurePriceIds(stripe: Stripe): Promise<PriceIds> {
  if (_priceIds) return _priceIds;

  // List all existing products to avoid duplicates
  const existingProducts = await stripe.products.list({ limit: 100 });

  const created: PriceIds = { proMonthly: "", maxMonthly: "" };

  for (const plan of ["pro", "max"] as PaidPlanKey[]) {
    const cfg = getPlanConfig(plan);

    // ── Monthly recurring ──
    let product = existingProducts.data.find((p) => p.name === `Tablecraft ${cfg.label} — Monthly`);
    if (!product) {
      product = await stripe.products.create({
        name: `Tablecraft ${cfg.label} — Monthly`,
        description: `Monthly subscription for ${cfg.label} plan`,
      });
    }
    const existingMonthlyPrice = await findPriceById(stripe, product.id, cfg.monthlyAed * 100, true);
    if (existingMonthlyPrice) {
      created[`${plan}Monthly`] = existingMonthlyPrice;
    } else {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: cfg.monthlyAed * 100,
        currency: "aed",
        recurring: { interval: "month" },
      });
      created[`${plan}Monthly`] = price.id;
      console.log(`[pricing] Created ${plan} monthly price: ${price.id}`);
    }
  }

  _priceIds = created;
  return _priceIds;
}

/** Get the monthly recurring price ID for a plan. */
export async function getMonthlyPriceId(stripe: Stripe, plan: PaidPlanKey): Promise<string> {
  const ids = await ensurePriceIds(stripe);
  return ids[`${plan}Monthly`];
}
