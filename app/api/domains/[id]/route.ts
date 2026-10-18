import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForSlug } from "@/lib/api-auth";
import { clearDomainCache } from "@/lib/domain-store";
import { removeProjectDomain } from "@/lib/vercel-domains";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid domain id" }, { status: 400 });
  }

  const orgSlug = new URL(request.url).searchParams.get("orgSlug") ?? "";
  if (!orgSlug) return NextResponse.json({ error: "orgSlug is required" }, { status: 400 });

  const auth = await requireOwnerForSlug(orgSlug);
  if ("response" in auth) return auth.response;

  const admin = createAdminClient();
  const { data: row, error: rowError } = await admin
    .from("organization_domains")
    .select("id, hostname, alternate_hostname")
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .neq("status", "removed")
    .maybeSingle();

  if (rowError || !row) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  const cleanupErrors: string[] = [];
  for (const hostname of [row.hostname, row.alternate_hostname].filter(Boolean) as string[]) {
    try {
      await removeProjectDomain(hostname);
    } catch (err) {
      console.error(`domain delete: removeProjectDomain ${hostname} failed`, err);
      cleanupErrors.push(hostname);
    }
  }

  const { error } = await admin
    .from("organization_domains")
    .update({
      status: "removed",
      is_primary: false,
      last_error: cleanupErrors.length > 0 ? "Vercel cleanup pending" : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("domain delete update failed:", error);
    return NextResponse.json({ error: "Could not disconnect the domain." }, { status: 500 });
  }

  clearDomainCache();
  return NextResponse.json({ ok: true, cleanupPending: cleanupErrors.length > 0 });
}
