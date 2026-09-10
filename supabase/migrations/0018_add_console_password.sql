-- =============================================================================
-- Tablecraft — 0018_add_console_password.sql
-- Add optional independent console password hash to staff_users.
-- This is separate from Supabase auth (Google OAuth users get a console
-- password they choose at restaurant creation time).
-- =============================================================================

alter table public.staff_users
  add column if not exists console_password_hash text;
