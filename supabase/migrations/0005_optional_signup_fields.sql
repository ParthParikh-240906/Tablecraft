-- =============================================================================
-- Tablecraft — 0005_optional_signup_fields.sql
-- Adds optional fields for restaurant signup: branches, contact info, 
-- background images, and manual theme color overrides.
--
-- Schema Changes:
--   - organizations: Add branches (text[]), contact_phone, contact_email,
--     contact_address, background_image_url, logo_url (all nullable)
--   - Note: logo_url already exists in initial schema, included here for clarity
--
-- Storage Changes:
--   - Create 'org-logos' bucket (public read, owner-scoped write)
--   - Create 'org-backgrounds' bucket (public read, owner-scoped write)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: organizations - Add optional signup fields
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists branches text[],
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists contact_address text,
  add column if not exists background_image_url text,
  add column if not exists logo_url text; -- Already exists in initial schema, included for clarity

-- -----------------------------------------------------------------------------
-- Storage: Create buckets for logos and background images
-- -----------------------------------------------------------------------------

-- Create org-logos bucket
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

-- Create org-backgrounds bucket  
insert into storage.buckets (id, name, public)
values ('org-backgrounds', 'org-backgrounds', true)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Storage Policies: org-logos bucket
-- -----------------------------------------------------------------------------

-- Public can read logos (for public site display)
create policy "public_read_org_logos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'org-logos');

-- Staff can upload logos to their own org (pattern: org-id/*)
create policy "staff_upload_own_org_logos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'org-logos' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );

-- Staff can update/delete their own org's logos
create policy "staff_manage_own_org_logos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'org-logos' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );

create policy "staff_delete_own_org_logos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'org-logos' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );

-- -----------------------------------------------------------------------------
-- Storage Policies: org-backgrounds bucket
-- -----------------------------------------------------------------------------

-- Public can read background images (for public site display)
create policy "public_read_org_backgrounds"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'org-backgrounds');

-- Staff can upload background images to their own org (pattern: org-id/*)
create policy "staff_upload_own_org_backgrounds"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'org-backgrounds' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );

-- Staff can update/delete their own org's background images
create policy "staff_manage_own_org_backgrounds"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'org-backgrounds' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );

create policy "staff_delete_own_org_backgrounds"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'org-backgrounds' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );