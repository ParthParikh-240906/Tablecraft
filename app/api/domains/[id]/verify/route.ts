import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForSlug } from "@/lib/api-auth";
import { buildDnsInstructions, describeVercelStatus, getDomainPair } from "@/lib/domains";
import { clearDomainCache } from "@/lib/domain-store";
import {
  domainErrorMessage,
  getDomainConfig,
  getProjectDomain,
  isVercelConfigured,
  verifyProjectDomain,
} from "@/lib/vercel-domains";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid domain id" }, { status: 400 });
  }

  let body: { orgSlug?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const orgSlug = typeof body.orgSlug === "string" ? body.orgSlug : "";
  if (!orgSlug) return NextResponse.json({ error: "orgSlug is required" }, { status: 400 });

  const auth = await requireOwnerForSlug(orgSlug);
  if ("response" in auth) return auth.response;

  if (!isVercelConfigured()) {
    return NextResponse.json({ error: "Domain management is not configured yet." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: row, error: rowError } = await admin
    .from("organization_domains")
    .select("*")
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .neq("status", "removed")
    .maybeSingle();

  if (rowError || !row) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  try {
    // Force a check, then read the authoritative state. Some Vercel responses
    // return verified=true from verify but still have misconfigured DNS.
    // "Already verified" errors are harmless; the GET below is authoritative.
    try {
      await verifyProjectDomain(row.hostname);
    } catch (err) {
      console.warn("verifyProjectDomain warning:", err);
    }
    const projectDomain = await getProjectDomain(row.hostname);
    const config = await getDomainConfig(row.hostname).catch(() => null);
    const health = describeVercelStatus(projectDomain, config);
    const normalized = getDomainPair(row.hostname);
    const dnsRecords = buildDnsInstructions(normalized, projectDomain, config);

    const { data: updated, error: updateError } = await admin
      .from("organization_domains")
      .update({
        status: health.status,
        ssl_status: health.sslStatus,
        last_error: health.error,
        verification: Array.isArray(projectDomain?.verification) ? projectDomain.verification : [],
        dns_records: dnsRecords,
        last_checked_at: new Date().toISOString(),
        verified_at: health.status === "active" ? new Date().toISOString() : row.verified_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !updated) {
      console.error("domain verify update failed:", updateError);
      return NextResponse.json({ error: "Could not save the domain status." }, { status: 500 });
    }

    clearDomainCache();
    return NextResponse.json({ domain: updated, dnsRecords });
  } catch (err) {
    const mapped = domainErrorMessage(err);
    await admin
      .from("organization_domains")
      .update({
        status: "error",
        last_error: mapped.error,
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    clearDomainCache();
    return NextResponse.json(mapped, { status: 502 });
  }
}
