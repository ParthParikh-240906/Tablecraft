-- =============================================================================
-- Migration 0009: booking_tables junction table + combo booking support
--
-- Adds a many-to-many link between bookings and tables so a single reservation
-- can span multiple physical tables. The existing `table_id` column on
-- `bookings` remains as the primary table for display and backward compatibility.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: booking_tables
-- -----------------------------------------------------------------------------
create table if not exists public.booking_tables (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  booking_id    uuid not null references public.bookings (id) on delete cascade,
  table_id      uuid not null references public.tables (id) on delete cascade,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create unique index if not exists uq_booking_tables_booking_table
  on public.booking_tables (booking_id, table_id);

create index if not exists idx_booking_tables_booking_id
  on public.booking_tables (booking_id);

create index if not exists idx_booking_tables_table_id
  on public.booking_tables (table_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.booking_tables enable row level security;

create policy "staff_select_own_booking_tables"
  on public.booking_tables for select
  to authenticated
  using (org_id = public.f_current_org_id());

create policy "staff_insert_own_booking_tables"
  on public.booking_tables for insert
  to authenticated
  with check (org_id = public.f_current_org_id());

create policy "staff_delete_own_booking_tables"
  on public.booking_tables for delete
  to authenticated
  using (org_id = public.f_current_org_id());

-- -----------------------------------------------------------------------------
-- Trigger: keep booking_tables.is_primary in sync with bookings.table_id
-- Inserts a row whenever a booking's table_id is set.
-- -----------------------------------------------------------------------------
create or replace function public.sync_booking_tables_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.booking_tables (org_id, booking_id, table_id, is_primary)
  values (new.org_id, new.id, new.table_id, true)
  on conflict (booking_id, table_id) do nothing;
  return new;
end;
$$;

create trigger if not exists trg_sync_booking_tables_on_insert
  after insert on public.bookings
  for each row execute function public.sync_booking_tables_on_insert();
