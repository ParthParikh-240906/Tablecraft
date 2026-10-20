-- 0039: remove the legacy "Demo Diner" seed organization.
--
-- 0002_seed.sql created a normal seeded restaurant (slug `demo-diner`) with
-- sample menu items, tables, a demo-owner@demo.com staff row, and bookings.
-- It was used for local demos/judging, not for the shared demo console, but it
-- is no longer wanted. Deleting the organization cascades to its staff rows,
-- menu items, tables, bookings, booking_tables, orders, paragraphs, domains,
-- and active sessions (all FKs use ON DELETE CASCADE).
--
-- This migration is idempotent: if the org was already removed, it is a no-op.

delete from public.organizations
where slug = 'demo-diner';
