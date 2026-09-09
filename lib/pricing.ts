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
  pro: 3000,
  max: 3000,
};

export const PLAN_MONTHLY_AED: Record<"pro" | "max", number> = {
  pro: 200,
  max: 300,
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

/**
 * Ensures all 4 Stripe Prices exist (2 one-time setup fees + 2 recurring monthly).
 * Auto-creates on first run using your Stripe account.
 * Safe to call multiple times — uses idempotency keys.
 */
export async function ensurePriceIds(stripe: Stripe): Promise<PriceIds> {
  if (_priceIds) return _priceIds;

  // List all existing products to avoid duplicates
  const existingProducts = await stripe.products.list({ limit: 100 });

  const created: PriceIds = { proSetup: "", maxSetup: "", proMonthly: "", maxMonthly: "" };

  for (const plan of ["pro", "max"] as PaidPlanKey[]) {
    const cfg = getPlanConfig(plan);

    // ── One-time setup fee price ──
    const setupProduct = existingProducts.data.find(
      (p) => p.name === `Tablecraft ${cfg.label} — Setup Fee`,
    );

    if (setupProduct?.default_price && typeof setupProduct.default_price !== "string") {
      created[`${plan}Setup`] = setupProduct.default_price.id;
    } else {
      const product = await stripe.products.create(
        {
          name: `Tablecraft ${cfg.label} — Setup Fee`,
          description: `One-time setup fee for ${cfg.label} plan`,
        },
        { idempotencyKey: `tablecraft-setup-${plan}` },
      );
      const price = await stripe.prices.create(
        {
          product: product.id,
          unit_amount: cfg.setupFeeAed * 100, // AED in fils
          currency: "aed",
        },
        { idempotencyKey: `tablecraft-setup-price-${plan}` },
      );
      created[`${plan}Setup`] = price.id;
      console.log(`[pricing] Created ${plan} setup price: ${price.id}`);
    }

    // ── Monthly recurring price ──
    const monthlyProduct = existingProducts.data.find(
      (p) => p.name === `Tablecraft ${cfg.label} — Monthly`,
    );

    if (monthlyProduct?.default_price && typeof monthlyProduct.default_price !== "string") {
      created[`${plan}Monthly`] = monthlyProduct.default_price.id;
    } else {
      const product = await stripe.products.create(
        {
          name: `Tablecraft ${cfg.label} — Monthly`,
          description: `Monthly subscription for ${cfg.label} plan`,
        },
        { idempotencyKey: `tablecraft-monthly-${plan}` },
      );
      const price = await stripe.prices.create(
        {
          product: product.id,
          unit_amount: cfg.monthlyAed * 100, // AED in fils
          currency: "aed",
          recurring: { interval: "month" },
        },
        { idempotencyKey: `tablecraft-monthly-price-${plan}` },
      );
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
