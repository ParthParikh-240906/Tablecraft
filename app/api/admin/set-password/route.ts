import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import bcrypt from "bcryptjs";

/**
 * POST /api/admin/set-password
 *
 * Sets a password for an existing account that was created via Google OAuth
 * (which never gets a Supabase Auth password, leaving console_password_hash NULL).
 *
 * Requires the admin key header so only the operator can call it:
 *   x-admin-key: <REVIEW_GATE_KEY>
 *
 * Sets BOTH:
 *   1. Supabase Auth password  → enables signInWithPassword on /signin and /console/login
 *   2. staff_users.console_password_hash → enables the console fallback login
 */
export async function POST(request: Request) {
  try {
    const key = request.headers.get("x-admin-key");
    if (!key || key !== process.env.REVIEW_GATE_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const admin = createAdminClient();
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Find and update the Supabase auth user's password
    const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      return NextResponse.json({ error: "Could not look up users" }, { status: 500 });
    }
    const authUser = users.users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
    if (!authUser) {
      return NextResponse.json({ error: "No auth user found for that email — sign in once via Google first" }, { status: 404 });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(authUser.id, { password });
    if (updateError) {
      console.error("set-password: auth update failed", updateError);
      return NextResponse.json({ error: "Could not set auth password" }, { status: 500 });
    }

    // 2. Set console_password_hash on any staff rows for this user
    const consoleHash = await bcrypt.hash(password, 10);
    const { error: staffError } = await admin
      .from("staff_users")
      .update({ console_password_hash: consoleHash })
      .eq("auth_user_id", authUser.id);

    if (staffError) {
      console.warn("set-password: staff console hash update failed", staffError);
    }

    return NextResponse.json({
      success: true,
      message: "Password set for " + normalizedEmail + " — both email/password and console login now work.",
      authUserUpdated: true,
      consoleHashUpdated: !staffError,
    });
  } catch (err: any) {
    console.error("set-password error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}