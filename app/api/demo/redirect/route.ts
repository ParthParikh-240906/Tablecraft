import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

const DEMO_EMAIL = "demo@tablecraft.app";
const DEMO_PASSWORD = "demo123";

/**
 * GET /api/demo/redirect?org=<slug>
 *
 * Server-side redirect for the demo console button. Handles setup, verifies
 * credentials, and redirects directly to /auth/verify so right-click →
 * "Open in new tab" works without a 405.
 */
export async function GET(request: Request) {
  const rl = rateLimit(`demo:${getClientIp(request)}`, 20, 60_000);
  if (!rl.allowed) return rateLimitedResponse(rl.resetMs);

  try {
    const { searchParams } = new URL(request.url);
    const orgSlug = searchParams.get("org");

    if (!orgSlug || !/^[a-z0-9-]{2,40}$/.test(orgSlug)) {
      return NextResponse.redirect(new URL("/console/login", request.url));
    }

    const admin = createAdminClient();

    // 1. Look up the org
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("id, slug, is_demo, name")
      .eq("slug", orgSlug)
      .maybeSingle();

    if (orgError || !org || !org.is_demo) {
      return NextResponse.redirect(new URL("/console/login", request.url));
    }

    // 2. Look up the demo staff row
    const { data: staffData, error: staffError } = await admin
      .from("staff_users")
      .select("auth_user_id, console_password_hash")
      .eq("org_id", org.id)
      .eq("email", DEMO_EMAIL)
      .maybeSingle();

    if (staffError) {
      console.error("demo/redirect: staff lookup failed", staffError);
      return NextResponse.redirect(new URL("/console/login", request.url));
    }

    if (!staffData || !staffData.console_password_hash) {
      return NextResponse.redirect(new URL("/console/login", request.url));
    }

    let authUserId = staffData.auth_user_id;

    // 3. If no auth_user_id yet, create the shared demo auth user and link it
    if (!authUserId) {
      const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) {
        console.error("demo/redirect: list users failed", listError);
        return NextResponse.redirect(new URL("/console/login", request.url));
      }
      const existingUser = (existingUsers?.users ?? []).find((u) => u.email === DEMO_EMAIL);

      if (existingUser) {
        authUserId = existingUser.id;
      } else {
        const { data: newUser, error: createError } = await admin.auth.admin.createUser({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          email_confirm: true,
        });
        if (createError || !newUser?.user?.id) {
          console.error("demo/redirect: auth user creation failed", createError);
          return NextResponse.redirect(new URL("/console/login", request.url));
        }
        authUserId = newUser.user.id;
      }

      // Link auth user to ALL demo staff rows
      const { error: updateError } = await admin
        .from("staff_users")
        .update({ auth_user_id: authUserId, role: "owner" })
        .eq("email", DEMO_EMAIL);

      if (updateError) {
        console.error("demo/redirect: failed to link demo account", updateError);
        return NextResponse.redirect(new URL("/console/login", request.url));
      }
    }

    // 4. Verify console password
    const valid = await bcrypt.compare(DEMO_PASSWORD, staffData.console_password_hash);
    if (!valid) {
      return NextResponse.redirect(new URL("/console/login", request.url));
    }

    // 5. Generate a magiclink to get a token, then redirect directly to our
    //    /auth/verify endpoint (bypasses the Supabase-hosted magiclink page
    //    which was causing the 405 on the internal POST to /api/demo/setup).
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "";
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: DEMO_EMAIL,
      options: {
        redirectTo: `${origin}/auth/verify?redirect_to=${encodeURIComponent(`/console?org=${org.slug}`)}`,
      },
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("demo/redirect: generateLink failed", linkError);
      return NextResponse.redirect(new URL("/console/login", request.url));
    }

    const tokenHash = linkData.properties.hashed_token;

    // 6. Create snapshot before redirecting to console
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || ""}/api/demo/snapshot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orgId: org.id }),
      });
    } catch (err) {
      console.error("demo/redirect: failed to create snapshot", err);
    }

    // 7. Redirect to our own /auth/verify with the token — this creates the
    //    session and then redirects to /console?org=<slug>.
    const verifyUrl = new URL(
      `/auth/verify?token_hash=${tokenHash}&type=magiclink&redirect_to=${encodeURIComponent(`/console?org=${org.slug}`)}`,
      request.url,
    );

    return NextResponse.redirect(verifyUrl);
  } catch (err) {
    console.error("demo/redirect: unexpected error", err);
    return NextResponse.redirect(new URL("/", request.url));
  }
}
