import { domainToASCII } from "node:url";
import { isIP } from "node:net";
import type { PlanTier } from "@/lib/rate-limit";

/**
 * lib/domains.ts — pure custom-domain helpers.
 *
 * Server-side only: uses node:url/node:net for IDN + IP checks. The Launch
 * client never imports this module; it asks the API to normalize/validate.
 */

export type DomainKind = "apex" | "subdomain";
export type DomainStatus = "pending_dns" | "verifying" | "active" | "error" | "removed";

export type NormalizedDomain = {
  hostname: string;
  alternateHostname: string | null;
  kind: DomainKind;
};

export type DomainValidation =
  | { ok: true; value: NormalizedDomain }
  | { ok: false; error: string };

export type DnsRecord = {
  type: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
  purpose: string;
};

/** One logical domain per restaurant on paid plans. */
export const DOMAIN_LIMITS: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  max: 1,
};

/** Common second-level public suffixes (enough for apex detection without a PSL dep). */
const SECOND_LEVEL_SUFFIXES = new Set([
  "co.uk", "org.uk", "me.uk", "ac.uk", "gov.uk",
  "com.au", "net.au", "org.au", "co.nz", "co.za",
  "co.ae", "com.ae", "net.ae", "org.ae",
  "com.br", "com.mx", "com.tr", "com.sg", "com.hk",
  "co.in", "co.jp", "co.kr", "com.cn", "com.tw",
  "com.sa", "com.qa", "com.kw", "com.bh", "com.om",
]);

function platformHostnames(): Set<string> {
  const hosts = new Set<string>([
    "localhost",
    "127.0.0.1",
    "tablecraft-beige.vercel.app",
  ]);
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      hosts.add(new URL(configured).hostname.toLowerCase());
    } catch {
      // ignore malformed env
    }
  }
  const vercel = process.env.VERCEL_URL;
  if (vercel) hosts.add(vercel.toLowerCase());
  return hosts;
}

export function isReservedDomain(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (platformHostnames().has(host)) return true;
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (host.endsWith(".vercel.app")) return true;
  if (host.endsWith(".internal")) return true;
  return false;
}

export function isApexDomain(hostname: string): boolean {
  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  if (labels.length === 2) return true;
  if (labels.length === 3) {
    return SECOND_LEVEL_SUFFIXES.has(labels.slice(-2).join("."));
  }
  return false;
}

/**
 * Normalize a user-entered domain into a canonical hostname + optional
 * apex/www partner. Returns a user-facing error instead of throwing.
 */
export function normalizeDomain(input: unknown): DomainValidation {
  if (typeof input !== "string") {
    return { ok: false, error: "Enter a domain name." };
  }

  let value = input.trim().toLowerCase();
  if (!value) return { ok: false, error: "Enter a domain name." };

  // Strip a scheme, path, query, fragment, and port if pasted as a URL.
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = value.split(/[/?#]/, 1)[0] ?? "";
  if (value.includes("@")) return { ok: false, error: "Enter a domain, not an email address." };
  value = value.replace(/:\d+$/, "");
  value = value.replace(/\.$/, "");

  if (value.includes("*")) return { ok: false, error: "Wildcard domains are not supported." };
  if (value.includes("_")) return { ok: false, error: "Domain names cannot contain underscores." };
  if (value.includes("..")) return { ok: false, error: "Enter a valid domain name." };

  const ascii = domainToASCII(value);
  if (!ascii) return { ok: false, error: "Enter a valid domain name." };
  if (ascii.length > 253) return { ok: false, error: "Domain name is too long." };
  if (isIP(ascii)) return { ok: false, error: "Enter a domain name, not an IP address." };
  if (!ascii.includes(".")) return { ok: false, error: "Enter a full domain, e.g. example.com." };

  const labels = ascii.split(".");
  if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9-]+$/.test(label) || label.startsWith("-") || label.endsWith("-"))) {
    return { ok: false, error: "Enter a valid domain name." };
  }

  const tld = labels[labels.length - 1];
  if (!tld || tld.length < 2 || /^\d+$/.test(tld)) {
    return { ok: false, error: "Enter a valid domain name." };
  }

  if (isReservedDomain(ascii)) {
    return { ok: false, error: "That domain is reserved by Tablecraft." };
  }

  const pair = getDomainPair(ascii);
  return { ok: true, value: pair };
}

