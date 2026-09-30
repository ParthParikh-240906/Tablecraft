import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Redirect staff-only users directly to console, skipping the dashboard.
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
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to login with error
  return NextResponse.redirect(`${origin}/console/login?error=auth_callback_failed`);
}