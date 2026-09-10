import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/verify
 *
 * Exchanges a magiclink token (minted by /api/console/login after the staff
 * console password is verified) into a real Supabase session cookie.
 *
 * URL shape: /auth/verify?token=<token_hash>&type=magiclink&redirect_to=/console
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
  const type = (searchParams.get("type") as "magiclink" | "email" | null) ?? "magiclink";
  const redirectTo = searchParams.get("redirect_to") ?? "/console";

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }

    console.error("auth/verify: verifyOtp failed", error);
  }

  return NextResponse.redirect(`${origin}/console/login?error=magiclink_failed`);
}