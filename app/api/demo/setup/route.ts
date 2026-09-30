import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEMO_EMAIL = "demo@tablecraft.app";
const DEMO_PASSWORD = "demo123";

/**
 * POST /api/demo/setup
 *
 * Creates (or ensures existence of) the shared demo Supabase Auth user and
 * links it to all demo staff_users rows. Idempotent — safe to call multiple times.
 *
 * Returns: { authUserId, demoEmail }
 */
export async function POST() {
  const admin = createAdminClient();

  try {
    // 1. Find or create the shared demo auth user
    const { data: existingUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = (existingUsers?.users ?? []).find((u) => u.email === DEMO_EMAIL);

    let authUserId: string;
    if (existingUser) {
      authUserId = existingUser.id;
    } else {
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      if (createError) {
        console.error("demo/setup: auth user creation failed", createError);
        return NextResponse.json({ error: "Failed to create demo auth user" }, { status: 500 });
      }
      authUserId = newUser.user.id;
    }

    // 2. Link the auth user to all demo staff_rows
    const { error: updateError } = await admin
      .from("staff_users")
      .update({ auth_user_id: authUserId, role: "owner" })
      .eq("email", DEMO_EMAIL);

    if (updateError) {
      console.error("demo/setup: failed to link demo auth user to staff rows", updateError);
      return NextResponse.json({ error: "Failed to link demo account" }, { status: 500 });
    }

    return NextResponse.json({ authUserId, demoEmail: DEMO_EMAIL });
  } catch (err) {
    console.error("demo/setup: unexpected error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
