-- Add sorting columns
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS category_sort_order INTEGER DEFAULT 0;

-- Set initial sort_order for existing items (using id for stable ordering)
WITH ranked AS (
  SELECT id, category,
         ROW_NUMBER() OVER (PARTITION BY COALESCE(category, 'Other') ORDER BY id) as rn
  FROM menu_items
)
UPDATE menu_items
SET sort_order = ranked.rn
FROM ranked
WHERE menu_items.id = ranked.id;

-- Set initial category_sort_order (category order based on first item's id in each category)
WITH cat_order AS (
  SELECT category, MIN(id::text) as min_id
  FROM menu_items
  GROUP BY category
),
cat_rank AS (
  SELECT category,
         ROW_NUMBER() OVER (ORDER BY min_id) as rn
  FROM cat_order
)
UPDATE menu_items
SET category_sort_order = cat_rank.rn
FROM cat_rank
WHERE menu_items.category = cat_rank.category;
