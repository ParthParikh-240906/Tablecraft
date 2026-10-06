-- =============================================================================
-- Tablecraft — 0029_booking_no_overlap.sql
-- Advisory: double-booking race hardening for /api/bookings.
--
-- The API now checks BOTH explicit paths (single tableId AND operator
-- tableIds) against the same conflicting-bookings window as the auto-select
-- path and returns 409 on conflict. That closes the skipped-check hole, but
-- it is still application-level: two concurrent requests can interleave
-- SELECT (conflict check) → INSERT and double-book the same table.
--
-- A true guarantee needs a DB-level exclusion constraint on the booking
-- time window, e.g. (org_id, table_id, tstzrange(datetime, datetime +
-- duration)) with btree_gist. Duration is dynamic per org
-- (design_settings.booking_config), so a static constraint can't express it
-- directly — it would require normalizing a computed window column first.
-- Until that lands, the app-level 409 check + this index are the defense.
-- Supabase JS cannot SELECT ... FOR UPDATE, so serialization isn't available
-- from the API layer either.
-- =============================================================================

-- Speed the conflict-window lookup in /api/bookings
-- (... eq org_id, in status, gt/lt datetime).
create index if not exists idx_bookings_org_status_datetime
  on public.bookings (org_id, status, datetime);

-- Speed the junction expansion (booking_tables by booking_id).
create index if not exists idx_booking_tables_booking_id
  on public.booking_tables (booking_id);
