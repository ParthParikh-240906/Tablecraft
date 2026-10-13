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
  pro: 150,
  max: 350,
};

/** Annual (yearly) prices in AED — 1 month free (11× monthly). */
export const PLAN_ANNUAL_AED: Record<"pro" | "max", number> = {
  pro: 1650,
  max: 3850,
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
    annualAed: PLAN_ANNUAL_AED[plan],
  };
}

export type BillingInterval = "monthly" | "annual";

/** Savings of annual billing vs 12× monthly, per paid plan. */
export function getAnnualSavings(plan: PaidPlanKey) {
  const monthlyTotal = PLAN_MONTHLY_AED[plan] * 12;
  const annual = PLAN_ANNUAL_AED[plan];
  const savedAed = monthlyTotal - annual;
  const percentOff = Math.round((savedAed / monthlyTotal) * 100);
  return { monthlyTotal, annual, savedAed, percentOff };
}

/** Effective monthly cost when billed annually (rounded to whole AED). */
export function getAnnualMonthlyEquivalent(plan: PaidPlanKey) {
  return Math.round(PLAN_ANNUAL_AED[plan] / 12);
}

/** Largest % saving across paid plans — for "Save up to X%" labels. */
export function getMaxAnnualPercentOff() {
  return Math.max(
    getAnnualSavings("pro").percentOff,
    getAnnualSavings("max").percentOff,
  );
}

// ─── Cached Stripe Price IDs ────────────────────────────────────────────────

type PriceIds = {
  proMonthly: string;
  maxMonthly: string;
  proAnnual: string;
  maxAnnual: string;
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
 * Ensures all Stripe Prices exist (2 monthly + 2 annual).
 * Auto-creates on first run using your Stripe account.
 * Safe to call multiple times — finds or creates, never collides with cached idempotency keys.
 */
export async function ensurePriceIds(stripe: Stripe): Promise<PriceIds> {
  if (_priceIds) return _priceIds;

  // List all existing products to avoid duplicates
  const existingProducts = await stripe.products.list({ limit: 100 });

  const created: PriceIds = { proMonthly: "", maxMonthly: "", proAnnual: "", maxAnnual: "" };

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
      if (process.env.NODE_ENV === "development") {
        console.log(`[pricing] Created ${plan} monthly price: ${price.id}`);
      }
    }

    // ── Annual recurring ──
    let annualProduct = existingProducts.data.find((p) => p.name === `Tablecraft ${cfg.label} — Annual`);
    if (!annualProduct) {
      annualProduct = await stripe.products.create({
        name: `Tablecraft ${cfg.label} — Annual`,
        description: `Annual subscription for ${cfg.label} plan`,
      });
    }
    const existingAnnualPrice = await findPriceById(stripe, annualProduct.id, cfg.annualAed * 100, true);
    if (existingAnnualPrice) {
      created[`${plan}Annual`] = existingAnnualPrice;
    } else {
      const price = await stripe.prices.create({
        product: annualProduct.id,
        unit_amount: cfg.annualAed * 100,
        currency: "aed",
        recurring: { interval: "year" },
      });
      created[`${plan}Annual`] = price.id;
      if (process.env.NODE_ENV === "development") {
        console.log(`[pricing] Created ${plan} annual price: ${price.id}`);
      }
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

/** Get the annual recurring price ID for a plan. */
export async function getAnnualPriceId(stripe: Stripe, plan: PaidPlanKey): Promise<string> {
  const ids = await ensurePriceIds(stripe);
  return ids[`${plan}Annual`];
}

/** Get a price ID for a plan + billing interval. */
export async function getPriceId(stripe: Stripe, plan: PaidPlanKey, interval: BillingInterval = "monthly"): Promise<string> {
  const ids = await ensurePriceIds(stripe);
  return interval === "annual" ? ids[`${plan}Annual`] : ids[`${plan}Monthly`];
}
