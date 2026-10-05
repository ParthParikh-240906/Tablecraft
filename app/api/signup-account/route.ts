import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/signup-account
 *
 * Creates a new Supabase Auth user (email + password) with no restaurant attached.
 * After creation the user must sign in at /signin.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { email, password } = (body ?? {}) as { email?: string; password?: string };

    if (!email || typeof email !== "string" || !email.includes("@") || email.length > 255) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Password must be 8-128 characters" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message?.toLowerCase().includes("already")) {
        return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
      }
      console.error("signup-account: auth user creation failed", authError);
      return NextResponse.json({ error: "Could not create account" }, { status: 500 });
    }

    console.log("[SIGNUP-ACCOUNT] Created auth user");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("signup-account: unexpected error", e);
    return NextResponse.json({ error: "Could not create account. Please try again." }, { status: 500 });
  }
}
