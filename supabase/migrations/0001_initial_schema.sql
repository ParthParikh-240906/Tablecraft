-- =============================================================================
-- Tablecraft — 0001_initial_schema.sql
-- Initial Supabase schema for the Tablecraft restaurant SaaS.
--
-- Notes:
--   * gen_random_uuid() is natively available on PostgreSQL 13+ (Supabase runs
--     PG 13+ with pgcrypto available by default) — no CREATE EXTENSION needed.
--   * RLS is enabled on ALL six tables.
--   * Public (anon) access: read-only, limited to menu_items + tables.
--   * Staff access: scoped to the caller's own org, resolved via
--     staff_users.auth_user_id = auth.uid() through the f_current_org_id() helper.
--   * Realtime: `tables` is added to supabase_realtime publication with
--     REPLICA IDENTITY FULL so status changes broadcast the full row.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: resolve the caller's organization id from their auth.uid()
-- Maps Supabase Auth user -> staff_users row -> that staff member's org_id.
-- Returns NULL (deny) when the caller is not a staff member.
-- -----------------------------------------------------------------------------
create or replace function public.f_current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id
  from public.staff_users
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Table: organizations
-- -----------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  theme_color text,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Table: staff_users
-- -----------------------------------------------------------------------------
create table public.staff_users (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  email        text not null,
  role         text not null check (role in ('owner', 'waiter')),
  auth_user_id uuid unique references auth.users (id) on delete set null
);

-- -----------------------------------------------------------------------------
-- Table: menu_items
-- -----------------------------------------------------------------------------
create table public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  description text,
  price       numeric(10,2) not null check (price >= 0),
  category    text,
  image_url   text,
  available   boolean not null default true
);

-- -----------------------------------------------------------------------------
-- Table: tables
-- -----------------------------------------------------------------------------
create table public.tables (
  id       uuid primary key default gen_random_uuid(),
  org_id   uuid not null references public.organizations (id) on delete cascade,
  label    text not null,
  capacity int  not null check (capacity > 0),
  status   text not null default 'open' check (status in ('open', 'occupied', 'reserved'))
);

-- -----------------------------------------------------------------------------
-- Table: bookings
-- -----------------------------------------------------------------------------
create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  table_id      uuid not null references public.tables (id) on delete cascade,
  customer_name text not null,
  party_size    int  not null check (party_size > 0),
  datetime      timestamptz not null,
  status        text not null default 'confirmed' check (status in ('pending', 'confirmed', 'cancelled'))
);

-- -----------------------------------------------------------------------------
-- Table: orders
-- -----------------------------------------------------------------------------
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  customer_name     text not null,
  items             jsonb not null default '[]'::jsonb,
  total             numeric(10,2) not null check (total >= 0),
  stripe_session_id text unique,
  status            text not null default 'pending' check (status in ('pending', 'paid', 'failed'))
);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.staff_users    enable row level security;
alter table public.menu_items     enable row level security;
alter table public.tables         enable row level security;
alter table public.bookings       enable row level security;
alter table public.orders         enable row level security;

-- --- organizations ---------------------------------------------------------
-- Staff can read their own org row. (No anon access.)
create policy "staff_select_own_org"
  on public.organizations for select
  to authenticated
  using (id = public.f_current_org_id());

-- --- staff_users -----------------------------------------------------------
-- Staff can select and manage staff rows within their own org.
create policy "staff_select_own_staff"
  on public.staff_users for select
  to authenticated
  using (org_id = public.f_current_org_id());

create policy "staff_insert_own_staff"
  on public.staff_users for insert
  to authenticated
  with check (org_id = public.f_current_org_id());

create policy "staff_update_own_staff"
  on public.staff_users for update
  to authenticated
  using (org_id = public.f_current_org_id());

create policy "staff_delete_own_staff"
  on public.staff_users for delete
  to authenticated
  using (org_id = public.f_current_org_id());

-- --- menu_items ------------------------------------------------------------
-- Public read: only available items.
create policy "public_read_menu"
  on public.menu_items for select
  to anon, authenticated
  using (available = true);

-- Staff: full CRUD within own org.
create policy "staff_select_own_menu"
  on public.menu_items for select
  to authenticated
  using (org_id = public.f_current_org_id());

create policy "staff_insert_own_menu"
  on public.menu_items for insert
  to authenticated
  with check (org_id = public.f_current_org_id());

create policy "staff_update_own_menu"
  on public.menu_items for update
  to authenticated
  using (org_id = public.f_current_org_id());

create policy "staff_delete_own_menu"
  on public.menu_items for delete
  to authenticated
  using (org_id = public.f_current_org_id());

-- --- tables ----------------------------------------------------------------
-- Public read: all rows (clients filter by 'open' in the UI).
create policy "public_read_tables"
  on public.tables for select
  to anon, authenticated
  using (true);

-- Staff: full CRUD within own org.
create policy "staff_select_own_tables"
  on public.tables for select
  to authenticated
  using (org_id = public.f_current_org_id());

create policy "staff_insert_own_tables"
  on public.tables for insert
  to authenticated
  with check (org_id = public.f_current_org_id());

create policy "staff_update_own_tables"
  on public.tables for update
  to authenticated
  using (org_id = public.f_current_org_id());

create policy "staff_delete_own_tables"
  on public.tables for delete
  to authenticated
  using (org_id = public.f_current_org_id());

-- --- bookings --------------------------------------------------------------
-- No public access. Staff CRUD within own org.
create policy "staff_select_own_bookings"
  on public.bookings for select
  to authenticated
  using (org_id = public.f_current_org_id());

create policy "staff_insert_own_bookings"
  on public.bookings for insert
  to authenticated
  with check (org_id = public.f_current_org_id());

create policy "staff_update_own_bookings"
  on public.bookings for update
  to authenticated
  using (org_id = public.f_current_org_id());

create policy "staff_delete_own_bookings"
  on public.bookings for delete
  to authenticated
  using (org_id = public.f_current_org_id());

-- --- orders ----------------------------------------------------------------
-- No public access (written via API routes with service-role or authenticated).
-- Staff read/update within own org (so Console can see order/payment status).
create policy "staff_select_own_orders"
  on public.orders for select
  to authenticated
  using (org_id = public.f_current_org_id());

create policy "staff_update_own_orders"
  on public.orders for update
  to authenticated
  using (org_id = public.f_current_org_id());

-- -----------------------------------------------------------------------------
-- Realtime: broadcast table status changes so the public site updates live.
-- -----------------------------------------------------------------------------
alter table public.tables replica identity full;
alter publication supabase_realtime add table public.tables;