import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";

/**
 * GET /api/demo/check?slug=<slug>
 *
 * Public endpoint to check if an organization is a demo restaurant.
 * Returns: { isDemo: boolean, orgId?: string, orgName?: string }
 */
export async function GET(request: Request) {
  const rl = rateLimit(`demo:${getClientIp(request)}`, 20, 60_000);
  if (!rl.allowed) return rateLimitedResponse(rl.resetMs);

  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: org, error } = await admin
      .from("organizations")
      .select("id, name, is_demo")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("demo/check: query failed", error);
      return NextResponse.json({ error: "Could not check demo status. Please try again." }, { status: 500 });
    }

    if (!org) {
      return NextResponse.json({ isDemo: false });
    }

    return NextResponse.json({
      isDemo: org.is_demo ?? false,
      orgId: org.id,
      orgName: org.name,
    });
  } catch (err) {
    console.error("demo/check: unhandled", err);
    return NextResponse.json({ error: "Could not check demo status. Please try again." }, { status: 500 });
  }
}
