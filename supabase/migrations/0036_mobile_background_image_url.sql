-- =============================================================================
-- Tablecraft — 0036_mobile_background_image_url.sql
--
-- Mobile hero image for AI-built sites.
--
-- organizations.mobile_background_image_url stores the optional mobile-only
-- hero upload from /restaurants/create ("Hero image for mobile"). The AI build
-- (/api/ai/build) uses background_image_url for HERO_IMAGE_URL (desktop/tablet)
-- and mobile_background_image_url for HERO_IMAGE_URL_MOBILE (720px and below).
-- Each breakpoint is independent: when a URL is empty that breakpoint shows
-- the built CSS-art hero instead (an empty mobile const no longer reuses the
-- desktop image — see the BUILD_SYSTEM hero rule).
--
-- Also extends the safe public_organizations view so the public site + console
-- preview can live-swap the mobile hero const (lib/built-site.ts
-- withLiveHeroMobile) without a rebuild — same serving pattern as the desktop
-- hero (withLiveHero). No new storage bucket: the mobile hero uploads into the
-- existing 'org-backgrounds' bucket (0005).
--
-- NOTE on the view: PostgreSQL can only APPEND columns to an existing view via
-- create or replace view — inserting a column mid-list fails with
-- "cannot change name of view column" (42P16). So the new column goes at the
-- END of the select list. Every consumer (lib/org.ts, middleware.ts,
-- app/mock/page.tsx) reads named columns, so column order is irrelevant.
-- =============================================================================

-- --- 1. New column ------------------------------------------------------------
alter table public.organizations
  add column if not exists mobile_background_image_url text;

-- --- 2. Extend the safe public view (same projection policy as 0032) ----------
create or replace view public.public_organizations as
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
  is_demo,
  created_at,
  contact_phone,
  contact_email,
  mobile_background_image_url
from public.organizations;

grant select on public.public_organizations to anon, authenticated;

comment on view public.public_organizations is
  'Safe public projection of organizations for anon clients. Excludes stripe_customer_id, stripe_subscription_id, subscription_*. Includes contact_phone/contact_email (published business contact info) and mobile_background_image_url (mobile hero image for the built site, mirrors background_image_url; appended last because create or replace view can only add trailing columns). All anon/authenticated reads must use this view, never the base table.';
