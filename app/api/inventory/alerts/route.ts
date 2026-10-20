import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { isUuid } from "@/lib/inventory-api";
import { getStockStatus } from "@/lib/inventory";

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
    const [{ data: items, error: itemsError }, { data: notifications, error: notifError }] =
      await Promise.all([
        admin
          .from("inventory_items")
          .select("id, quantity_on_hand, par_level, low_stock_percent, track_stock, archived")
          .eq("org_id", orgId)
          .eq("archived", false)
          .eq("track_stock", true),
        admin
          .from("inventory_notifications")
          .select("id, title, body, type, status, created_at")
          .eq("org_id", orgId)
          .is("cleared_at", null)
          .in("status", ["unread", "read"])
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

    if (itemsError || notifError) {
      console.error("[INVENTORY] alerts failed:", itemsError ?? notifError);
      return NextResponse.json(
        { error: "Could not load stock alerts. Please try again." },
        { status: 500 },
      );
    }

    let lowStock = 0;
    let outOfStock = 0;
    for (const item of items ?? []) {
      const status = getStockStatus(item as {
        quantity_on_hand: number;
        par_level: number | null;
        low_stock_percent: number;
        track_stock: boolean;
        archived: boolean;
      });
      if (status === "low") lowStock++;
      if (status === "out") outOfStock++;
    }

    return NextResponse.json({
      lowStock,
      outOfStock,
      unreadNotifications: (notifications ?? []).filter(
        (n: { status: string }) => n.status === "unread",
      ).length,
      notifications: notifications ?? [],
    });
  } catch (err) {
    console.error("[INVENTORY] alerts unhandled:", err);
    return NextResponse.json(
      { error: "Could not load stock alerts. Please try again." },
      { status: 500 },
    );
  }
}
