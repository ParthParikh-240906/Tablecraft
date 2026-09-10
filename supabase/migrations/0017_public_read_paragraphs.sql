-- =============================================================================
-- Tablecraft — 0017_public_read_paragraphs.sql
-- Paragraphs are public storefront content (about section, images).
-- The existing RLS policy only allowed authenticated users, so paragraphs
-- disappeared from the public site when visitors were not logged in.
-- =============================================================================

drop policy if exists "staff_read_paragraphs" on public.paragraphs;

create policy "public_read_paragraphs"
  on public.paragraphs for select
  to anon, authenticated
  using (true);
