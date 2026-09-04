-- Migration: add DELETE RLS policy for orders
create policy "staff_delete_own_orders"
  on public.orders for delete
  to authenticated
  using (org_id = public.f_current_org_id());
