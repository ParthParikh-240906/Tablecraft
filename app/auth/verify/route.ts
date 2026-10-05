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
  const rawType = searchParams.get("type") ?? "magiclink";
  const type = (["magiclink", "email", "recovery", "email_change"].includes(rawType) ? rawType : "magiclink") as "magiclink" | "email";
  const rawRedirect = searchParams.get("redirect_to") ?? "/console";
  // Allowlist: only same-origin absolute paths, no //evil or https://evil.
  const redirectTo =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/console";

  if (!tokenHash) {
    console.error("auth/verify: missing token_hash");
    return NextResponse.redirect(`${origin}/console/login?error=magiclink_failed`);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }

    console.error("auth/verify: verifyOtp failed", error.message);
    const code =
      /expired/i.test(error.message) ? "magiclink_failed&reason=expired" : "magiclink_failed";
    return NextResponse.redirect(`${origin}/console/login?error=${code}`);
  } catch (err) {
    console.error("auth/verify: unhandled", err);
    return NextResponse.redirect(`${origin}/console/login?error=magiclink_failed`);
  }
}