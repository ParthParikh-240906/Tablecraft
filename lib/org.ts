import { createClient } from "@/lib/supabase/server";

/**
 * Resolve an organization by its URL slug.
 * Used by the public site pages (landing, menu) so they stay consistent.
 * Returns null if the org doesn't exist (caller renders notFound()).
 */
export async function getOrgBySlug(slug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, theme_color")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getOrgBySlug:", error);
    return null;
  }

  return data;
}

/**
 * Fetch the available menu items for an org, grouped by category.
 * Uses the public read policy (only available=true items are returned).
 */
export async function getMenuByOrg(orgId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, description, price, category, image_url")
    .eq("org_id", orgId)
    .eq("available", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("getMenuByOrg:", error);
    return [];
  }

  // Group by category, preserving alphabetical category order.
  const grouped = new Map<string, typeof data>();
  for (const item of data) {
    const cat = item.category ?? "Other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }

  return Array.from(grouped.entries()).map(([category, items]) => ({
    category,
    items,
  }));
}