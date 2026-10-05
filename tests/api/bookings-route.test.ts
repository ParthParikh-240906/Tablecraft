/**
 * tests/api/bookings-route.test.ts
 * Live tests against app/api/bookings/route.ts validation layer.
 * All invalid-input branches return BEFORE any Supabase call,
 * so these run with no DB / no env vars.
 */
import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/bookings/route";

const req = (body: unknown) =>
  new Request("http://localhost/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const future = () => new Date(Date.now() + 3600_000).toISOString();
const valid = () => ({ orgSlug: "demo-diner", customerName: "Ali", partySize: 2, datetime: future() });

describe("POST /api/bookings — error handling", () => {
  it("400 on invalid JSON body", async () => {
    const res = await POST(new Request("http://localhost/api/bookings", { method: "POST", body: "{{{" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/json/i);
  });

  it("400 when orgSlug/orgId missing", async () => {
    const { orgSlug: _omit, ...rest } = valid();
    const res = await POST(req(rest));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/orgSlug/i);
  });

  it("400 on short customerName", async () => {
    const res = await POST(req({ ...valid(), customerName: "A" }));
    expect(res.status).toBe(400);
  });

  it.each([0, 21, 2.5, "4", null])("400 on bad partySize %p", async (partySize) => {
    const res = await POST(req({ ...valid(), partySize }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/partySize/i);
  });

  it("400 on malformed tableIds", async () => {
    const res = await POST(req({ ...valid(), tableIds: [] }));
    expect(res.status).toBe(400);
  });

  it("400 on invalid datetime", async () => {
    const res = await POST(req({ ...valid(), datetime: "yesterday-ish" }));
    expect(res.status).toBe(400);
  });

  it("400 on past datetime", async () => {
    const res = await POST(req({ ...valid(), datetime: new Date(Date.now() - 3600_000).toISOString() }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/past/i);
  });

  it("400 on malformed orgId (UUID check before DB)", async () => {
    const res = await POST(req({ ...valid(), orgSlug: undefined, orgId: "not-a-uuid", customerName: "Ali", partySize: 2, datetime: future() }));
    // Either "orgSlug or orgId required" is bypassed (orgId present) → "Invalid orgId"
    expect(res.status).toBe(400);
  });

  it("never leaks internals — errors are user-friendly JSON", async () => {
    const res = await POST(req({ ...valid(), partySize: 99 }));
    const data = await res.json();
    expect(data).toHaveProperty("error");
    expect(typeof data.error).toBe("string");
    expect(JSON.stringify(data)).not.toMatch(/stack|at Object|node_modules/i);
  });
});
