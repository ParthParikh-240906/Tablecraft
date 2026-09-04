-- Migration: fix orders.status CHECK constraint + add missing insert policy + created_at
-- 1. The status API and UI already write 'preparing', 'ready', 'completed' but the
--    original constraint only allowed ('pending', 'paid', 'failed'). Widen it.
-- 2. No staff_insert policy existed — adding one for defense-in-depth.
-- 3. orders table was missing a created_at timestamp — adding it for sorting.
alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
    check (status in ('pending', 'paid', 'failed', 'preparing', 'ready', 'completed', 'cancelled'));

create policy "staff_insert_own_orders"
  on public.orders for insert
  to authenticated
  with check (org_id = public.f_current_org_id());

alter table public.orders
  add column if not exists created_at timestamptz not null default now();
