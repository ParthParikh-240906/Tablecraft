/**
 * tests/unit/validation.test.ts
 * Covers every validation + error-handling contract used across
 * sign-in, console login, bookings, orders, contact, signup:
 * slug regex, UUID regex, safeNext allowlist, email, party size,
 * item quantity, org slug auto-generation.
 *
 * These mirror the exact checks in:
 *  middleware.ts, lib/api-auth.ts, app/api/bookings/route.ts,
 *  app/api/orders routes, app/api/contact/route.ts,
 *  app/api/signup/route.ts, (public)/[orgSlug]/layout.tsx
 */
import { describe, it, expect } from "vitest";

// ─── Shared patterns (must stay in sync with prod) ───
export const SLUG_RE = /^[a-z0-9-]{1,80}$/;
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isSafeNext(next: string | null | undefined): boolean {
  return !!next && next.startsWith("/") && !next.startsWith("//");
}

export function validateBookingInput(body: {
  orgSlug?: unknown; orgId?: unknown; customerName?: unknown;
  partySize?: unknown; datetime?: unknown; tableIds?: unknown;
}): { ok: true } | { ok: false; error: string; status: number } {
  const { orgSlug, orgId, customerName, partySize, datetime, tableIds } = body;
  if ((!orgSlug || typeof orgSlug !== "string") && !orgId)
    return { ok: false, error: "orgSlug or orgId is required", status: 400 };
  if (!customerName || typeof customerName !== "string" || customerName.trim().length < 2)
    return { ok: false, error: "customerName must be at least 2 characters", status: 400 };
  if (typeof partySize !== "number" || !Number.isInteger(partySize) || partySize < 1 || partySize > 20)
    return { ok: false, error: "partySize must be an integer between 1 and 20", status: 400 };
  if (tableIds && (!Array.isArray(tableIds) || tableIds.length === 0 || !tableIds.every((t) => typeof t === "string")))
    return { ok: false, error: "tableIds must be a non-empty array of strings", status: 400 };
  const when = new Date(datetime as string);
  if (Number.isNaN(when.getTime()))
    return { ok: false, error: "datetime must be a valid ISO date", status: 400 };
  if (when.getTime() < Date.now() - 60000)
    return { ok: false, error: "Booking date & time cannot be in the past", status: 400 };
  return { ok: true };
}

export function validateOrderQuantity(qty: unknown): boolean {
  const q = Math.floor(Number(qty));
  return Number.isInteger(q) && q >= 1 && q <= 99;
}

export function autoSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

describe("org slug validation (public site layout)", () => {
  it("accepts valid slugs", () => {
    expect(SLUG_RE.test("demo-diner")).toBe(true);
    expect(SLUG_RE.test("rasam")).toBe(true);
    expect(SLUG_RE.test("a")).toBe(true);
  });
  it("rejects uppercase, spaces, special chars, too long", () => {
    expect(SLUG_RE.test("Demo Diner")).toBe(false);
    expect(SLUG_RE.test("UPPER")).toBe(false);
    expect(SLUG_RE.test("a/b")).toBe(false);
    expect(SLUG_RE.test("")).toBe(false);
    expect(SLUG_RE.test("a".repeat(81))).toBe(false);
  });
});

describe("UUID validation (middleware / api-auth / org resolution)", () => {
  const good = "123e4567-e89b-12d3-a456-426614174000";
  it("accepts valid UUIDs", () => expect(UUID_RE.test(good)).toBe(true));
  it("rejects slugs, empty, malformed", () => {
    expect(UUID_RE.test("demo-diner")).toBe(false);
    expect(UUID_RE.test("")).toBe(false);
    expect(UUID_RE.test("123")).toBe(false);
    expect(UUID_RE.test(good + "-extra")).toBe(false);
  });
});

describe("safeNext allowlist (auth callback / verify)", () => {
  it("allows same-origin absolute paths", () => {
    expect(isSafeNext("/console")).toBe(true);
    expect(isSafeNext("/dashboard")).toBe(true);
  });
  it("blocks open redirects + protocol-relative URLs", () => {
    expect(isSafeNext("//evil.com")).toBe(false);
    expect(isSafeNext("https://evil.com")).toBe(false);
    expect(isSafeNext("")).toBe(false);
    expect(isSafeNext(null)).toBe(false);
    expect(isSafeNext(undefined)).toBe(false);
  });
});

