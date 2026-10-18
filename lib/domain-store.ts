import { createAdminClient } from "@/lib/supabase/admin";

/**
 * lib/domain-store.ts — cached DB lookups for custom domains.
 *
 * The proxy resolves Host → org on every document request, so these lookups
 * use a short per-instance TTL cache. The slot counter itself is always in
 * Postgres; only routing metadata is cached.
 */

export type ActiveDomain = {
  id: string;
  orgId: string;
  slug: string;
  name: string;
  hostname: string;
  alternateHostname: string | null;
  isPrimary: boolean;
};

export type DomainRow = {
  id: string;
  org_id: string;
  hostname: string;
  alternate_hostname: string | null;
  kind: string;
  status: string;
  is_primary: boolean;
  verification: unknown;
  dns_records: unknown;
  ssl_status: string | null;
  last_error: string | null;
  verified_at: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

const TTL_MS = 60_000;
const cache = new Map<string, { value: ActiveDomain | null; expires: number }>();

function cacheGet(key: string): ActiveDomain | null | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key: string, value: ActiveDomain | null) {
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (v.expires <= now) cache.delete(k);
      if (cache.size <= 250) break;
    }
  }
}

export function clearDomainCache() {
  cache.clear();
}

const HOST_RE = /^[a-z0-9.-]+$/;

function orgFromJoin(value: unknown): { slug?: string; name?: string } | null {
  if (Array.isArray(value)) return (value[0] as { slug?: string; name?: string }) ?? null;
  return (value as { slug?: string; name?: string } | null) ?? null;
}

function toActiveDomain(row: Record<string, unknown>): ActiveDomain | null {
  const org = orgFromJoin(row.organizations);
  if (!org?.slug) return null;
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    slug: org.slug,
    name: org.name ?? org.slug,
    hostname: String(row.hostname),
    alternateHostname: (row.alternate_hostname as string | null) ?? null,
    isPrimary: Boolean(row.is_primary),
  };
}

/** Resolve an active custom domain by hostname (canonical or www alternate). */
export async function getActiveDomainByHost(host: string): Promise<ActiveDomain | null> {
  const hostname = host.toLowerCase().replace(/:\d+$/, "").replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!hostname || !HOST_RE.test(hostname)) return null;

  const key = `host:${hostname}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organization_domains")
      .select("id, org_id, hostname, alternate_hostname, is_primary, organizations!inner(slug, name)")
      .eq("status", "active")
      .or(`hostname.eq.${hostname},alternate_hostname.eq.${hostname}`)
      .maybeSingle();

    if (error) {
      console.error("getActiveDomainByHost:", error);
      return null;
    }
    const value = data ? toActiveDomain(data as Record<string, unknown>) : null;
    cacheSet(key, value);
    return value;
  } catch (err) {
    console.error("getActiveDomainByHost failed:", err);
    return null;
  }
}

/** Primary active domain for an org, used for canonical URLs and checkout origin. */
export async function getPrimaryDomainForOrg(orgId: string): Promise<ActiveDomain | null> {
  if (!orgId) return null;
  const key = `org:${orgId}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organization_domains")
      .select("id, org_id, hostname, alternate_hostname, is_primary, organizations!inner(slug, name)")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("getPrimaryDomainForOrg:", error);
      return null;
    }
    const value = data ? toActiveDomain(data as Record<string, unknown>) : null;
    cacheSet(key, value);
    return value;
  } catch (err) {
    console.error("getPrimaryDomainForOrg failed:", err);
    return null;
  }
}

/**
 * Validate that a hostname is one of this org's active domains. Used before
 * reflecting a request Origin into a Stripe redirect URL.
 */
export async function getActiveDomainForOrgHost(
  orgId: string,
  host: string,
): Promise<ActiveDomain | null> {
  const hostname = host.toLowerCase().replace(/:\d+$/, "").replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!orgId || !hostname || !HOST_RE.test(hostname)) return null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organization_domains")
      .select("id, org_id, hostname, alternate_hostname, is_primary, organizations!inner(slug, name)")
      .eq("org_id", orgId)
      .eq("status", "active")
      .or(`hostname.eq.${hostname},alternate_hostname.eq.${hostname}`)
      .maybeSingle();

    if (error) {
      console.error("getActiveDomainForOrgHost:", error);
      return null;
    }
    return data ? toActiveDomain(data as Record<string, unknown>) : null;
  } catch (err) {
    console.error("getActiveDomainForOrgHost failed:", err);
    return null;
  }
}

/** Uncached list for the Launch page / API. */
export async function getDomainsForOrg(orgId: string): Promise<DomainRow[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organization_domains")
      .select("*")
      .eq("org_id", orgId)
      .neq("status", "removed")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("getDomainsForOrg:", error);
      return [];
    }
    return (data ?? []) as DomainRow[];
  } catch (err) {
    console.error("getDomainsForOrg failed:", err);
    return [];
  }
}
