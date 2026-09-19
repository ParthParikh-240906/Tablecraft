-- Add orders table to supabase_realtime publication so INSERT/UPDATE/DELETE
-- events broadcast to all connected clients (dashboard, kitchen, other devices).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END$$;
