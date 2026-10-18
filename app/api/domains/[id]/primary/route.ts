import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForSlug } from "@/lib/api-auth";
import { clearDomainCache } from "@/lib/domain-store";

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

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("organization_domains")
    .select("id")
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .neq("status", "removed")
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Domain not found" }, { status: 404 });

  const { error } = await admin
    .from("organization_domains")
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq("org_id", auth.orgId)
    .neq("status", "removed");
  if (error) {
    console.error("domain primary update failed:", error);
    return NextResponse.json({ error: "Could not update the primary domain." }, { status: 500 });
  }

  const { error: setError } = await admin
    .from("organization_domains")
    .update({ is_primary: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (setError) {
    console.error("domain primary set failed:", setError);
    return NextResponse.json({ error: "Could not update the primary domain." }, { status: 500 });
  }

  clearDomainCache();
  return NextResponse.json({ ok: true });
}
