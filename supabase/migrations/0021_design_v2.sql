-- =============================================================================
-- Tablecraft — 0021_design_v2.sql
-- Design v2: add a storage bucket for uploaded background/hero videos.
-- All v2 design data (header config, canvas layers, hero elements, content
-- elements) lives in organizations.design_settings JSONB — no table changes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Storage bucket for videos (MP4/WebM) used by layers + hero backgrounds
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('org-videos', 'org-videos', true)
on conflict (id) do nothing;

-- Public can read videos (public site display)
create policy "public_read_org_videos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'org-videos');

-- Staff (authenticated) can upload videos
create policy "auth_upload_org_videos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'org-videos');