import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { isUuid } from "@/lib/inventory-api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get("org_id");
    if (!isUuid(orgId) || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const auth = await requireStaffForOrgId(orgId);
    if ("response" in auth) return auth.response;

    const admin = createAdminClient();
    const { data: item } = await admin
      .from("inventory_items")
      .select("id")
      .eq("id", id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!item) return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });

    const { data, error } = await admin
      .from("inventory_transactions")
      .select("id, delta, balance_after, reason, reference_type, note, created_by, created_at")
      .eq("org_id", orgId)
      .eq("inventory_item_id", id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[INVENTORY] history failed:", error);
      return NextResponse.json(
        { error: "Could not load stock history. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ transactions: data ?? [] });
  } catch (err) {
    console.error("[INVENTORY] history unhandled:", err);
    return NextResponse.json(
      { error: "Could not load stock history. Please try again." },
      { status: 500 },
    );
  }
}
