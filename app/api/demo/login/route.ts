import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import bcrypt from "bcryptjs";

const DEMO_EMAIL = "demo@tablecraft.app";
const DEMO_PASSWORD = "demo123";

/**
 * POST /api/demo/login
 *
 * Demo login: verifies the org is a demo org, then authenticates using the
 * shared demo credentials. Returns a magiclink URL that creates a Supabase
 * session and redirects to the console.
 *
 * Body: { orgSlug: string }
 * Returns: { success: true, orgId, orgSlug, magicLink }
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { orgSlug } = (body ?? {}) as { orgSlug?: unknown };

    if (typeof orgSlug !== "string" || !/^[a-z0-9-]{2,40}$/.test(orgSlug)) {
      return NextResponse.json({ error: "Invalid orgSlug" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Look up the org
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("id, slug, is_demo, name")
      .eq("slug", orgSlug)
      .maybeSingle();

    if (orgError || !org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!org.is_demo) {
      return NextResponse.json({ error: "This organization is not a demo restaurant" }, { status: 403 });
    }

    // 2. Look up the demo staff row
    const { data: staffData, error: staffError } = await admin
      .from("staff_users")
      .select("auth_user_id, console_password_hash")
      .eq("org_id", org.id)
      .eq("email", DEMO_EMAIL)
      .maybeSingle();

    if (staffError || !staffData) {
      return NextResponse.json({ error: "Demo staff account not configured" }, { status: 500 });
    }

    let authUserId = staffData.auth_user_id;

    // 3. If no auth_user_id yet, run setup to create the shared demo auth user
    if (!authUserId) {
      const setupUrl = new URL("/api/demo/setup", request.url).toString();
      const setupRes = await fetch(setupUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!setupRes.ok) {
        console.error("demo/login: setup failed:", setupRes.status);
        return NextResponse.json({ error: "Could not initialize the demo. Please try again." }, { status: 500 });
      }
      // Re-fetch staff after setup
      const { data: updatedStaff, error: updatedError } = await admin
        .from("staff_users")
        .select("auth_user_id")
        .eq("org_id", org.id)
        .eq("email", DEMO_EMAIL)
        .maybeSingle();
      if (updatedError) {
        console.error("demo/login: staff re-fetch failed", updatedError);
        return NextResponse.json({ error: "Could not initialize the demo. Please try again." }, { status: 500 });
      }
      if (!updatedStaff?.auth_user_id) {
        return NextResponse.json({ error: "Could not initialize the demo. Please try again." }, { status: 500 });
      }
      authUserId = updatedStaff.auth_user_id;
    }

    // 4. Verify console password
    if (!staffData.console_password_hash) {
      return NextResponse.json({ error: "Demo account not configured" }, { status: 500 });
    }

    const valid = await bcrypt.compare(DEMO_PASSWORD, staffData.console_password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid demo credentials" }, { status: 401 });
    }

    // 5. Get the auth user's email
    const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(authUserId);
    if (authUserError) {
      console.error("demo/login: getUserById failed", authUserError);
      return NextResponse.json({ error: "Could not initialize the demo. Please try again." }, { status: 500 });
    }
    const authEmail = authUser?.user?.email;
    if (!authEmail) {
      return NextResponse.json({ error: "Could not initialize the demo. Please try again." }, { status: 500 });
    }

    // 6. Generate a magiclink
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "";
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: authEmail,
      options: {
        redirectTo: `${origin}/auth/verify?redirect_to=${encodeURIComponent(`/console?org=${org.slug}`)}`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("demo/login: generateLink failed", linkError);
      return NextResponse.json({ error: "Could not create login link" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      orgId: org.id,
      orgSlug: org.slug,
      orgName: org.name,
      magicLink: linkData.properties.action_link,
    });
  } catch (err) {
    console.error("demo/login: unexpected error", err);
    return NextResponse.json({ error: "Could not initialize the demo. Please try again." }, { status: 500 });
  }
}
