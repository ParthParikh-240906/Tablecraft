import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Lazy Stripe client — safe to import at build time without STRIPE_SECRET_KEY set. */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
  }
  _stripe = new Stripe(key, {
    apiVersion: "2025-02-24.acacia" as unknown as Stripe.LatestApiVersion,
  });
  return _stripe;
}

/** Backwards-compat accessor — defers getStripe() until first property access. */
export const stripe = new Proxy({} as Stripe, {
  get(_, p) {
    const value = (getStripe() as unknown as Record<string | symbol, unknown>)[p];
    return typeof value === "function" ? value.bind(getStripe()) : value;
  },
});

/**
 * Publishable key — safe to use on the client side.
 * Empty string when unset; callers should handle the unconfigured case.
 */
export const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
