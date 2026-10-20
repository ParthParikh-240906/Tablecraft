-- 0038: remove demo mode.
--
-- Demo mode let visitors sign into a shared `demo@tablecraft.app` account,
-- edit a restaurant, and have the database auto-restored from snapshots after
-- inactivity. That feature is being removed entirely.
--
-- This migration is intentionally separate from the application-code removal:
-- deploy the code first (so nothing reads these objects), then apply this
-- migration to drop the demo schema.
--
-- The shared Supabase Auth user (demo@tablecraft.app) is managed by Supabase
-- Auth, not this schema. Remove it in the Supabase dashboard if desired; no
-- application code references it after this change.

-- 1. Drop every demo RLS policy ------------------------------------------------
drop policy if exists "demo_snapshots_select_own" on public.demo_snapshots;
drop policy if exists "demo_snapshots_insert_own" on public.demo_snapshots;
drop policy if exists "demo_snapshots_delete_own" on public.demo_snapshots;

drop policy if exists "demo_select_orgs" on public.organizations;
drop policy if exists "demo_select_staff" on public.staff_users;

drop policy if exists "demo_select_menu" on public.menu_items;
drop policy if exists "demo_insert_menu" on public.menu_items;
drop policy if exists "demo_update_menu" on public.menu_items;
drop policy if exists "demo_delete_menu" on public.menu_items;

drop policy if exists "demo_select_tables" on public.tables;
drop policy if exists "demo_insert_tables" on public.tables;
drop policy if exists "demo_update_tables" on public.tables;
drop policy if exists "demo_delete_tables" on public.tables;

drop policy if exists "demo_select_bookings" on public.bookings;
drop policy if exists "demo_insert_bookings" on public.bookings;
drop policy if exists "demo_update_bookings" on public.bookings;
drop policy if exists "demo_delete_bookings" on public.bookings;

drop policy if exists "demo_select_orders" on public.orders;
drop policy if exists "demo_update_orders" on public.orders;

drop policy if exists "demo_select_booking_tables" on public.booking_tables;
drop policy if exists "demo_insert_booking_tables" on public.booking_tables;
drop policy if exists "demo_delete_booking_tables" on public.booking_tables;

-- 2. Drop the demo helper and snapshot store -----------------------------------
drop function if exists public.f_current_org_ids_for_demo();

drop table if exists public.demo_snapshots;

-- 3. Remove the demo flag from organizations -----------------------------------
-- The public view reads is_demo, so drop it first and recreate it below
-- without the column.
drop view if exists public.public_organizations;

alter table public.organizations
  drop column if exists is_demo;

-- 4. Remove shared demo staff rows ---------------------------------------------
delete from public.staff_users
where email = 'demo@tablecraft.app';

-- 5. Recreate the safe public projection without is_demo -----------------------
create view public.public_organizations as
select
  id,
  name,
  slug,
  logo_url,
  theme_color,
  theme_text_color,
  theme_secondary_color,
  theme_font_pair,
  theme_motif,
  tagline,
  about_text,
  about_title,
  contact_heading,
  location,
  restaurant_image_url,
  branches,
  contact_address,
  design_settings,
  restaurant_photos,
  background_image_url,
  created_at,
  contact_phone,
  contact_email,
  mobile_background_image_url
from public.organizations;

grant select on public.public_organizations to anon, authenticated;

comment on view public.public_organizations is
  'Safe public projection of organizations for anon clients. Excludes stripe_customer_id, stripe_subscription_id, subscription_*, and the removed is_demo flag. Includes contact_phone/contact_email (published business contact info) and mobile_background_image_url (mobile hero image for the built site). All anon/authenticated reads must use this view, never the base table.';
