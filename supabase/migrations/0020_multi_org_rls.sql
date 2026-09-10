-- Fix RLS for multi-restaurant ownership.
--
-- The original f_current_org_id() returns LIMIT 1 — a single org — so the
-- existing policies only allow staff to see their FIRST restaurant. These
-- new policies use auth.uid() directly so a user sees ALL staff rows and
-- orgs they belong to. PostgreSQL ORs multiple policies of the same command,
-- so the old policies still work for single-org staff.

-- 1. Staff users: let users read any row matching their auth user ID.
create policy "staff_select_own_auth"
  on public.staff_users for select
  to authenticated
  using (auth_user_id = auth.uid());

-- 2. Organizations: let users read any org they own.
--    Uses an EXISTS subquery (set-returning functions are banned in policy expressions).
create policy "staff_select_own_orgs_multi"
  on public.organizations for select
  to authenticated
  using (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = organizations.id
        and staff_users.auth_user_id = auth.uid()
    )
  );
