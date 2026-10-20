import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { isUuid, parseRecipeInput } from "@/lib/inventory-api";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const b = body as Record<string, unknown>;
    const orgId = b?.org_id;
    if (!isUuid(orgId) || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const auth = await requireStaffForOrgId(orgId);
    if ("response" in auth) return auth.response;

    const parsed = parseRecipeInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const admin = createAdminClient();
    const { data: menuItem } = await admin
      .from("menu_items")
      .select("id")
      .eq("id", id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!menuItem) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    const inventoryIds = parsed.items.map((i) => i.inventory_item_id);
    if (inventoryIds.length > 0) {
      const { data: inventoryRows } = await admin
        .from("inventory_items")
        .select("id")
        .eq("org_id", orgId)
        .eq("archived", false)
        .in("id", inventoryIds);
      if ((inventoryRows ?? []).length !== inventoryIds.length) {
        return NextResponse.json(
          { error: "One or more ingredients were not found or are archived." },
          { status: 400 },
        );
      }
    }

    const { error } = await admin.rpc("replace_menu_item_ingredients", {
      p_org_id: orgId,
      p_menu_item_id: id,
      p_items: parsed.items,
    });

    if (error) {
      console.error("[MENU INGREDIENTS] replace failed:", error);
      return NextResponse.json(
        { error: "Could not save the recipe. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, count: parsed.items.length });
  } catch (err) {
    console.error("[MENU INGREDIENTS] unhandled:", err);
    return NextResponse.json(
      { error: "Could not save the recipe. Please try again." },
      { status: 500 },
    );
  }
}
