/**
 * Stripe Price IDs for Tablecraft subscription plans.
 *
 * To get real IDs:
 *   1. Go to https://dashboard.stripe.com/products
 *   2. Create a product for each plan (Pro, Max)
 *   3. Add a recurring price (monthly, in AED)
 *   4. Copy the Price ID (starts with "price_...")
 *   5. Replace the placeholder values below
 *
 * Test-mode prices are used here — swap to live prices when going production.
 */
export const STRIPE_PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_ID_PRO || "price_PRO_placeholder",
  max: process.env.STRIPE_PRICE_ID_MAX || "price_MAX_placeholder",
} as const;

/** Human-readable plan labels matching the PRICING array names. */
export const PLAN_LABELS = {
  pro: "Pro",
  max: "Max",
  free: "Free",
} as const;

/** Valid plan identifiers. */
export type PlanKey = keyof typeof STRIPE_PRICE_IDS;
