/**
 * tests/api/signup-contact-auth.test.ts
 * Validation-layer tests for signup-account, subscription checkout,
 * console login, and demo check routes — all 400 branches run
 * before any Supabase/Stripe call (no env needed).
 */
import { describe, it, expect } from "vitest";
import { POST as signupAccount } from "@/app/api/signup-account/route";
import { POST as checkout } from "@/app/api/subscription/checkout/route";
import { POST as consoleLogin } from "@/app/api/console/login/route";

const req = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /api/signup-account", () => {
  it("400 on invalid JSON", async () => {
    const res = await signupAccount(new Request("http://x/api/signup-account", { method: "POST", body: "{{" }));
    expect(res.status).toBe(400);
  });
  it("400 on bad email", async () => {
    const res = await signupAccount(req("http://x/api/signup-account", { email: "nope", password: "longenoughpassword" }));
    expect(res.status).toBe(400);
  });
  it("400 on short password", async () => {
    const res = await signupAccount(req("http://x/api/signup-account", { email: "a@b.com", password: "short" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/8-128/i);
  });
});

describe("POST /api/subscription/checkout", () => {
  it("400 on invalid JSON", async () => {
    const res = await checkout(new Request("http://x/api/subscription/checkout", { method: "POST", body: "{{" }));
    expect(res.status).toBe(400);
  });
  it("400 on invalid plan", async () => {
    const res = await checkout(req("http://x/api/subscription/checkout", { plan: "free" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/pro.*max|max.*pro/i);
  });
  it("400 on invalid email", async () => {
    const res = await checkout(req("http://x/api/subscription/checkout", { plan: "pro", email: "bad" }));
    expect(res.status).toBe(400);
  });
  it("400 on malformed orgId", async () => {
    const res = await checkout(req("http://x/api/subscription/checkout", { plan: "pro", orgId: "nope" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/console/login", () => {
  it("400 on invalid JSON", async () => {
    const res = await consoleLogin(new Request("http://x/api/console/login", { method: "POST", body: "{{" }));
    expect(res.status).toBe(400);
  });
  it("400/401 when email+password missing (no enumeration beyond 400)", async () => {
    const res = await consoleLogin(req("http://x/api/console/login", {}));
    expect([400, 401]).toContain(res.status);
    expect(await res.json()).toHaveProperty("error");
  });
});
