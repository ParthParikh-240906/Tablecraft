/**
 * tests/edit/anchor-edits.test.ts
 * Anchor-edit contract: exact-once matching, missing/ambiguous classification.
 */
import { describe, it, expect } from "vitest";
import { checkAnchors } from "@/app/api/ai/edit/route";

const HTML = "<h1>Taj</h1><p>32 HAND-GROUND SPICES</p><p>32 HAND-GROUND SPICES</p>";

describe("checkAnchors", () => {
  it("classifies matched-once / missing / ambiguous", () => {
    const out = checkAnchors(HTML, [
      { find: "<h1>Taj</h1>", replace: "<h1>Taj!</h1>" },
      { find: "<h2>Nope</h2>", replace: "x" },
      { find: "32 HAND-GROUND SPICES", replace: "" },
    ]);
    expect(out.map((e) => e.status)).toEqual(["matched-once", "missing", "ambiguous"]);
  });

  it("caps at 10 edits and rejects empty finds", () => {
    const many = Array.from({ length: 15 }, () => ({ find: "<h1>Taj</h1>", replace: "x" }));
    const out = checkAnchors(HTML, many);
    expect(out).toHaveLength(10);
    expect(checkAnchors(HTML, [{ find: "", replace: "x" }])[0]?.status).toBe("missing");
  });

  it("applies cleanly with String.replace semantics", () => {
    const checked = checkAnchors(HTML, [{ find: "<h1>Taj</h1>", replace: "<h1>Taj!</h1>" }]);
    let next = HTML;
    for (const e of checked) {
      if (e.status === "matched-once") next = next.replace(e.find, e.replace);
    }
    expect(next).toContain("<h1>Taj!</h1>");
    expect(next).not.toContain("<h1>Taj</h1>");
  });

  it("preserves model-written summaries", () => {
    const checked = checkAnchors(HTML, [
      { find: "<h1>Taj</h1>", replace: "<h1>Taj!</h1>", summary: "Fixes the clipped hero letter" },
    ]);
    expect(checked[0]?.summary).toBe("Fixes the clipped hero letter");
  });
});