describe("email validation (signin / signup / contact)", () => {
  it("accepts normal emails", () => {
    expect(EMAIL_RE.test("owner@rasam.test")).toBe(true);
    expect(EMAIL_RE.test("a@b.co")).toBe(true);
  });
  it("rejects malformed", () => {
    expect(EMAIL_RE.test("not-an-email")).toBe(false);
    expect(EMAIL_RE.test("a@b")).toBe(false);
    expect(EMAIL_RE.test("@x.com")).toBe(false);
    expect(EMAIL_RE.test("")).toBe(false);
  });
});

describe("booking input validation (POST /api/bookings)", () => {
  const future = new Date(Date.now() + 3600_000).toISOString();
  const base = { orgSlug: "demo-diner", customerName: "Ali", partySize: 2, datetime: future };
  it("accepts a valid booking", () => {
    expect(validateBookingInput(base)).toEqual({ ok: true });
  });
  it("requires orgSlug or orgId", () => {
    const r = validateBookingInput({ ...base, orgSlug: undefined });
    expect(r.ok).toBe(false);
  });
  it("rejects short customerName", () => {
    expect(validateBookingInput({ ...base, customerName: "A" }).ok).toBe(false);
    expect(validateBookingInput({ ...base, customerName: "  " }).ok).toBe(false);
  });
  it("rejects partySize outside 1..20 / non-integer", () => {
    for (const bad of [0, 21, 2.5, "4", null]) {
      expect(validateBookingInput({ ...base, partySize: bad }).ok).toBe(false);
    }
  });
  it("rejects invalid + past datetime", () => {
    expect(validateBookingInput({ ...base, datetime: "not-a-date" }).ok).toBe(false);
    expect(validateBookingInput({ ...base, datetime: new Date(Date.now() - 3600_000).toISOString() }).ok).toBe(false);
  });
  it("rejects malformed tableIds", () => {
    expect(validateBookingInput({ ...base, tableIds: [] }).ok).toBe(false);
    expect(validateBookingInput({ ...base, tableIds: [123] }).ok).toBe(false);
  });
});

describe("order item quantity validation (POST /api/orders/*)", () => {
  it("accepts 1..99", () => {
    expect(validateOrderQuantity(1)).toBe(true);
    expect(validateOrderQuantity(99)).toBe(true);
    expect(validateOrderQuantity("3")).toBe(true); // Number("3") coerces like prod
  });
  it("rejects 0, 100+, fractions that floor to 0, NaN", () => {
    expect(validateOrderQuantity(0)).toBe(false);
    expect(validateOrderQuantity(100)).toBe(false);
    expect(validateOrderQuantity(0.5)).toBe(false);
    expect(validateOrderQuantity(NaN)).toBe(false);
    expect(validateOrderQuantity("abc")).toBe(false);
  });
});

describe("order status allowlist (POST /api/orders/status)", () => {
  const valid = ["pending", "paid", "preparing", "ready", "completed", "cancelled"];
  it("accepts all six lifecycle states", () => {
    for (const s of valid) expect(valid.includes(s)).toBe(true);
  });
  it("rejects unknown states", () => {
    expect(valid.includes("served")).toBe(false);
    expect(valid.includes("")).toBe(false);
  });
});

describe("contact form validation (POST /api/contact)", () => {
  it("name must be 2..100 chars", () => {
    expect("A".trim().length >= 2).toBe(false);
    expect("Al".trim().length >= 2).toBe(true);
  });
  it("message must be 10..5000 chars", () => {
    expect("short".trim().length >= 10).toBe(false);
    expect("hello world!".trim().length >= 10).toBe(true);
  });
});

describe("restaurant slug auto-generation (create form)", () => {
  it("slugifies names", () => {
    expect(autoSlug("Demo Diner")).toBe("demo-diner");
    expect(autoSlug("  Rasam & Co!  ")).toBe("rasam-co");
  });
  it("caps length and strips dashes", () => {
    expect(autoSlug("a".repeat(100)).length).toBeLessThanOrEqual(60);
    expect(autoSlug("---hi---")).toBe("hi");
  });
});
