import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForSlug } from "@/lib/api-auth";
import { buildDnsInstructions, canAddDomain, describeVercelStatus, normalizeDomain, type DnsRecord } from "@/lib/domains";
import { getCapacityPlan } from "@/lib/capacity";
import { getDomainsForOrg, clearDomainCache } from "@/lib/domain-store";
import {
  addProjectDomain,
  domainErrorMessage,
  getDomainConfig,
  getProjectDomainCount,
  isVercelConfigured,
  removeProjectDomain,
  setProjectDomainRedirect,
} from "@/lib/vercel-domains";
import { rateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_PROJECT_DOMAINS = 50;
const WARN_PROJECT_DOMAINS = 45;

export async function GET(request: Request) {
  const orgSlug = new URL(request.url).searchParams.get("orgSlug") ?? "";
  if (!orgSlug) return NextResponse.json({ error: "orgSlug is required" }, { status: 400 });

  const auth = await requireOwnerForSlug(orgSlug);
  if ("response" in auth) return auth.response;

  const domains = await getDomainsForOrg(auth.orgId);
  return NextResponse.json({ domains });
}

export async function POST(request: Request) {
  let body: { orgSlug?: unknown; hostname?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const orgSlug = typeof body.orgSlug === "string" ? body.orgSlug : "";
  if (!orgSlug) return NextResponse.json({ error: "orgSlug is required" }, { status: 400 });

  const auth = await requireOwnerForSlug(orgSlug);
  if ("response" in auth) return auth.response;

  if (!isVercelConfigured()) {
    return NextResponse.json(
      { error: "Domain management is not configured yet.", code: "not_configured" },
      { status: 503 },
    );
  }

  // Fail before touching Vercel if migration 0037 has not been applied.
  {
    const probe = createAdminClient();
    const { error: schemaError } = await probe
      .from("organization_domains")
      .select("id")
      .limit(1);
    if (schemaError) {
      console.error("organization_domains schema check failed:", schemaError);
      return NextResponse.json(
        {
          error: "Domain storage is not set up yet. Apply migration 0037 and try again.",
          code: "schema_missing",
        },
        { status: 503 },
      );
    }
  }

  const rl = rateLimit(`domains:add:${auth.user.id}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) return rateLimitedResponse(rl.resetMs);

  const normalized = normalizeDomain(body.hostname);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error, code: "invalid_domain" }, { status: 400 });
  }
  const domain = normalized.value;

  const plan = await getCapacityPlan(auth.orgId);
  const existing = await getDomainsForOrg(auth.orgId);
  if (!canAddDomain(plan.plan, existing.length)) {
    return NextResponse.json(
      {
        error:
          plan.plan === "free"
            ? "Custom domains are available on Pro and Max. Upgrade to connect one."
            : "This restaurant already has a custom domain. Disconnect it first.",
        code: plan.plan === "free" ? "upgrade_required" : "domain_limit",
        upgradeUrl: plan.plan === "free" ? `/console/pricing?org=${auth.orgId}` : undefined,
      },
      { status: plan.plan === "free" ? 402 : 409 },
    );
  }

  const conflict = existing.find(
    (d) =>
      d.hostname.toLowerCase() === domain.hostname.toLowerCase() ||
      (domain.alternateHostname &&
        (d.hostname.toLowerCase() === domain.alternateHostname.toLowerCase() ||
          d.alternate_hostname?.toLowerCase() === domain.alternateHostname.toLowerCase())),
  );
  if (conflict) {
    return NextResponse.json(
      { error: "That domain is already connected to another restaurant.", code: "domain_in_use" },
      { status: 409 },
    );
  }

  // Global uniqueness check before touching Vercel. Without this, a domain
  // attached to restaurant A could be added to the project again for B, and the
  // rollback would remove it from A.
  const hosts = [domain.hostname, domain.alternateHostname].filter(
    (h): h is string => Boolean(h),
  );
  const dbAdmin = createAdminClient();
  const [{ data: hostConflicts }, { data: alternateConflicts }] = await Promise.all([
    dbAdmin
      .from("organization_domains")
      .select("id")
      .neq("status", "removed")
      .in("hostname", hosts),
    dbAdmin
      .from("organization_domains")
      .select("id")
      .neq("status", "removed")
      .in("alternate_hostname", hosts),
  ]);
  if ((hostConflicts?.length ?? 0) > 0 || (alternateConflicts?.length ?? 0) > 0) {
    return NextResponse.json(
      { error: "That domain is already connected to another restaurant.", code: "domain_in_use" },
      { status: 409 },
    );
  }

  let projectCount = 0;
  let capacityWarning: string | null = null;
  try {
    projectCount = await getProjectDomainCount();
    const needed = domain.alternateHostname ? 2 : 1;
    if (projectCount + needed > MAX_PROJECT_DOMAINS) {
      return NextResponse.json(
        {
          error: "This MVP has reached its custom-domain capacity. Please contact support.",
          code: "project_domain_limit",
        },
        { status: 503 },
      );
    }
    if (projectCount >= WARN_PROJECT_DOMAINS) {
      capacityWarning = `Heads up: the Vercel project is nearing its ${MAX_PROJECT_DOMAINS}-domain Hobby limit.`;
    }
  } catch (err) {
    // Non-fatal: Vercel will reject at the hard limit anyway.
    console.error("domain capacity check failed:", err);
  }

  const admin = createAdminClient();

  try {
    const added = await addProjectDomain(domain.hostname);
    let alternateAdded = false;

    if (domain.alternateHostname) {
      try {
        await addProjectDomain(domain.alternateHostname);
        alternateAdded = true;
        await setProjectDomainRedirect(domain.alternateHostname, domain.hostname);
      } catch (err) {
        console.error("alternate domain add/redirect failed:", err);
        // Keep the canonical domain; the UI still shows the www CNAME.
      }
    }

    const config = await getDomainConfig(domain.hostname).catch(() => null);
    const health = describeVercelStatus(added, config);
    const verification = Array.isArray(added.verification) ? added.verification : [];
    // Only advertise the www record if the alternate was actually attached.
    const storedDomain = alternateAdded ? domain : { ...domain, alternateHostname: null };
    const dnsRecords: DnsRecord[] = buildDnsInstructions(storedDomain, added, config);

    const { data: row, error } = await admin
      .from("organization_domains")
      .insert({
        org_id: auth.orgId,
        hostname: domain.hostname,
        alternate_hostname: alternateAdded ? domain.alternateHostname : null,
        kind: domain.kind,
        status: health.status === "active" ? "active" : "pending_dns",
        is_primary: true,
        verification,
        dns_records: dnsRecords,
        ssl_status: health.sslStatus,
        last_error: health.error,
        last_checked_at: new Date().toISOString(),
        verified_at: health.status === "active" ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    if (error || !row) {
      // Do not leave the domain attached if our DB insert failed.
      await Promise.allSettled(
        [domain.hostname, alternateAdded ? domain.alternateHostname : null]
          .filter((h): h is string => Boolean(h))
          .map((h) => removeProjectDomain(h)),
      );
      console.error("domain insert failed:", error);
      return NextResponse.json({ error: "Could not save the domain. Try again." }, { status: 500 });
    }

    clearDomainCache();
    return NextResponse.json({ domain: row, dnsRecords, warning: capacityWarning });
  } catch (err) {
    const mapped = domainErrorMessage(err);
    return NextResponse.json(mapped, { status: mapped.code === "domain_in_use" ? 409 : 502 });
  }
}
