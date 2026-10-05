-- =============================================================================
-- Tablecraft — 0027_custom_font_storage.sql
-- Self-hosted Google Fonts (GDPR): woff2 files downloaded at add-time by
-- /api/design/fonts/add live here. Font metadata stays in
-- organizations.design_settings.custom_fonts JSONB (entry.css holds the
-- rewritten @font-face CSS) — no table changes. Paths are global
-- (google/<slug>/<weight>/<subset>.woff2) so every org reuses the same files.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('org-custom-fonts', 'org-custom-fonts', true)
on conflict (id) do nothing;

-- Public can read font files (public site display)
drop policy if exists "public_read_org_custom_fonts" on storage.objects;
create policy "public_read_org_custom_fonts"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'org-custom-fonts');

-- Uploads go through the service-role API route, but keep a staff policy
-- consistent with the other design buckets.
drop policy if exists "auth_upload_org_custom_fonts" on storage.objects;
create policy "auth_upload_org_custom_fonts"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'org-custom-fonts');
