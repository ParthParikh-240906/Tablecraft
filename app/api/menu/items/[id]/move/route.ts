import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/menu/items/[id]/move
 * Move an item up or down within its category.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { direction }: { direction: "up" | "down" } = await request.json();

  if (!id || !direction) {
    return NextResponse.json({ error: "Missing id or direction" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get current item
  const { data: currentItem, error: fetchError } = await supabase
    .from("menu_items")
    .select("id, org_id, category, sort_order, category_sort_order, name")
    .eq("id", id)
    .single();

  if (fetchError || !currentItem) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const { category, sort_order } = currentItem;
  console.log(`[MOVE ITEM] ${currentItem.name}: sort_order=${sort_order}, direction=${direction}`);

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

  if (adjError || !adjacentItems || adjacentItems.length === 0) {
    console.log(`[MOVE ITEM] No adjacent item found for ${currentItem.name}`);
    return NextResponse.json({ error: "Cannot move further" }, { status: 400 });
  }

  const target = adjacentItems[0];
  console.log(`[MOVE ITEM] Swapping ${currentItem.name} (${sort_order}) with ${target.name} (${target.sort_order})`);

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
    return NextResponse.json({ error: "Failed to move item" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
