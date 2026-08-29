import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/signup
 * Creates a new restaurant organization + owner staff account in one go.
 *
 * Flow:
 *   1. Validate inputs (org name, slug, owner email, password)
 *   2. Create the Supabase Auth user (admin API, email confirmed)
 *   3. Create the organization row
 *   4. Create the staff_users owner row linked to the auth user
 *
 * Uses the service-role client (bypasses RLS) — this is the sanctioned
 * public signup path. All inputs validated server-side.
 */
export async function POST(request: Request) {
  let body: {
    orgName?: string;
    slug?: string;
    email?: string;
    password?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { orgName, slug, email, password } = body;

  // --- Validate inputs ---
  if (!orgName || typeof orgName !== "string" || orgName.trim().length < 2) {
    return NextResponse.json({ error: "orgName must be at least 2 characters" }, { status: 400 });
  }
  if (!slug || typeof slug !== "string" || !/^[a-z0-9-]{2,40}$/.test(slug)) {
    return NextResponse.json(
      { error: "slug must be 2-40 chars: lowercase letters, numbers, hyphens" },
      { status: 400 },
    );
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }

  const admin = createAdminClient();

  // --- Check slug is not taken ---
  const { data: existingOrg } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existingOrg) {
    return NextResponse.json({ error: "That URL slug is already taken" }, { status: 409 });
  }

  // --- Create the auth user ---
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
  });

  if (authError) {
    // Common: email already registered
    if (authError.message?.toLowerCase().includes("already")) {
      return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
    }
    console.error("signup: auth user creation failed", authError);
    return NextResponse.json({ error: "Could not create account" }, { status: 500 });
  }

  // --- Create the organization ---
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: orgName.trim(), slug })
    .select()
    .single();

  if (orgError) {
    console.error("signup: org creation failed", orgError);
    // Roll back the auth user so we don't leave an orphan account
    await admin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: "Could not create organization" }, { status: 500 });
  }

  // --- Create the owner staff row ---
  const { error: staffError } = await admin.from("staff_users").insert({
    org_id: org.id,
    email: email.trim().toLowerCase(),
    role: "owner",
    auth_user_id: authUser.user.id,
  });

  if (staffError) {
    console.error("signup: staff creation failed", staffError);
    // Roll back both the org and the auth user
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: "Could not create staff account" }, { status: 500 });
  }

  return NextResponse.json(
    { org: { id: org.id, name: org.name, slug: org.slug } },
    { status: 201 },
  );
}