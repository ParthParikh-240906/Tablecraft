import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CATEGORIES = 200;
const MAX_CATEGORY_LEN = 100;

/**
 * PATCH /api/menu/categories/reorder
 * Update category_sort_order for categories.
 * Body: { categories: [{ category: string, category_sort_order: number }] }
 */
export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { categories, org_id } = (body ?? {}) as {
      categories?: unknown;
      org_id?: unknown;
    };

    if (!Array.isArray(categories) || categories.length === 0 || categories.length > MAX_CATEGORIES) {
      return NextResponse.json({ error: "Invalid categories array" }, { status: 400 });
    }

    if (typeof org_id !== "string" || !UUID_RE.test(org_id)) {
      return NextResponse.json({ error: "Invalid org_id" }, { status: 400 });
    }
    const auth = await requireStaffForOrgId(org_id);
    if ("response" in auth) return auth.response;

    for (const entry of categories) {
      const c = entry as { category?: unknown; category_sort_order?: unknown };
      if (
        typeof c.category !== "string" ||
        !c.category.trim() ||
        c.category.length > MAX_CATEGORY_LEN ||
        typeof c.category_sort_order !== "number" ||
        !Number.isInteger(c.category_sort_order) ||
        c.category_sort_order < 0 ||
        c.category_sort_order > 100000
      ) {
        return NextResponse.json({ error: "Invalid category entry" }, { status: 400 });
      }
    }

    const supabase = createAdminClient();

    for (const { category, category_sort_order } of categories as Array<{ category: string; category_sort_order: number }>) {
      const { error } = await supabase
        .from("menu_items")
        .update({ category_sort_order })
        .eq("category", category)
        .eq("org_id", org_id);

      if (error) {
        console.error(`Failed to update category ${category}:`, error);
        return NextResponse.json({ error: "Could not reorder categories. Please try again." }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[CATEGORIES REORDER] Error:", err);
    return NextResponse.json({ error: "Could not reorder categories. Please try again." }, { status: 500 });
  }
}
