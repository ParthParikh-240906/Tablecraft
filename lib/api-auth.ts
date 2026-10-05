import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Require a signed-in owner of the org identified by slug.
 * Returns { user, orgId } on success, or { response } with 401/403/404 to return directly.
 */
export async function requireOwnerForSlug(orgSlug: string): Promise<
  | { user: { id: string }; orgId: string }
  | { response: ReturnType<typeof NextResponse.json> }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  const admin = createAdminClient();
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (orgError || !org) {
    return { response: NextResponse.json({ error: "Organization not found" }, { status: 404 }) };
  }
  const { data: staffRows } = await admin
    .from("staff_users")
    .select("role")
    .eq("org_id", org.id)
    .eq("auth_user_id", user.id);
  const isOwner = (staffRows ?? []).some((r: { role?: string }) => r.role === "owner");
  if (!isOwner) {
    return { response: NextResponse.json({ error: "Only the restaurant owner can manage billing" }, { status: 403 }) };
  }
  return { user: { id: user.id }, orgId: org.id };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Require a signed-in staff member of the org identified by id.
 * Use for design/menu mutators that take org_id from the client.
 */
export async function requireStaffForOrgId(orgId: string): Promise<
  | { user: { id: string } }
  | { response: ReturnType<typeof NextResponse.json> }
> {
  if (!orgId || !UUID_RE.test(orgId)) {
    return { response: NextResponse.json({ error: "Invalid org_id" }, { status: 400 }) };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  const admin = createAdminClient();
  const { data: staffRows } = await admin
    .from("staff_users")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("auth_user_id", user.id);
  if (!staffRows || staffRows.length === 0) {
    return { response: NextResponse.json({ error: "You do not have access to this restaurant" }, { status: 403 }) };
  }
  return { user: { id: user.id } };
}
