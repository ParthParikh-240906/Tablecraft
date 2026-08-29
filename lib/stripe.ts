import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  // We log a warning if STRIPE_SECRET_KEY is missing in development
  console.warn("STRIPE_SECRET_KEY is not defined in environment variables");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2025-02-24.acacia" as unknown as Stripe.LatestApiVersion,
});