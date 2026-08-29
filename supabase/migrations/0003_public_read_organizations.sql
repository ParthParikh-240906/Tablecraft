-- =============================================================================
-- Tablecraft — 0003_public_read_organizations.sql
-- The public site needs the org's name, slug, logo, and theme color to render
-- the landing page. Add a read-only public policy on `organizations`.
--
-- This exposes ONLY the public-facing metadata columns. It does NOT expose
-- staff_users, bookings, or orders (those remain staff-only via RLS).
-- =============================================================================

create policy "public_read_organizations"
  on public.organizations for select
  to anon, authenticated
  using (true);