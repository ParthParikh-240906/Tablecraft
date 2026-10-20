-- 0041: retire the archive feature.
--
-- The product now exposes a real Delete action instead of soft archive.
-- Existing archived rows are restored so they remain visible and manageable;
-- the columns stay in the schema for backwards compatibility, but the UI and
-- API no longer archive items.
--
-- Deletion is a hard delete: inventory_item_ingredients, inventory_transactions,
-- inventory_aliases, and inventory_notifications cascade from inventory_items.

update public.inventory_items
set
  archived = false,
  archived_at = null,
  archived_by = null,
  updated_at = now()
where archived = true;
