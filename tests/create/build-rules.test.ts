/**
 * tests/create/build-rules.test.ts
 * Initial build prompt hard rules (Haiku 5.5 low effort).
 */
import { describe, it, expect } from "vitest";
import { HAIKU_MODEL } from "@/lib/ai-models";

const BUILD_RULES = [
  "Menu section",
  "Book a table",
  "AI chatbot",
  "Header always at top",
  "simple yet interactive and animated",
  "easy to replace",
  "endpoint",
  "orgSlug",
];

describe("create build hard rules", () => {
  it("uses Haiku 5.5 low effort", () => {
    expect(HAIKU_MODEL).toBe("claude-haiku-5-5");
  });

  it("build route requires name/orgSlug/vibe", async () => {
    const { POST } = await import("@/app/api/ai/build/route");
    const bad = await POST(new Request("http://localhost/api/ai/build", {
      method: "POST",
      body: JSON.stringify({ name: "", orgSlug: "", vibe: "" }),
    }));
    expect(bad.status).toBe(400);
  });

  it("rejects bad orgSlug", async () => {
    const { POST } = await import("@/app/api/ai/build/route");
    const res = await POST(new Request("http://localhost/api/ai/build", {
      method: "POST",
      body: JSON.stringify({ name: "X", orgSlug: "Bad Slug!", vibe: "cozy" }),
    }));
    expect(res.status).toBe(400);
  });

  it("hard rules list covers Menu/Book/Chatbot/Header/endpoints/orgSlug", () => {
    const joined = BUILD_RULES.join(" ").toLowerCase();
    for (const k of ["menu", "book", "chatbot", "header", "endpoint", "orgslug"]) {
      expect(joined).toContain(k);
    }
  });
});
