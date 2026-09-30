import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/demo/check?slug=<slug>
 *
 * Public endpoint to check if an organization is a demo restaurant.
 * Returns: { isDemo: boolean, orgId?: string, orgName?: string }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, is_demo")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ isDemo: false });
  }

  return NextResponse.json({
    isDemo: org.is_demo ?? false,
    orgId: org.id,
    orgName: org.name,
  });
}
