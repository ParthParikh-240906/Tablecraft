import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // Redirect staff-only users directly to console, skipping the dashboard.
        try {
          const admin = createAdminClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: staffRows } = await admin
              .from("staff_users")
              .select("role")
              .eq("auth_user_id", user.id);
            const isOwner = (staffRows ?? []).some((r: any) => r.role === 'owner');
            const target = (staffRows ?? []).length > 0 && !isOwner ? "/console" : next;
            return NextResponse.redirect(`${origin}${target}`);
          }
        } catch (err) {
          console.error("auth/callback: staff lookup failed", err);
        }
        return NextResponse.redirect(`${origin}${next}`);
      }
      console.error("auth/callback: exchange failed", error.message);
    } catch (err) {
      console.error("auth/callback: unhandled", err);
    }
  } else {
    console.error("auth/callback: missing code");
  }

  // Return the user to login with error
  return NextResponse.redirect(`${origin}/console/login?error=auth_callback_failed`);
}