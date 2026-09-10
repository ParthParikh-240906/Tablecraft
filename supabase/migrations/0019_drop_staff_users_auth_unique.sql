-- Drop the unique constraint on auth_user_id so one user can own
-- multiple restaurants (each org = one staff_users row).
--
-- Run this in your Supabase SQL Editor before creating a second restaurant.

alter table public.staff_users
  drop constraint if exists staff_users_auth_user_id_key;

-- Re-create as a regular (non-unique) index so auth_user_id queries stay fast.
create index if not exists staff_users_auth_user_id_idx
  on public.staff_users (auth_user_id);
