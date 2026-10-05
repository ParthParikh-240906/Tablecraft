/**
 * tests/unit/order-token.test.ts
 * Covers lib/order-token.ts — HMAC signing of public order receipt URLs.
 * Error handling: missing secret → verify always false, never throws.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signOrderToken, verifyOrderToken } from "@/lib/order-token";

const ORDER_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("order-token", () => {
  const OLD_SECRET = process.env.ORDER_VIEW_SECRET;
  const OLD_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    process.env.ORDER_VIEW_SECRET = "test-secret-key";
  });
  afterEach(() => {
    if (OLD_SECRET === undefined) delete process.env.ORDER_VIEW_SECRET;
    else process.env.ORDER_VIEW_SECRET = OLD_SECRET;
    if (OLD_SVC === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = OLD_SVC;
  });

  it("signs deterministically (same order → same token)", () => {
    expect(signOrderToken(ORDER_ID)).toBe(signOrderToken(ORDER_ID));
    expect(signOrderToken(ORDER_ID)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different orders → different tokens", () => {
    expect(signOrderToken("order-a")).not.toBe(signOrderToken("order-b"));
  });

  it("verifies a valid token", () => {
    const token = signOrderToken(ORDER_ID);
    expect(verifyOrderToken(ORDER_ID, token)).toBe(true);
  });

  it("rejects tampered token (timing-safe compare)", () => {
    const token = signOrderToken(ORDER_ID);
    const tampered = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    expect(verifyOrderToken(ORDER_ID, tampered)).toBe(false);
  });

  it("rejects token for wrong order id", () => {
    expect(verifyOrderToken("other-order", signOrderToken(ORDER_ID))).toBe(false);
  });

  it("rejects null/undefined/empty token without throwing", () => {
    expect(verifyOrderToken(ORDER_ID, null)).toBe(false);
    expect(verifyOrderToken(ORDER_ID, undefined)).toBe(false);
    expect(verifyOrderToken(ORDER_ID, "")).toBe(false);
  });

  it("rejects everything when no secret configured", () => {
    delete process.env.ORDER_VIEW_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(verifyOrderToken(ORDER_ID, "anything")).toBe(false);
    // sign still returns a string (HMAC with empty key) but verify short-circuits false
    expect(verifyOrderToken(ORDER_ID, signOrderToken(ORDER_ID))).toBe(false);
  });
});
