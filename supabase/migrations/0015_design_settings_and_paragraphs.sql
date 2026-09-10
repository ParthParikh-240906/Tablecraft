-- Tablecraft — 0015_design_settings_and_paragraphs.sql
-- Adds per-element design settings and a paragraphs table for the storefront designer.

-- -----------------------------------------------------------------------------
-- organizations: add design_settings JSONB column + text fields
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists design_settings jsonb;

alter table public.organizations
  add column if not exists about_title text;

alter table public.organizations
  add column if not exists contact_heading text;

alter table public.organizations
  add column if not exists location text;

-- -----------------------------------------------------------------------------
-- paragraphs table
-- -----------------------------------------------------------------------------
create table if not exists public.paragraphs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  position        int not null default 0,
  title           text,
  content         text,
  image_url       text,
  image_position  text check (image_position in ('text-left', 'text-right')),
  title_design    jsonb,
  content_design  jsonb,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Storage bucket
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('org-paragraph-images', 'org-paragraph-images', true),
       ('org-backgrounds',      'org-backgrounds',      true)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.paragraphs enable row level security;

drop policy if exists "staff_read_paragraphs" on public.paragraphs;
create policy "staff_read_paragraphs"
  on public.paragraphs for select
  to authenticated
  using (org_id::text = public.f_current_org_id()::text);

drop policy if exists "staff_insert_paragraphs" on public.paragraphs;
create policy "staff_insert_paragraphs"
  on public.paragraphs for insert
  to authenticated
  with check (org_id::text = public.f_current_org_id()::text);

drop policy if exists "staff_update_paragraphs" on public.paragraphs;
create policy "staff_update_paragraphs"
  on public.paragraphs for update
  to authenticated
  using (org_id::text = public.f_current_org_id()::text)
  with check (org_id::text = public.f_current_org_id()::text);

drop policy if exists "staff_delete_paragraphs" on public.paragraphs;
create policy "staff_delete_paragraphs"
  on public.paragraphs for delete
  to authenticated
  using (org_id::text = public.f_current_org_id()::text);

-- -----------------------------------------------------------------------------
-- Storage policies: org-paragraph-images
-- -----------------------------------------------------------------------------
drop policy if exists "public_read_paragraph_images" on storage.objects;
create policy "public_read_paragraph_images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'org-paragraph-images');

drop policy if exists "staff_upload_paragraph_images" on storage.objects;
create policy "staff_upload_paragraph_images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'org-paragraph-images' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );

drop policy if exists "staff_update_paragraph_images" on storage.objects;
create policy "staff_update_paragraph_images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'org-paragraph-images' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );

drop policy if exists "staff_delete_paragraph_images" on storage.objects;
create policy "staff_delete_paragraph_images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'org-paragraph-images' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );

-- -----------------------------------------------------------------------------
-- Storage policies: org-backgrounds
-- -----------------------------------------------------------------------------
drop policy if exists "public_read_background_images" on storage.objects;
create policy "public_read_background_images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'org-backgrounds');

drop policy if exists "staff_upload_background_images" on storage.objects;
create policy "staff_upload_background_images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'org-backgrounds' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );

drop policy if exists "staff_update_background_images" on storage.objects;
create policy "staff_update_background_images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'org-backgrounds' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );

drop policy if exists "staff_delete_background_images" on storage.objects;
create policy "staff_delete_background_images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'org-backgrounds' and
    (storage.foldername(name))[1]::text = public.f_current_org_id()::text
  );
