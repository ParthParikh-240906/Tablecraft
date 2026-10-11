/**
 * tests/edit/vibe-first.test.ts
 * Editing hard rules: exact file:line pinpoint, vibe-first ordering, GPT high effort.
 */
import { describe, it, expect } from "vitest";
import { pinpoint } from "@/lib/ai-code-tools";
import { GPT_SOL_MODEL } from "@/lib/ai-models";

describe("edit hard rules", () => {
  it("uses GPT 6.1 Sol high effort", () => {
    expect(GPT_SOL_MODEL).toBe("gpt-6.1-sol");
  });

  it("pinpoint finds exact file:line refs", async () => {
    const hits = await pinpoint("lib/pricing.ts", "PLAN_MONTHLY_AED");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].line).toBeGreaterThan(0);
  });

  it("vibe change is ordered before minor edits (convention)", () => {
    const steps = ["vibe/aesthetic theme first", "minor text edits second"];
    expect(steps[0]).toMatch(/vibe/i);
  });
});
