import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * DELETE the user's own restaurant (org).
 *
 * Security: verifies the caller is authenticated AND has a staff_users row
 * linking their auth_user_id to the org before deleting. Uses the admin
 * client so the ownership check is reliable regardless of the current RLS
 * policies; the delete itself cascades to staff_users, menu_items, tables,
 * bookings and orders.
 */
export async function POST(req: Request) {
  let orgId: string | null = null;
  try {
    const body = await req.json();
    orgId = typeof body?.orgId === "string" ? body.orgId : null;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "Missing restaurant id" }, { status: 400 });
  }

  // 1. Must be signed in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // 2. Must own this restaurant (staff_users row for this org + this user)
  const admin = createAdminClient();
  const { data: staff, error: staffError } = await admin
    .from("staff_users")
    .select("role")
    .eq("org_id", orgId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (staffError || !staff) {
    return NextResponse.json({ error: "You don't own this restaurant" }, { status: 403 });
  }

  // 3. Delete the org (foreign keys cascade)
  const { error: deleteError } = await admin.from("organizations").delete().eq("id", orgId);
  if (deleteError) {
    console.error("restaurant delete failed", deleteError);
    return NextResponse.json({ error: "Could not delete restaurant" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}