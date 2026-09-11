import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Public demo directory: returns ONLY the restaurants owned by the demo
 * account (parth@gmail.com). Everyone else sees their own restaurants in
 * their dashboard after signing in.
 */
const DEMO_OWNER_EMAIL = "parth@gmail.com";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("staff_users")
    .select(
      "organizations(id, name, slug, logo_url, theme_color, tagline, created_at)",
    )
    .eq("email", DEMO_OWNER_EMAIL)
    .order("created_at", { referencedTable: "organizations", ascending: true });

  if (error) {
    console.error("demo-restaurants: query failed", error);
    return NextResponse.json({ orgs: [] }, { status: 200 });
  }

  const orgs = (data ?? [])
    .map((r: any) => (Array.isArray(r.organizations) ? r.organizations[0] : r.organizations))
    .filter(Boolean);

  return NextResponse.json({ orgs });
}