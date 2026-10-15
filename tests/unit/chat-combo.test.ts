/**
 * tests/unit/chat-combo.test.ts
 * Covers lib/chat-combo.ts — combo-offer reply classification + table matching.
 */
import { describe, it, expect } from "vitest";
import {
  COMBO_OFFER_MARKER,
  sanitizeComboTables,
  lastAssistantText,
  classifyComboReply,
  matchComboTables,
  comboLabels,
} from "@/lib/chat-combo";

describe("sanitizeComboTables", () => {
  it("keeps well-formed refs, drops junk, caps length", () => {
    expect(sanitizeComboTables(null)).toEqual([]);
    expect(
      sanitizeComboTables([{ id: "a", label: "Table 1", capacity: 4 }, { id: 5 }, { noid: true }]),
    ).toEqual([{ id: "a", label: "Table 1", capacity: 4 }]);
  });
});

describe("classifyComboReply (deny → narrowed pick → affirm → pick → other)", () => {
  it("affirms plain confirmations (the reported transcript)", () => {
    expect(classifyComboReply("yes the 2 tables will be fine")).toBe("affirm");
    expect(classifyComboReply("yes")).toBe("affirm");
    expect(classifyComboReply("Sure, go ahead")).toBe("affirm");
    expect(classifyComboReply("Sounds good!")).toBe("affirm");
  });
  it("denies negatives (checked before affirm words)", () => {
    expect(classifyComboReply("no")).toBe("deny");
    expect(classifyComboReply("No, that won't work")).toBe("deny");
    expect(classifyComboReply("actually no, cancel")).toBe("deny");
  });
  it("matches explicit table picks", () => {
    expect(classifyComboReply("Table1 + Table 2")).toEqual({ pick: ["1", "2"] });
    expect(classifyComboReply("just table 2")).toEqual({ pick: ["2"] });
    expect(classifyComboReply("table 2 only please")).toEqual({ pick: ["2"] });
  });
  it("treats anything else as a normal message", () => {
    expect(classifyComboReply("actually make it 8 people")).toBe("other");
    expect(classifyComboReply("")).toBe("other");
  });
});

describe("matchComboTables", () => {
  const tables = [
    { id: "uuid-1", label: "Table 1", capacity: 4 },
    { id: "uuid-2", label: "Table 2", capacity: 4 },
  ];
  it("matches by table number across label spellings", () => {
    expect(matchComboTables(["1", "2"], tables).map((t) => t.id)).toEqual(["uuid-1", "uuid-2"]);
    expect(matchComboTables(["2"], tables).map((t) => t.id)).toEqual(["uuid-2"]);
  });
  it("drops unknown numbers", () => {
    expect(matchComboTables(["9"], tables)).toEqual([]);
  });
});

describe("comboLabels + marker", () => {
  it("joins human lists", () => {
    expect(comboLabels([])).toBe("those tables");
    expect(comboLabels([{ id: "a", label: "Table 1" }])).toBe("Table 1");
    expect(
      comboLabels([
        { id: "a", label: "Table 1" },
        { id: "b", label: "Table 2" },
      ]),
    ).toBe("Table 1 and Table 2");
  });
  it("marker matches the route suffix", () => {
    expect(COMBO_OFFER_MARKER).toContain("Reply with the table option");
  });
  it("lastAssistantText finds the latest bot message", () => {
    expect(lastAssistantText([])).toBe("");
    expect(
      lastAssistantText([
        { role: "user", content: "hi" },
        { role: "assistant", content: "first" },
        { role: "user", content: "yo" },
        { role: "assistant", content: "second" },
      ]),
    ).toBe("second");
  });
});
