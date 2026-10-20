import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { isUuid } from "@/lib/inventory-api";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const b = body as Record<string, unknown>;
    const orgId = b?.org_id;
    if (!isUuid(orgId)) {
      return NextResponse.json({ error: "Invalid org_id" }, { status: 400 });
    }

    const auth = await requireStaffForOrgId(orgId);
    if ("response" in auth) return auth.response;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("inventory_notifications")
      .update({
        status: "cleared",
        cleared_at: new Date().toISOString(),
        cleared_by: auth.user.id,
      })
      .eq("org_id", orgId)
      .is("cleared_at", null)
      .in("status", ["unread", "read"])
      .select("id");

    if (error) {
      console.error("[INVENTORY] clear notifications failed:", error);
      return NextResponse.json(
        { error: "Could not clear notifications. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ cleared: data?.length ?? 0 });
  } catch (err) {
    console.error("[INVENTORY] clear notifications unhandled:", err);
    return NextResponse.json(
      { error: "Could not clear notifications. Please try again." },
      { status: 500 },
    );
  }
}
