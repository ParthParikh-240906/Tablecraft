/**
 * tests/unit/stripe-lazy.test.ts
 * Covers lib/stripe.ts lazy init — importing the module must never throw
 * (previously killed prerender when STRIPE_SECRET_KEY was unset).
 * getStripe() throws only when called without a key, and memoizes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const OLD_SECRET = process.env.STRIPE_SECRET_KEY;

beforeEach(() => {
  vi.resetModules();
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
});

afterEach(() => {
  if (OLD_SECRET === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = OLD_SECRET;
  vi.resetModules();
});

describe("stripe lazy init", () => {
  it("module import never throws, even without STRIPE_SECRET_KEY", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    await expect(import("@/lib/stripe")).resolves.toBeDefined();
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  });

  it("getStripe throws when called without a key", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const mod = await import("@/lib/stripe");
    expect(() => mod.getStripe()).toThrow(/STRIPE_SECRET_KEY/);
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  });

  it("getStripe memoizes the client", async () => {
    const mod = await import("@/lib/stripe");
    expect(mod.getStripe()).toBe(mod.getStripe());
  });

  it("STRIPE_PUBLISHABLE_KEY is a string (empty when unset, never placeholder)", async () => {
    const mod = await import("@/lib/stripe");
    expect(typeof mod.STRIPE_PUBLISHABLE_KEY).toBe("string");
    expect(mod.STRIPE_PUBLISHABLE_KEY).not.toBe("pk_test_placeholder");
  });
});
