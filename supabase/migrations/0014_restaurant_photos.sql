-- Tablecraft — 0014_restaurant_photos.sql
-- Adds restaurant_photos (text[]) for multiple image support.
-- restaurant_image_url is kept for backward compatibility with existing data.

alter table public.organizations
  add column if not exists restaurant_photos text[];
