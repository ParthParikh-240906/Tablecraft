import { describe, it, expect } from "vitest";
import {
  buildDnsInstructions,
  canAddDomain,
  describeVercelStatus,
  displayDomain,
  getDomainPair,
  isApexDomain,
  normalizeDomain,
} from "@/lib/domains";

describe("normalizeDomain", () => {
  it("strips scheme, path, port, and trailing slash", () => {
    const r = normalizeDomain("https://Example.COM:443/some/path?x=1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.hostname).toBe("example.com");
      expect(r.value.alternateHostname).toBe("www.example.com");
      expect(r.value.kind).toBe("apex");
    }
  });

  it("normalizes www to the apex canonical", () => {
    const r = normalizeDomain("www.example.com");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.hostname).toBe("example.com");
      expect(r.value.alternateHostname).toBe("www.example.com");
    }
  });

  it("does not auto-add www for a custom subdomain", () => {
    const r = normalizeDomain("shop.example.com");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.hostname).toBe("shop.example.com");
      expect(r.value.alternateHostname).toBeNull();
      expect(r.value.kind).toBe("subdomain");
    }
  });

  it("handles IDN via punycode", () => {
    const r = normalizeDomain("münich.de");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.hostname).toBe("xn--mnich-kva.de");
  });

  it.each([
    "",
    "not-a-domain",
    "http://",
    "127.0.0.1",
    "*.example.com",
    "bad_domain.com",
    "-bad.example.com",
    "bad-.example.com",
    "localhost",
    "tablecraft-beige.vercel.app",
    "user@example.com",
  ])("rejects %p", (input) => {
    expect(normalizeDomain(input).ok).toBe(false);
  });
});

describe("domain pair + plan limits", () => {
  it("treats co.uk as an apex", () => {
    expect(isApexDomain("example.co.uk")).toBe(true);
    expect(getDomainPair("example.co.uk")).toEqual({
      hostname: "example.co.uk",
      alternateHostname: "www.example.co.uk",
      kind: "apex",
    });
  });

  it("allows 1 domain on Pro/Max and none on Free", () => {
    expect(canAddDomain("free", 0)).toBe(false);
    expect(canAddDomain("pro", 0)).toBe(true);
    expect(canAddDomain("pro", 1)).toBe(false);
    expect(canAddDomain("max", 0)).toBe(true);
    expect(canAddDomain("max", 1)).toBe(false);
  });

  it("displayDomain strips protocol and trailing slash", () => {
    expect(displayDomain("https://example.com/")).toBe("example.com");
  });
});

describe("Vercel status mapping", () => {
  it("pending when ownership is not verified", () => {
    expect(describeVercelStatus({ verified: false }, null).status).toBe("pending_dns");
  });

  it("pending when DNS is misconfigured", () => {
    expect(
      describeVercelStatus({ verified: true }, { misconfigured: true }).status,
    ).toBe("pending_dns");
  });

  it("active when verified and configured", () => {
    const health = describeVercelStatus({ verified: true }, { misconfigured: false });
    expect(health.status).toBe("active");
    expect(health.sslStatus).toBe("issued");
  });

  it("error when Vercel reports a project-domain error", () => {
    expect(
      describeVercelStatus({ verified: false, error: { message: "bad" } }, null).status,
    ).toBe("error");
  });
});

describe("buildDnsInstructions", () => {
  it("returns an A record + www CNAME for an apex", () => {
    const domain = getDomainPair("example.com");
    const records = buildDnsInstructions(domain);
    expect(records.map((r) => `${r.type}:${r.name}`)).toEqual(["A:@", "CNAME:www"]);
  });

  it("returns one CNAME for a custom subdomain", () => {
    const domain = getDomainPair("shop.example.com");
    const records = buildDnsInstructions(domain);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ type: "CNAME", name: "shop" });
  });

  it("appends ownership TXT records from Vercel", () => {
    const domain = getDomainPair("example.com");
    const records = buildDnsInstructions(domain, {
      verified: false,
      verification: [{ type: "TXT", domain: "_vercel", value: "abc123", reason: "Verify" }],
    });
    expect(records.some((r) => r.type === "TXT" && r.value === "abc123")).toBe(true);
  });
});
