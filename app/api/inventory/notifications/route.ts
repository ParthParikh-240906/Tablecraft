import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { isUuid } from "@/lib/inventory-api";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get("org_id");
    if (!isUuid(orgId)) {
      return NextResponse.json({ error: "Invalid org_id" }, { status: 400 });
    }

    const auth = await requireStaffForOrgId(orgId);
    if ("response" in auth) return auth.response;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("inventory_notifications")
      .select("*")
      .eq("org_id", orgId)
      .is("cleared_at", null)
      .in("status", ["unread", "read"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[INVENTORY] notifications list failed:", error);
      return NextResponse.json(
        { error: "Could not load notifications. Please try again." },
        { status: 500 },
      );
    }

    const notifications = data ?? [];
    return NextResponse.json({
      notifications,
      unreadCount: notifications.filter((n: { status: string }) => n.status === "unread").length,
    });
  } catch (err) {
    console.error("[INVENTORY] notifications list unhandled:", err);
    return NextResponse.json(
      { error: "Could not load notifications. Please try again." },
      { status: 500 },
    );
  }
}
