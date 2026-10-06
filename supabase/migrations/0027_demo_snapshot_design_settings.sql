-- Add design_settings to the allowed snapshot_type values
-- This allows the demo snapshot/restore to capture organization design changes

ALTER TABLE public.demo_snapshots
  DROP CONSTRAINT demo_snapshots_snapshot_type_check;

ALTER TABLE public.demo_snapshots
  ADD CONSTRAINT demo_snapshots_snapshot_type_check
  CHECK (snapshot_type IN ('menu_items', 'tables', 'bookings', 'orders', 'booking_tables', 'design_settings'));
