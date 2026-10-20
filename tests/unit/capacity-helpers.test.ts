import { describe, it, expect } from "vitest";
import {
  fallbackSiteKey,
  FREE_SESSION_LIMIT,
  isBot,
  isFreeGated,
  newSiteCookieValue,
  parseCookie,
  SLOT_TTL_SECONDS,
} from "@/lib/capacity";

describe("capacity helpers", () => {
  it("uses a 2-session, 120s lease policy", () => {
    expect(FREE_SESSION_LIMIT).toBe(2);
    expect(SLOT_TTL_SECONDS).toBe(120);
  });

  it("gates only Free, non-degraded orgs", () => {
    expect(isFreeGated({ plan: "free", degraded: false })).toBe(true);
    expect(isFreeGated({ plan: "pro", degraded: false })).toBe(false);
    expect(isFreeGated({ plan: "max", degraded: false })).toBe(false);
    expect(isFreeGated({ plan: "free", degraded: true })).toBe(false);
  });

  it("parses a cookie from a request header", () => {
    const header = "a=1; tc_site_session=abc-123; b=2";
    expect(parseCookie(header, "tc_site_session")).toBe("abc-123");
    expect(parseCookie(header, "missing")).toBeNull();
    expect(parseCookie(null, "tc_site_session")).toBeNull();
  });

  it("detects common bots but not normal browsers", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("Slackbot-LinkExpanding 1.0")).toBe(true);
    expect(isBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36")).toBe(false);
    expect(isBot(null)).toBe(false);
  });

  it("makes stable fallback keys and unique cookie values", () => {
    expect(fallbackSiteKey("1.2.3.4", "ua")).toBe(fallbackSiteKey("1.2.3.4", "ua"));
    expect(fallbackSiteKey("1.2.3.4", "ua")).not.toBe(fallbackSiteKey("1.2.3.5", "ua"));
    expect(newSiteCookieValue()).not.toBe(newSiteCookieValue());
  });
});
