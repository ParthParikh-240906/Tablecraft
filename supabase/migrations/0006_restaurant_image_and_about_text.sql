-- =============================================================================
-- Tablecraft — 0006_restaurant_image_and_about_text.sql
-- Adds restaurant image upload and about text fields for org landing pages.
--
-- Schema Changes:
--   - organizations: Add restaurant_image_url (nullable text), about_text (nullable text)
--
-- Storage Changes:
--   - Create 'org-restaurant-images' bucket (public read, owner-scoped write)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: organizations - Add restaurant image and about text
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists restaurant_image_url text,
  add column if not exists about_text text;

-- -----------------------------------------------------------------------------
-- Storage: Create bucket for restaurant images
-- -----------------------------------------------------------------------------

-- Create org-restaurant-images bucket
insert into storage.buckets (id, name, public)
values ('org-restaurant-images', 'org-restaurant-images', true)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Storage Policies: org-restaurant-images bucket
-- -----------------------------------------------------------------------------

-- Public can read restaurant images (for public site display)
create policy "public_read_org_restaurant_images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'org-restaurant-images');

-- Staff can upload restaurant images to their own org (pattern: org-id/*)
create policy "staff_upload_own_org_restaurant_images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'org-restaurant-images' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );

-- Staff can update/delete their own org's restaurant images
create policy "staff_manage_own_org_restaurant_images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'org-restaurant-images' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );

create policy "staff_delete_own_org_restaurant_images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'org-restaurant-images' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );