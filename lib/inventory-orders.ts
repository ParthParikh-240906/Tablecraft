/**
 * Pure order → ingredient usage aggregation.
 *
 * The production path runs inside the `apply_order_inventory` SQL function so
 * the stock update and ledger row are atomic. This helper mirrors that math so
 * it can be unit-tested without a database.
 */
export type OrderItemForUsage = { id: string; quantity: number };

export type RecipeRowForUsage = {
  menu_item_id: string;
  inventory_item_id: string;
  quantity: number;
};

export type MenuItemFlag = { id: string; deducts_stock: boolean };

export type InventoryItemFlag = {
  id: string;
  track_stock: boolean;
  archived: boolean;
};

export function calculateOrderIngredientUsage(
  orderItems: OrderItemForUsage[],
  recipes: RecipeRowForUsage[],
  menuItems: MenuItemFlag[],
  inventoryItems: InventoryItemFlag[],
): Map<string, number> {
  const menuById = new Map(menuItems.map((m) => [m.id, m]));
  const inventoryById = new Map(inventoryItems.map((i) => [i.id, i]));
  const recipesByMenu = new Map<string, RecipeRowForUsage[]>();

  for (const recipe of recipes) {
    const list = recipesByMenu.get(recipe.menu_item_id) ?? [];
    list.push(recipe);
    recipesByMenu.set(recipe.menu_item_id, list);
  }

  const usage = new Map<string, number>();

  for (const orderItem of orderItems) {
    const menu = menuById.get(orderItem.id);
    if (!menu || !menu.deducts_stock) continue;
    const qty = Number(orderItem.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    for (const recipe of recipesByMenu.get(orderItem.id) ?? []) {
      const inventory = inventoryById.get(recipe.inventory_item_id);
      if (!inventory || !inventory.track_stock || inventory.archived) continue;
      const amount = Number(recipe.quantity) * qty;
      if (!Number.isFinite(amount) || amount <= 0) continue;
      usage.set(recipe.inventory_item_id, (usage.get(recipe.inventory_item_id) ?? 0) + amount);
    }
  }

  return usage;
}
