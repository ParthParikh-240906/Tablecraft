/**
 * lib/menu-order.ts — single source of truth for console↔website menu order.
 *
 * Console lists items grouped by category (category_sort_order) with items
 * inside each category by sort_order. The website "All" view must follow the
 * exact same sequence: serve queries order by
 *   category_sort_order NULLS LAST, sort_order NULLS LAST, id
 * and hand-added rows get end-of-list positions at insert (Postgres sorts
 * NULLS FIRST by default, which used to float new items to the top).
 */

export interface OrderableItem {
  category?: string | null;
  sort_order?: number | null;
  category_sort_order?: number | null;
}

function normCat(c: unknown): string | null {
  return typeof c === "string" && c.trim().length > 0 ? c : null;
}

/**
 * Default positions for a newly inserted item: end of its category, or
 * end of the list with a new trailing category slot.
 * Pure — unit-tested, used by the console menu manager.
 */
export function defaultSortOrders(
  existing: OrderableItem[],
  category: string | null,
): { sort_order: number; category_sort_order: number } {
  const cat = normCat(category);
  const sameCat = existing.filter((i) => normCat(i.category) === cat);
  const maxSort = sameCat.reduce<number>(
    (m, i) => (typeof i.sort_order === "number" ? Math.max(m, i.sort_order) : m),
    -1,
  );
  const existingCatOrder = sameCat
    .map((i) => i.category_sort_order)
    .find((n): n is number => typeof n === "number");
  if (typeof existingCatOrder === "number") {
    return { sort_order: maxSort + 1, category_sort_order: existingCatOrder };
  }
  const maxCat = existing.reduce<number>(
    (m, i) => (typeof i.category_sort_order === "number" ? Math.max(m, i.category_sort_order) : m),
    -1,
  );
  return { sort_order: 0, category_sort_order: maxCat + 1 };
}

/** Console/website display sequence: category, then item, then stable id. */
export function compareMenuOrder(
  a: OrderableItem & { id?: string },
  b: OrderableItem & { id?: string },
): number {
  const ca = typeof a.category_sort_order === "number" ? a.category_sort_order : Number.MAX_SAFE_INTEGER;
  const cb = typeof b.category_sort_order === "number" ? b.category_sort_order : Number.MAX_SAFE_INTEGER;
  if (ca !== cb) return ca - cb;
  const sa = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER;
  const sb = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER;
  if (sa !== sb) return sa - sb;
  return String(a.id ?? "").localeCompare(String(b.id ?? ""));
}
