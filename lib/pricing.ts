import Stripe from "stripe";

/**
 * Tablecraft pricing configuration.
 *
 * Each plan has:
 *   - setupFeeAed: one-time fee charged at signup (mode: "payment")
 *   - monthlyAed: recurring monthly charge (mode: "subscription")
 *
 * Stripe Products & Prices are auto-created on first use via ensurePriceIds().
 */

export const PLAN_SETUP_FEE_AED: Record<"pro" | "max", number> = {
  pro: 1500,
  max: 3500,
};

export const PLAN_MONTHLY_AED: Record<"pro" | "max", number> = {
  pro: 350,
  max: 500,
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
    setupFeeAed: PLAN_SETUP_FEE_AED[plan],
    monthlyAed: PLAN_MONTHLY_AED[plan],
  };
}

// ─── Cached Stripe Price IDs ────────────────────────────────────────────────

type PriceIds = {
  proSetup: string;
  maxSetup: string;
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
 * Ensures all 4 Stripe Prices exist (2 one-time setup fees + 2 recurring monthly).
 * Auto-creates on first run using your Stripe account.
 * Safe to call multiple times — finds or creates, never collides with cached idempotency keys.
 */
export async function ensurePriceIds(stripe: Stripe): Promise<PriceIds> {
  if (_priceIds) return _priceIds;

  // List all existing products to avoid duplicates
  const existingProducts = await stripe.products.list({ limit: 100 });

  const created: PriceIds = { proSetup: "", maxSetup: "", proMonthly: "", maxMonthly: "" };

  for (const plan of ["pro", "max"] as PaidPlanKey[]) {
    const cfg = getPlanConfig(plan);

    // ── One-time setup fee ──
    let product = existingProducts.data.find((p) => p.name === `Tablecraft ${cfg.label} — Setup Fee`);
    if (!product) {
      product = await stripe.products.create({
        name: `Tablecraft ${cfg.label} — Setup Fee`,
        description: `One-time setup fee for ${cfg.label} plan`,
      });
    }
    const existingPrice = await findPriceById(stripe, product.id, cfg.setupFeeAed * 100, false);
    if (existingPrice) {
      created[`${plan}Setup`] = existingPrice;
    } else {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: cfg.setupFeeAed * 100,
        currency: "aed",
      });
      created[`${plan}Setup`] = price.id;
      console.log(`[pricing] Created ${plan} setup price: ${price.id}`);
    }

    // ── Monthly recurring ──
    product = existingProducts.data.find((p) => p.name === `Tablecraft ${cfg.label} — Monthly`);
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

/** Get the one-time setup fee price ID for a plan. */
export async function getSetupFeePriceId(stripe: Stripe, plan: PaidPlanKey): Promise<string> {
  const ids = await ensurePriceIds(stripe);
  return ids[`${plan}Setup`];
}

/** Get the monthly recurring price ID for a plan. */
export async function getMonthlyPriceId(stripe: Stripe, plan: PaidPlanKey): Promise<string> {
  const ids = await ensurePriceIds(stripe);
  return ids[`${plan}Monthly`];
}
