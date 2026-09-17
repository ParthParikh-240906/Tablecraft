-- Add parent_order_id to orders so extra/add-on orders can reference their original
ALTER TABLE public.orders ADD COLUMN parent_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
