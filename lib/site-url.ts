import { getActiveDomainForOrgHost, getPrimaryDomainForOrg } from "@/lib/domain-store";


/**
 * lib/site-url.ts — platform vs storefront URL helpers.
 *
 * Never reflect an arbitrary Host/Origin header into a redirect. Customer-facing
 * URLs are only built from the configured platform origin or a validated active
 * custom domain.
 */

export function getPlatformBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || "https://tablecraft-beige.vercel.app";
  return raw.replace(/\/$/, "");
}

export function getPlatformHost(): string {
  try {
    return new URL(getPlatformBaseUrl()).hostname.toLowerCase();
  } catch {
    return "tablecraft-beige.vercel.app";
  }
}

export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
}

/**
 * Hosts that are Tablecraft itself (or a Vercel deployment URL). Everything
 * else is treated as a candidate customer domain and resolved from the DB.
 */
export function isPlatformHost(host: string | null | undefined): boolean {
  const h = normalizeHost(host);
  if (!h) return true;
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  // LAN IPs used during local development (e.g. 192.168.1.30:3000).
  if (
    /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(
      h,
    )
  ) {
    return true;
  }
  if (h === getPlatformHost()) return true;
  if (h.endsWith(".vercel.app")) return true;
  const vercel = normalizeHost(process.env.VERCEL_URL);
  if (vercel && h === vercel) return true;
  return false;
}

export function siteHref(basePath: string, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${clean}` || "/";
}

export function absoluteSiteUrl(hostname: string | null | undefined, path = ""): string {
  if (!hostname) return `${getPlatformBaseUrl()}${path}`;
  return `https://${hostname}${path}`;
}

export type StorefrontContext = {
  origin: string;
  basePath: string;
  customDomain: string | null;
};

/**
 * Resolve where a guest-facing redirect should go.
 *
 * - Platform host → platform origin + /<slug>
 * - Validated active custom domain → https://<domain> + ""
 * - Anything else / missing → platform fallback
 */
export async function getStorefrontContext(
  request: Request,
  orgId: string,
  orgSlug: string,
): Promise<StorefrontContext> {
  const platformOrigin = getPlatformBaseUrl();
  const platformFallback: StorefrontContext = {
    origin: platformOrigin,
    basePath: `/${orgSlug}`,
    customDomain: null,
  };

  const candidate = request.headers.get("origin") || "";
  let host = "";
  try {
    host = normalizeHost(candidate ? new URL(candidate).hostname : "");
  } catch {
    host = "";
  }
  if (!host) host = normalizeHost(request.headers.get("host"));
  if (!host || isPlatformHost(host)) {
    // Even if the owner is testing on the platform path, send guests to the
    // active custom domain once one is connected.
    const primary = await getPrimaryDomainForOrg(orgId);
    if (primary) {
      return {
        origin: `https://${primary.hostname}`,
        basePath: "",
        customDomain: primary.hostname,
      };
    }
    return platformFallback;
  }

  const domain = await getActiveDomainForOrgHost(orgId, host);
  if (!domain) {
    const primary = await getPrimaryDomainForOrg(orgId);
    if (primary) {
      return {
        origin: `https://${primary.hostname}`,
        basePath: "",
        customDomain: primary.hostname,
      };
    }
    return platformFallback;
  }

  return {
    origin: `https://${domain.hostname}`,
    basePath: "",
    customDomain: domain.hostname,
  };
}

/** Primary custom domain for canonical URLs (cached). */
export async function getPrimaryDomainHost(orgId: string): Promise<string | null> {
  const domain = await getPrimaryDomainForOrg(orgId);
  return domain?.hostname ?? null;
}
