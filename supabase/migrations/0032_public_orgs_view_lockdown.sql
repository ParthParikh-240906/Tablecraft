-- =============================================================================
-- Tablecraft — 0032_public_orgs_view_lockdown.sql
--
-- Finish the job started in 0028: all anon/authenticated reads now go through
-- the safe `public_organizations` view (lib/org.ts, middleware, mock page),
-- so the overly-permissive base-table policy can go.
--
-- 1. Add contact_phone/contact_email to the view. The public site renders
--    these in the restaurant contact section by design (the owner's published
--    business contact info), so they belong in the public projection.
--    stripe_*/subscription_* stay out — that is the actual leak being closed.
-- 2. Drop policy "public_read_organizations" (USING(true) to anon +
--    authenticated over ALL columns incl. billing PII).
--
-- After this: anon has zero access to the base table; public reads flow
-- through the SECURITY DEFINER view (unaffected by base-table RLS).
-- Authenticated staff keep base-table access via
-- "staff_select_own_orgs_multi" (0020). Service-role backends bypass RLS.
-- =============================================================================

-- --- 1. Extend the safe public view ------------------------------------------
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
  contact_email
from public.organizations;

grant select on public.public_organizations to anon, authenticated;

comment on view public.public_organizations is
  'Safe public projection of organizations for anon clients. Excludes stripe_customer_id, stripe_subscription_id, subscription_*. Includes contact_phone/contact_email because the public site renders them in the restaurant contact section. All anon/authenticated reads must use this view, never the base table.';

-- --- 2. Drop the overly-permissive base-table policy --------------------------
drop policy if exists "public_read_organizations" on public.organizations;
