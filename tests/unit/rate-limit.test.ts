/**
 * tests/unit/rate-limit.test.ts
 * Covers lib/rate-limit.ts — in-memory sliding-window limiter added for MVP hardening.
 * Proves: allow-until-limit, block with 429 shape, per-key isolation, IP extraction,
 * and PLAN_AI_LIMITS matches marketing copy (lib/marketing-plans.ts).
 */
import { describe, it, expect } from "vitest";
import { rateLimit, getClientIp, rateLimitedResponse, PLAN_AI_LIMITS } from "@/lib/rate-limit";
import { MARKETING_PLANS } from "@/lib/marketing-plans";

describe("rateLimit sliding window", () => {
  it("allows up to limit then blocks", () => {
    const key = `test-allow-${Date.now()}-${Math.random()}`;
    expect(rateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(rateLimit(key, 3, 60_000).allowed).toBe(true);
    const third = rateLimit(key, 3, 60_000);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
    const fourth = rateLimit(key, 3, 60_000);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.resetMs).toBeGreaterThan(0);
  });

  it("isolates keys (one abusive IP doesn't block others)", () => {
    const a = `iso-a-${Date.now()}-${Math.random()}`;
    const b = `iso-b-${Date.now()}-${Math.random()}`;
    rateLimit(a, 1, 60_000);
    expect(rateLimit(a, 1, 60_000).allowed).toBe(false);
    expect(rateLimit(b, 1, 60_000).allowed).toBe(true);
  });

  it("returns 429 JSON with Retry-After header", async () => {
    const res = rateLimitedResponse(1500);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("2");
    const body = await res.json();
    expect(body.error).toMatch(/too many requests/i);
  });
});

describe("getClientIp", () => {
  it("prefers x-forwarded-for first entry", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip then unknown", () => {
    expect(getClientIp(new Request("http://localhost/", { headers: { "x-real-ip": "9.9.9.9" } }))).toBe("9.9.9.9");
    expect(getClientIp(new Request("http://localhost/"))).toBe("unknown");
  });
});

describe("PLAN_AI_LIMITS matches marketing copy", () => {
  it("scan/image quotas equal the numbers shown on the marketing page", () => {
    const free = MARKETING_PLANS.find((p) => p.planKey === null)!;
    const pro = MARKETING_PLANS.find((p) => p.planKey === "pro")!;
    const max = MARKETING_PLANS.find((p) => p.planKey === "max")!;
    expect(free.features.join(" ")).toContain(`${PLAN_AI_LIMITS.free.scan} AI menu scanner`);
    expect(free.features.join(" ")).toContain(`${PLAN_AI_LIMITS.free.image} AI image`);
    expect(pro.features.join(" ")).toContain(`${PLAN_AI_LIMITS.pro.scan} AI menu scanner`);
    expect(pro.features.join(" ")).toContain(`${PLAN_AI_LIMITS.pro.image} AI image`);
    expect(max.features.join(" ")).toContain(`${PLAN_AI_LIMITS.max.scan} AI menu scanner`);
    expect(max.features.join(" ")).toContain(`${PLAN_AI_LIMITS.max.image} AI image`);
  });

  it("chatbot caps are generous (marketing says unlimited, we brake abuse)", () => {
    expect(PLAN_AI_LIMITS.free.chatbotPerDay).toBeGreaterThanOrEqual(100);
    expect(PLAN_AI_LIMITS.pro.chatbotPerDay).toBeGreaterThanOrEqual(500);
  });
});
