import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import bcrypt from "bcryptjs";

/**
 * POST /api/console/login
 *
 * Verifies a staff member's independent console password (stored as a hash
 * in staff_users.console_password_hash — separate from Supabase auth).
 *
 * On success, generates a magiclink for the linked Supabase auth user and
 * returns the URL the client must navigate to. That link lands on /auth/verify,
 * which exchanges the token for a real Supabase session cookie.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length === 0) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Look up staff by email
    const { data: staff, error: staffError } = await admin
      .from("staff_users")
      .select("auth_user_id, email, console_password_hash")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (staffError || !staff || !staff.console_password_hash) {
      // No console password set for this staff member
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // 2. Verify the console password hash
    const valid = await bcrypt.compare(password, staff.console_password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // 3. Find the linked Supabase auth user
    if (!staff.auth_user_id) {
      return NextResponse.json({ error: "Staff account is not linked to a user" }, { status: 401 });
    }

    // 4. Get the auth user's email (must match for magiclink)
    const { data: authUser } = await admin.auth.admin.getUserById(staff.auth_user_id);
    const authEmail = authUser?.user?.email;
    if (!authEmail) {
      return NextResponse.json({ error: "Linked user has no email" }, { status: 401 });
    }

    // 5. Generate a magiclink to exchange into a session
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "";
    const { data, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: authEmail,
      options: {
        redirectTo: `${origin}/auth/verify?redirect_to=/console`,
      },
    });

    if (linkError || !data?.properties?.action_link) {
      console.error("console/login: generateLink failed", linkError);
      return NextResponse.json({ error: "Could not create login link" }, { status: 500 });
    }

    return NextResponse.json({ url: data.properties.action_link });
  } catch (err) {
    console.error("console/login:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}