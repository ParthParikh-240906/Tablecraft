-- Add sorting fields to menu_items
ALTER TABLE menu_items ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN category_sort_order INTEGER DEFAULT 0;

-- Update existing items with sequential sort_order within categories
WITH ranked AS (
  SELECT id, category,
         ROW_NUMBER() OVER (PARTITION BY COALESCE(category, 'Other') ORDER BY created_at) as rn
  FROM menu_items
)
UPDATE menu_items
SET sort_order = ranked.rn
FROM ranked
WHERE menu_items.id = ranked.id;

-- Set category_sort_order based on first item's category
WITH cat_rank AS (
  SELECT DISTINCT category,
         ROW_NUMBER() OVER (ORDER BY MIN(created_at)) as rn
  FROM menu_items
  GROUP BY category
)
UPDATE menu_items
SET category_sort_order = cat_rank.rn
FROM cat_rank
WHERE menu_items.category = cat_rank.category;
