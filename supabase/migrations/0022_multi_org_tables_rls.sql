-- Fix RLS for multi-restaurant ownership on tables, bookings, menu_items, and orders.
--
-- The original f_current_org_id() returns LIMIT 1 — a single org — so the
-- original policies in 0001_initial_schema.sql only allowed staff to insert/update/delete
-- rows for their FIRST restaurant.
-- These new policies use EXISTS subqueries with auth.uid() so a user can manage
-- tables, bookings, menu items, and orders across ALL organizations they belong to.

-- 1. Tables
create policy "staff_insert_own_tables_multi"
  on public.tables for insert
  to authenticated
  with check (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = tables.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

create policy "staff_update_own_tables_multi"
  on public.tables for update
  to authenticated
  using (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = tables.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

create policy "staff_delete_own_tables_multi"
  on public.tables for delete
  to authenticated
  using (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = tables.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

-- 2. Menu Items
create policy "staff_insert_own_menu_items_multi"
  on public.menu_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = menu_items.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

create policy "staff_update_own_menu_items_multi"
  on public.menu_items for update
  to authenticated
  using (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = menu_items.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

create policy "staff_delete_own_menu_items_multi"
  on public.menu_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = menu_items.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

-- 3. Bookings
create policy "staff_select_own_bookings_multi"
  on public.bookings for select
  to authenticated
  using (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = bookings.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

create policy "staff_insert_own_bookings_multi"
  on public.bookings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = bookings.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

create policy "staff_update_own_bookings_multi"
  on public.bookings for update
  to authenticated
  using (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = bookings.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

create policy "staff_delete_own_bookings_multi"
  on public.bookings for delete
  to authenticated
  using (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = bookings.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

-- 4. Orders
create policy "staff_select_own_orders_multi"
  on public.orders for select
  to authenticated
  using (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = orders.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

create policy "staff_update_own_orders_multi"
  on public.orders for update
  to authenticated
  using (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = orders.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

-- 5. Booking Tables Junction
create policy "staff_select_own_booking_tables_multi"
  on public.booking_tables for select
  to authenticated
  using (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = booking_tables.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

create policy "staff_insert_own_booking_tables_multi"
  on public.booking_tables for insert
  to authenticated
  with check (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = booking_tables.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

create policy "staff_delete_own_booking_tables_multi"
  on public.booking_tables for delete
  to authenticated
  using (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = booking_tables.org_id
        and staff_users.auth_user_id = auth.uid()
    )
  );

