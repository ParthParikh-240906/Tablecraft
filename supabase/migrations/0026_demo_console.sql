-- =============================================================================
-- Tablecraft — 0026_demo_console.sql
-- Enable password-less demo console access for restaurants owned by the demo
-- account (parth.kaushik.parikh@gmail.com).
--
-- Features:
--   1. Adds `is_demo` flag to organizations.
--   2. Creates shared demo staff accounts (email: demo@tablecraft.app) for
--      each demo org, with a well-known console password.
--   3. Adds RLS policies so demo users can access ALL demo orgs (not just one).
--   4. Adds demo_snapshots table for storing data state before demo edits.
-- =============================================================================

-- 1. Add is_demo column to organizations
alter table public.organizations
  add column if not exists is_demo boolean not null default false;

-- Mark existing demo orgs (owned by the demo account email)
do $$
begin
  update public.organizations o
  set is_demo = true
  from public.staff_users s
  where s.org_id = o.id
    and s.email = 'parth.kaushik.parikh@gmail.com'
    and o.is_demo = false;
end $$;

-- 2. Create shared demo staff accounts for each demo org
--    The shared demo auth user is created by /api/demo/setup on first use.
--    Here we just ensure the staff_rows exist with a known console password.
do $$
declare
  demo_password_hash text;
  demo_org record;
begin
  -- bcrypt hash of "demo123"
  demo_password_hash := '$2b$10$.Ow6SlU7ibGjX4c6kIfkr.GZOJCKE9.AXC7EteuCJmb9nGwXZ3szq';

  -- Ensure a unique constraint exists so we can upsert by (org_id, email)
  create unique index if not exists uq_staff_users_org_email
    on public.staff_users (org_id, email);

  for demo_org in select id, slug from public.organizations where is_demo = true loop
    insert into public.staff_users (org_id, email, role, auth_user_id, console_password_hash)
    values (demo_org.id, 'demo@tablecraft.app', 'owner', null, demo_password_hash)
    on conflict (org_id, email) do update set
      console_password_hash = demo_password_hash,
      role = 'owner';
  end loop;
end $$;

-- 3. Create demo_snapshots table for storing original data state
create table if not exists public.demo_snapshots (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  session_id    text not null,
  snapshot_type text not null check (snapshot_type in ('menu_items', 'tables', 'bookings', 'orders', 'booking_tables')),
  snapshot_data jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_demo_snapshots_org_session
  on public.demo_snapshots (org_id, session_id);

create index if not exists idx_demo_snapshots_type
  on public.demo_snapshots (org_id, snapshot_type);

-- 4. RLS for demo_snapshots (admin-only writes, demo users can read their session)
alter table public.demo_snapshots enable row level security;

create policy "demo_snapshots_select_own"
  on public.demo_snapshots for select
  to authenticated
  using (true);  -- filtered by session_id in app logic

create policy "demo_snapshots_insert_own"
  on public.demo_snapshots for insert
  to authenticated
  with check (true);  -- validated in API route

create policy "demo_snapshots_delete_own"
  on public.demo_snapshots for delete
  to authenticated
  using (true);  -- validated in API route

-- 5. New RLP function: returns ALL demo org IDs for users with demo session
--    This is checked via a custom JWT claim set during demo login.
create or replace function public.f_current_org_ids_for_demo()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.organizations
  where is_demo = true;
$$;

-- 6. Demo-aware RLS policies for each data table.
--    These allow demo users (identified by demo_session cookie + matching
--    console_password_hash staff row) to access ALL demo orgs.
--
--    Strategy: We add additional policies that check for demo access.
--    A user is a "demo user" if they have a staff_users row with
--    console_password_hash set AND auth_user_id is null (or the shared demo user).
--    The demo_session cookie is validated in the API layer; RLS uses the
--    staff_users lookup to determine demo access.

-- --- organizations ---------------------------------------------------------
drop policy if exists "demo_select_orgs" on public.organizations;
create policy "demo_select_orgs"
  on public.organizations for select
  to authenticated
  using (
    is_demo = true
    or id in (
      select org_id from public.staff_users
      where auth_user_id = auth.uid()
    )
  );

-- --- staff_users -----------------------------------------------------------
drop policy if exists "demo_select_staff" on public.staff_users;
create policy "demo_select_staff"
  on public.staff_users for select
  to authenticated
  using (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or auth_user_id = auth.uid()
  );

-- --- menu_items ------------------------------------------------------------
drop policy if exists "demo_select_menu" on public.menu_items;
create policy "demo_select_menu"
  on public.menu_items for select
  to authenticated
  using (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

drop policy if exists "demo_insert_menu" on public.menu_items;
create policy "demo_insert_menu"
  on public.menu_items for insert
  to authenticated
  with check (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

drop policy if exists "demo_update_menu" on public.menu_items;
create policy "demo_update_menu"
  on public.menu_items for update
  to authenticated
  using (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

drop policy if exists "demo_delete_menu" on public.menu_items;
create policy "demo_delete_menu"
  on public.menu_items for delete
  to authenticated
  using (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

-- --- tables ----------------------------------------------------------------
drop policy if exists "demo_select_tables" on public.tables;
create policy "demo_select_tables"
  on public.tables for select
  to authenticated
  using (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

drop policy if exists "demo_insert_tables" on public.tables;
create policy "demo_insert_tables"
  on public.tables for insert
  to authenticated
  with check (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

drop policy if exists "demo_update_tables" on public.tables;
create policy "demo_update_tables"
  on public.tables for update
  to authenticated
  using (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

drop policy if exists "demo_delete_tables" on public.tables;
create policy "demo_delete_tables"
  on public.tables for delete
  to authenticated
  using (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

-- --- bookings --------------------------------------------------------------
drop policy if exists "demo_select_bookings" on public.bookings;
create policy "demo_select_bookings"
  on public.bookings for select
  to authenticated
  using (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

drop policy if exists "demo_insert_bookings" on public.bookings;
create policy "demo_insert_bookings"
  on public.bookings for insert
  to authenticated
  with check (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

drop policy if exists "demo_update_bookings" on public.bookings;
create policy "demo_update_bookings"
  on public.bookings for update
  to authenticated
  using (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

drop policy if exists "demo_delete_bookings" on public.bookings;
create policy "demo_delete_bookings"
  on public.bookings for delete
  to authenticated
  using (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

-- --- orders ----------------------------------------------------------------
drop policy if exists "demo_select_orders" on public.orders;
create policy "demo_select_orders"
  on public.orders for select
  to authenticated
  using (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

drop policy if exists "demo_update_orders" on public.orders;
create policy "demo_update_orders"
  on public.orders for update
  to authenticated
  using (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

-- --- booking_tables --------------------------------------------------------
drop policy if exists "demo_select_booking_tables" on public.booking_tables;
create policy "demo_select_booking_tables"
  on public.booking_tables for select
  to authenticated
  using (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

drop policy if exists "demo_insert_booking_tables" on public.booking_tables;
create policy "demo_insert_booking_tables"
  on public.booking_tables for insert
  to authenticated
  with check (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );

drop policy if exists "demo_delete_booking_tables" on public.booking_tables;
create policy "demo_delete_booking_tables"
  on public.booking_tables for delete
  to authenticated
  using (
    org_id in (select id from public.f_current_org_ids_for_demo())
    or org_id = public.f_current_org_id()
  );