/**
 * Returns the canonical hostname and optional apex/www partner.
 * - example.com       → example.com + www.example.com
 * - www.example.com   → example.com + www.example.com
 * - shop.example.com  → shop.example.com (no automatic sibling)
 */
export function getDomainPair(hostname: string): NormalizedDomain {
  const host = hostname.toLowerCase().replace(/\.$/, "");

  if (isApexDomain(host)) {
    return { hostname: host, alternateHostname: `www.${host}`, kind: "apex" };
  }

  if (host.startsWith("www.")) {
    const parent = host.slice(4);
    if (isApexDomain(parent)) {
      return { hostname: parent, alternateHostname: host, kind: "apex" };
    }
    // www.shop.example.com → canonical shop.example.com + alternate www.shop...
    return { hostname: parent, alternateHostname: host, kind: "subdomain" };
  }

  return { hostname: host, alternateHostname: null, kind: "subdomain" };
}

export function canAddDomain(plan: PlanTier, existingCount: number): boolean {
  return existingCount < DOMAIN_LIMITS[plan];
}

export type VercelProjectDomainLike = {
  name?: string;
  verified?: boolean;
  verification?: unknown;
  error?: { code?: string; message?: string } | null;
};

export type VercelConfigLike = {
  misconfigured?: boolean;
};

export type DomainHealth = {
  status: Exclude<DomainStatus, "removed">;
  sslStatus: string;
  error: string | null;
};

/**
 * Map Vercel's project-domain + config responses to our status.
 * `verified` = ownership is proven; `misconfigured` = DNS still points elsewhere.
 */
export function describeVercelStatus(
  projectDomain: VercelProjectDomainLike | null | undefined,
  config: VercelConfigLike | null | undefined,
): DomainHealth {
  if (!projectDomain) {
    return { status: "error", sslStatus: "unknown", error: "Vercel could not find this domain." };
  }
  if (projectDomain.error?.message) {
    return { status: "error", sslStatus: "unknown", error: projectDomain.error.message };
  }
  if (!projectDomain.verified) {
    return { status: "pending_dns", sslStatus: "pending", error: null };
  }
  if (config?.misconfigured) {
    return { status: "pending_dns", sslStatus: "pending", error: null };
  }
  return { status: "active", sslStatus: "issued", error: null };
}

function verificationRecords(projectDomain: VercelProjectDomainLike | null | undefined): DnsRecord[] {
  const raw = projectDomain?.verification;
  if (!Array.isArray(raw)) return [];
  const records: DnsRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { type?: unknown; domain?: unknown; value?: unknown; reason?: unknown };
    if (typeof row.value !== "string" || !row.value) continue;
    const type = row.type === "TXT" || row.type === "CNAME" || row.type === "A" ? row.type : "TXT";
    records.push({
      type,
      name: typeof row.domain === "string" && row.domain ? row.domain : "_vercel",
      value: row.value,
      purpose: typeof row.reason === "string" && row.reason ? row.reason : "Ownership verification",
    });
  }
  return records;
}

/**
 * Build the DNS table shown to the owner. Apex + www are both included because
 * both hostnames are added to the Vercel project.
 */
export function buildDnsInstructions(
  domain: NormalizedDomain,
  projectDomain?: VercelProjectDomainLike | null,
  config?: { recommendedIPv4?: string[]; recommendedCNAME?: string[] } | null,
): DnsRecord[] {
  const aValue = config?.recommendedIPv4?.[0] || process.env.VERCEL_DNS_A_RECORD || "76.76.21.21";
  const cnameValue = config?.recommendedCNAME?.[0] || process.env.VERCEL_DNS_CNAME || "cname.vercel-dns.com";

  const records: DnsRecord[] = [];

  if (domain.kind === "apex") {
    records.push({
      type: "A",
      name: "@",
      value: aValue,
      purpose: "Apex domain → Vercel",
    });
  } else {
    records.push({
      type: "CNAME",
      name: domain.hostname.split(".")[0] || domain.hostname,
      value: cnameValue,
      purpose: "Subdomain → Vercel",
    });
  }

  if (domain.alternateHostname) {
    const label = domain.alternateHostname.startsWith("www.")
      ? "www"
      : domain.alternateHostname.split(".")[0] || domain.alternateHostname;
    records.push({
      type: "CNAME",
      name: label,
      value: cnameValue,
      purpose: "www → Vercel",
    });
  }

  return [...records, ...verificationRecords(projectDomain)];
}

/** Human-readable domain for UI. */
export function displayDomain(hostname: string): string {
  return hostname.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
