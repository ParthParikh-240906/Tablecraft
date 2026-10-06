/**
 * tests/api/contact.test.ts
 * Live tests against app/api/contact/route.ts — no mocks needed
 * (validation happens before any external call; without RESEND_API_KEY
 * the route logs + returns success).
 */
import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/contact/route";

const req = (body: unknown) =>
  new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /api/contact", () => {
  it("400 on invalid JSON body", async () => {
    const res = await POST(new Request("http://localhost/api/contact", { method: "POST", body: "not-json{{{" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  });

  it("400 when name too short", async () => {
    const res = await POST(req({ name: "A", email: "a@b.com", message: "hello world, this is long enough" }));
    expect(res.status).toBe(400);
  });

  it("400 on invalid email", async () => {
    const res = await POST(req({ name: "Ali", email: "not-an-email", message: "hello world, this is long enough" }));
    expect(res.status).toBe(400);
  });

  it("400 when message too short", async () => {
    const res = await POST(req({ name: "Ali", email: "a@b.com", message: "short" }));
    expect(res.status).toBe(400);
  });

  it("200 success when valid (no RESEND key → logged, not sent)", async () => {
    const res = await POST(
      req({ name: "Ali", email: "Ali@Example.com", message: "Hello, I want to open a restaurant with Tablecraft!" })
    );
    // Without RESEND_API_KEY the route returns success; with a key it may 502 if delivery fails.
    // Either way it must return JSON with a clear contract.
    expect([200, 502]).toContain(res.status);
    const data = await res.json();
    if (res.status === 200) expect(data.success).toBe(true);
    else expect(data).toHaveProperty("error");
  });
});
