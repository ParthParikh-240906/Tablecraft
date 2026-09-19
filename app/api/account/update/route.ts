import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";

/**
 * POST /api/account/update
 *
 * Allows an owner to change:
 *   - Owner password  (Supabase auth password + console_password_hash)
 *   - Staff password  (Supabase auth password for the staff row)
 *   - Staff email     (staff_users.email — does NOT change Supabase auth email)
 *
 * Body:
 *   { section: 'owner' | 'staff', password?: string, email?: string }
 */
export async function POST(request: Request) {
  let body: { section?: string; password?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { section, password, email } = body;
  if (typeof section !== "string" || !["owner", "staff"].includes(section)) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  }
  // Password is required for owner; optional (with email) for staff
  if (password && (typeof password !== "string" || password.length < 8)) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (email && (typeof email !== "string" || !email.includes("@"))) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (!password && !email) {
    return NextResponse.json({ error: "Provide a password or email" }, { status: 400 });
  }

  // Authenticate
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Resolve active org (same priority as layout: url > header > cookie > default)
  const params = new URL(request.url).searchParams;
  const urlOrgId = params.get("org") || undefined;
  const admin = createAdminClient();
  let orgId: string | null = null;

  if (urlOrgId) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(urlOrgId);
    if (isUUID) orgId = urlOrgId;
  }
  if (!orgId) {
    const headerList = await headers();
    const headerOrg = headerList.get("x-console-selected-org");
    if (headerOrg && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(headerOrg)) {
      orgId = headerOrg;
    }
  }
  if (!orgId) {
    const cookieStore = await cookies();
    orgId = cookieStore.get("selected_org")?.value || null;
  }
  if (!orgId) {
    const result = await (async () => {
      const s = await createClient();
      const r = await s.from("staff_users").select("org_id").eq("auth_user_id", user.id).single();
      return r.data?.org_id ?? null;
    })();
    orgId = result;
  }
  if (!orgId) return NextResponse.json({ error: "No active restaurant" }, { status: 404 });

  // Verify caller is the owner of this org
  const { data: ownerRow } = await admin
    .from("staff_users")
    .select("role, auth_user_id")
    .eq("org_id", orgId)
    .eq("auth_user_id", user.id)
    .single();

  if (!ownerRow || ownerRow.role !== "owner") {
    return NextResponse.json({ error: "Forbidden — owners only" }, { status: 403 });
  }

  try {
    if (section === "owner") {
      // Update Supabase auth password
      if (password) {
        const { error: authError } = await admin.auth.admin.updateUserById(user.id, { password });
        if (authError) throw authError;
        // Also update console_password_hash so the independent console login path works too
        const hash = await bcrypt.hash(password, 10);
        await admin
          .from("staff_users")
          .update({ console_password_hash: hash })
          .eq("org_id", orgId)
          .eq("auth_user_id", user.id);
      }
    } else {
      // section === 'staff': find the staff row for this org
      const { data: staffRow, error: staffError } = await admin
        .from("staff_users")
        .select("auth_user_id")
        .eq("org_id", orgId)
        .eq("role", "staff")
        .single();

      if (staffError || !staffRow) {
        return NextResponse.json({ error: "No staff account found for this restaurant" }, { status: 404 });
      }

      if (password) {
        const { error: authError } = await admin.auth.admin.updateUserById(staffRow.auth_user_id, { password });
        if (authError) throw authError;
      }
      if (email) {
        const { error: emailError } = await admin
          .from("staff_users")
          .update({ email })
          .eq("org_id", orgId)
          .eq("role", "staff");
        if (emailError) throw emailError;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("account/update error:", err);
    return NextResponse.json({ error: "Could not update account" }, { status: 500 });
  }
}
