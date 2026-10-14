/**
 * lib/demo-menu.ts — the build model invents MENU_ITEMS (it has no DB access).
 * Parse them out of built HTML and save to menu_items so the console Menu
 * section shows the same items as the site. Idempotent: previous demo items
 * are replaced on every (re)build. All failures are caller-handled (non-fatal).
 */

export const DEMO_MENU_ITEM_DESCRIPTION = "demo menu item";

export type DemoMenuItem = { name: string; price: number; category?: string };

/**
 * Pull the model's invented MENU_ITEMS const out of built HTML. The model
 * writes JS object literals (unquoted keys, possible trailing commas), so
 * normalize to strict JSON before parsing. Returns [] when absent/unparseable.
 */
export function extractDemoMenuItems(html: string): DemoMenuItem[] {
  const match = html.match(/const MENU_ITEMS\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!match) return [];
  const normalized = match[1]
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/,(\s*[}\]])/g, "$1");
  try {
    const parsed: unknown = JSON.parse(normalized);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string",
      )
      .map((item) => ({
        name: String((item as { name: unknown }).name).trim(),
        price: Number((item as { price?: unknown }).price),
        category:
          typeof (item as { category?: unknown }).category === "string"
            ? String((item as { category: unknown }).category)
            : undefined,
      }))
      .filter((item) => item.name.length > 0 && Number.isFinite(item.price));
  } catch {
    return [];
  }
}

type AdminClient = {
  from: (table: string) => any;
};

/**
 * Replace this org's demo items with the ones parsed from `html`.
 * Returns the ingested count (0 when none found).
 */
export async function ingestDemoMenuItems(
  admin: AdminClient,
  orgId: string,
  html: string,
): Promise<number> {
  const items = extractDemoMenuItems(html);
  if (items.length === 0) return 0;
  await admin.from("menu_items").delete().eq("org_id", orgId).eq("description", DEMO_MENU_ITEM_DESCRIPTION);
  const catOrder: Record<string, number> = {};
  let catIdx = 0;
  const rows = items.slice(0, 50).map((item, index) => {
    const cat = item.category || "General";
    if (!(cat in catOrder)) catOrder[cat] = catIdx++;
    return {
      org_id: orgId,
      name: item.name.slice(0, 200),
      description: DEMO_MENU_ITEM_DESCRIPTION,
      price: item.price,
      category: cat.slice(0, 100),
      available: true,
      sort_order: index + 1,
      category_sort_order: catOrder[cat] ?? 0,
    };
  });
  const { error: insertError } = await admin.from("menu_items").insert(rows);
  if (insertError) throw insertError;
  return rows.length;
}
