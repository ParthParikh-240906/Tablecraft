-- =============================================================================
-- Tablecraft — 0007_theme_text_color.sql
-- Adds theme_text_color column for manual preset system.
--
-- Schema Changes:
--   - organizations: Add theme_text_color (nullable text)
--
-- This column is used for the manual preset picker system to store the text
-- color component of each preset. Combined with theme_color (main/background)
-- and theme_secondary_color (highlight) to form complete 3-color presets.
-- =============================================================================

alter table public.organizations
  add column if not exists theme_text_color text;