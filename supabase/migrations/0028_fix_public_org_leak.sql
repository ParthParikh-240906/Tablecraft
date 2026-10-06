-- =============================================================================
-- Tablecraft — 0028_fix_public_org_leak.sql
-- Harden overly-permissive policies found in audit:
--
-- 1. organizations.public_read_organizations uses USING(true), so ANY anon
--    client can SELECT sensitive columns (stripe_customer_id,
--    stripe_subscription_id, subscription_*, contact_email, contact_phone).
--    RLS cannot do column-level grants, so we expose a safe view
--    `public_organizations` (no sensitive columns) for anon use and
--    document that the base-table policy is load-bearing for the public
--    site (lib/org.ts getOrgBySlug/getOrgs) until callers migrate to it.
-- 2. Storage INSERT policies on org-videos / org-custom-fonts allowed anon
--    uploads (quota burn + abuse). Tighten to authenticated-only; uploads
--    still go through service-role API routes with staff checks.
-- 3. demo_snapshots policies use USING(true) with session scoping enforced
--    only in the API layer — documented here; scoped to authenticated.
-- =============================================================================

-- --- 1. Safe public view (no billing / contact PII columns) ------------------
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
  created_at
from public.organizations;

grant select on public.public_organizations to anon, authenticated;

comment on view public.public_organizations is
  'Safe public projection of organizations for anon clients. Excludes stripe_customer_id, stripe_subscription_id, subscription_*, contact_email, contact_phone. Prefer this over direct anon SELECT on organizations.';

comment on policy "public_read_organizations" on public.organizations is
  'LOAD-BEARING for the public site (lib/org.ts getOrgBySlug/getOrgs use anon). WARNING: USING(true) exposes ALL columns incl. stripe/subscription/contact PII to any anon client. Migrate public reads to public_organizations view, then restrict this policy. Do not add sensitive columns to organizations without updating the view.';

-- --- 2. Storage: revoke anon INSERT on design buckets -------------------------
-- org-videos (created in 0021)
drop policy if exists "auth_upload_org_videos" on storage.objects;
create policy "auth_upload_org_videos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'org-videos');

-- org-custom-fonts (created in 0027)
drop policy if exists "auth_upload_org_custom_fonts" on storage.objects;
create policy "auth_upload_org_custom_fonts"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'org-custom-fonts');

-- --- 3. demo_snapshots: document API-layer session scoping --------------------
-- Policies are intentionally broad (authenticated) because the table has no
-- user column — session_id scoping is enforced in /api/demo/snapshot and
-- /api/demo/restore via requireStaffForOrgId + is_demo checks. Do not grant
-- anon access here; snapshot_data contains full copies of org tables.
comment on table public.demo_snapshots is
  'Demo restore snapshots. RLS allows authenticated only; per-session scoping (session_id) is enforced in the API layer (requireStaffForOrgId + is_demo check), not in RLS. Never grant anon.';
