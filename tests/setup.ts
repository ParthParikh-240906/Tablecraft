/**
 * tests/setup.ts
 * Runs before every test file (see vitest.config.ts `setupFiles`).
 *
 * Route modules read env vars AT IMPORT TIME (e.g. lib/stripe.ts throws
 * when STRIPE_SECRET_KEY is missing). Dummy values let validation-layer
 * tests import the real handlers without credentials or network.
 * Tests that need DB/Stripe behavior mock those clients explicitly.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.STRIPE_SECRET_KEY ??= "sk_test_dummy";
process.env.ORDER_VIEW_SECRET ??= "test-order-view-secret";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
