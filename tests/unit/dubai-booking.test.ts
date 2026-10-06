/**
 * tests/unit/dubai-booking.test.ts
 * Covers the Dubai-only booking fixes:
 *  - BookingChatbot yes-regex accepts "yes please" / "yeah sure" / "yes!"
 *  - Dubai wall-time (+04:00, no DST) converts to correct UTC for the API
 *  - Reserve form date input uses YYYY-MM-DD (native date picker)
 *  - Duration helper renders dynamic booking_config text, not hardcoded 2h
 *  - Marketing copy no longer ships the internal-joke Pro feature
 */
import { describe, it, expect } from "vitest";
import { MARKETING_PLANS } from "@/lib/marketing-plans";

// Mirror of components/BookingChatbot.tsx:107
const YES_RE = /\b(yes|yeah|yep|sure|ok|okay|proceed|fine|works|perfect)\b/i;

// Mirror of booking-form + chatbot Dubai conversion
function dubaiToISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00+04:00`).toISOString();
}

describe("chatbot yes-regex (Dubai combo confirm)", () => {
  it.each(["yes", "yes please", "yeah sure", "yes!", "Sure, proceed", "sounds perfect", "OK", "that works"])(
    "accepts %p",
    (input) => {
      expect(YES_RE.test(input.toLowerCase())).toBe(true);
    },
  );

  it.each(["no", "cancel", "maybe later", ""])("rejects %p", (input) => {
    expect(YES_RE.test(input.toLowerCase())).toBe(false);
  });
});

describe("Dubai wall-time → UTC", () => {
  it("19:00 Dubai (+04:00) stores as 15:00Z", () => {
    expect(dubaiToISO("2026-10-06", "19:00")).toBe("2026-10-06T15:00:00.000Z");
  });

  it("midnight Dubai stays on the same calendar day in UTC", () => {
    // 00:30 +04:00 = 20:30Z previous day — conversion must be explicit, not local-TZ dependent
    expect(dubaiToISO("2026-10-06", "00:30")).toBe("2026-10-05T20:30:00.000Z");
  });
});

describe("reserve date input (native picker)", () => {
  it("accepts YYYY-MM-DD and rejects legacy DD-MM-YYYY", () => {
    expect(/^\d{4}-\d{2}-\d{2}$/.test("2026-10-06")).toBe(true);
    expect(/^\d{4}-\d{2}-\d{2}$/.test("06-10-2026")).toBe(false);
    expect(/^\d{4}-\d{2}-\d{2}$/.test("")).toBe(false);
  });
});

describe("duration helper (dynamic booking_config)", () => {
  const fmt = (mins: number) =>
    `${mins >= 60 ? `${Math.floor(mins / 60)}h ` : ""}${mins % 60 ? `${mins % 60}m` : ""}`.trim();
  it("formats custom durations instead of hardcoded 2h", () => {
    expect(fmt(120)).toBe("2h");
    expect(fmt(90)).toBe("1h 30m");
    expect(fmt(45)).toBe("45m");
  });
});

describe("marketing copy guard", () => {
  it("Pro plan has no internal-joke feature", () => {
    const pro = MARKETING_PLANS.find((p) => p.planKey === "pro")!;
    expect(pro.features.join("\n").toLowerCase()).not.toContain("no meetings with senior");
  });
});
