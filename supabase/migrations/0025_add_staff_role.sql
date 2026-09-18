-- =============================================================================
-- Tablecraft — 0025_add_staff_role.sql
-- Add 'staff' role to staff_users so restaurants can have owner + staff accounts.
-- Existing 'owner' and 'waiter' roles are unaffected.
-- =============================================================================

alter table public.staff_users
  drop constraint if exists staff_users_role_check;

alter table public.staff_users
  add constraint staff_users_role_check
    check (role in ('owner', 'staff', 'waiter'));
