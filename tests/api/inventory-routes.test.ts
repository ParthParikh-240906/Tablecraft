/**
 * Validation-layer tests for the inventory routes. These branches return
 * before touching Supabase, so no env/mocks are needed.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as createItem } from "@/app/api/inventory/items/route";
import { POST as adjustItem } from "@/app/api/inventory/items/[id]/adjust/route";
import { POST as clearNotifications } from "@/app/api/inventory/notifications/clear/route";
import { POST as scanInventory } from "@/app/api/inventory/scan/route";

const jsonPost = (url: string, body: string | unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /api/inventory/items", () => {
  it("400 on invalid JSON", async () => {
    const res = await createItem(jsonPost("http://x/api/inventory/items", "{{"));
    expect(res.status).toBe(400);
  });

  it("400 on invalid org_id", async () => {
    const res = await createItem(jsonPost("http://x/api/inventory/items", { org_id: "nope" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/inventory/items/[id]/adjust", () => {
  it("400 on invalid JSON", async () => {
    const res = await adjustItem(jsonPost("http://x/api/inventory/items/abc/adjust", "{{"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/inventory/notifications/clear", () => {
  it("400 on invalid JSON", async () => {
    const res = await clearNotifications(
      jsonPost("http://x/api/inventory/notifications/clear", "{{"),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/inventory/scan", () => {
  it("400 when the body is not multipart/form-data", async () => {
    const res = await scanInventory(
      new NextRequest("http://x/api/inventory/scan", { method: "POST", body: "not form data" }),
    );
    expect(res.status).toBe(400);
  });
});
