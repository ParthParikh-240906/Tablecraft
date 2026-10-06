import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/menu/items/[id]/move
 * Move an item up or down within its category.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { id } = await params;
    const { direction } = (body ?? {}) as { direction?: unknown };

    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }
    if (direction !== "up" && direction !== "down") {
      return NextResponse.json({ error: "direction must be 'up' or 'down'" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get current item
    const { data: currentItem, error: fetchError } = await supabase
      .from("menu_items")
      .select("id, org_id, category, sort_order, category_sort_order, name")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("[MOVE ITEM] fetch failed:", fetchError);
      return NextResponse.json({ error: "Could not move item. Please try again." }, { status: 500 });
    }
    if (!currentItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const auth = await requireStaffForOrgId(currentItem.org_id);
    if ("response" in auth) return auth.response;

    const { category, sort_order } = currentItem;

  // Find adjacent item: the one with sort_order just before or after current
  let query = supabase
    .from("menu_items")
    .select("id, name, sort_order")
    .eq("org_id", currentItem.org_id)
    .eq("category", category);

  if (direction === "up") {
    // Find highest sort_order that is less than current
    query = query.lt("sort_order", sort_order).order("sort_order", { ascending: false }).limit(1);
  } else {
    // Find lowest sort_order that is greater than current
    query = query.gt("sort_order", sort_order).order("sort_order", { ascending: true }).limit(1);
  }

  const { data: adjacentItems, error: adjError } = await query;

  if (adjError) {
    console.error("[MOVE ITEM] adjacent lookup failed:", adjError);
    return NextResponse.json({ error: "Could not move item. Please try again." }, { status: 500 });
  }
  if (!adjacentItems || adjacentItems.length === 0) {
    return NextResponse.json({ error: "Cannot move further" }, { status: 400 });
  }

  const target = adjacentItems[0];

  // Swap sort_order values
  const { error: err1 } = await supabase
    .from("menu_items")
    .update({ sort_order: target.sort_order })
    .eq("id", id);

  const { error: err2 } = await supabase
    .from("menu_items")
    .update({ sort_order: sort_order })
    .eq("id", target.id);

  if (err1 || err2) {
    console.error("Move failed:", err1 || err2);
    return NextResponse.json({ error: "Could not move item. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[MOVE ITEM] unhandled:", err);
    return NextResponse.json({ error: "Could not move item. Please try again." }, { status: 500 });
  }
}
