import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/menu/categories/reorder
 * Update category_sort_order for categories.
 * Body: { categories: [{ category: string, category_sort_order: number }] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { categories, org_id }: { categories: Array<{ category: string; category_sort_order: number }>; org_id: string } =
      await request.json();

    if (!Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json({ error: "Invalid categories array" }, { status: 400 });
    }

    if (!org_id) {
      return NextResponse.json({ error: "org_id is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    console.log("[CATEGORIES REORDER] Updating categories for org:", org_id, categories);

    for (const { category, category_sort_order } of categories) {
      const { error } = await supabase
        .from("menu_items")
        .update({ category_sort_order })
        .eq("category", category)
        .eq("org_id", org_id);

      console.log(`[CATEGORIES REORDER] ${category}: error=`, error);

      if (error) {
        console.error(`Failed to update category ${category}:`, error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[CATEGORIES REORDER] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
