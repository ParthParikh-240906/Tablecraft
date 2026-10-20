-- 0040: inventory tracker
--
-- Adds ingredients, recipes, stock ledger, scan audit, notifications, atomic
-- stock RPCs, and the per-menu-item "deducts stock" flag.
--
-- Status model:
--   out       quantity_on_hand <= 0
--   low       quantity_on_hand <= par_level * low_stock_percent / 100
--   ok        otherwise
--   untracked track_stock = false, archived, or no par level
--
-- Par level is a target quantity on hand, not a maximum. The app's AI prompt
-- assumes a one-week ordering cycle.

-- ── 1. Menu item deduction flag ───────────────────────────────────────────────
alter table public.menu_items
  add column if not exists deducts_stock boolean not null default true;

-- ── 2. Core tables ────────────────────────────────────────────────────────────
create table if not exists public.inventory_items (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  name              text not null,
  normalized_name   text not null,
  category          text,
  base_unit         text not null check (base_unit in ('g', 'ml', 'each')),
  quantity_on_hand  numeric(12,3) not null default 0,
  par_level         numeric(12,3) check (par_level is null or par_level >= 0),
  low_stock_percent numeric(5,2) not null default 75
                      check (low_stock_percent > 0 and low_stock_percent <= 100),
  unit_cost         numeric(12,4) check (unit_cost is null or unit_cost >= 0),
  storage_location  text,
  track_stock       boolean not null default true,
  ai_estimated      boolean not null default false,
  source            text not null default 'manual'
                      check (source in ('manual', 'menu_scan', 'inventory_scan')),
  archived          boolean not null default false,
  archived_at       timestamptz,
  archived_by       uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists uq_inventory_items_org_name
  on public.inventory_items (org_id, normalized_name)
  where archived = false;
create index if not exists idx_inventory_items_org_active
  on public.inventory_items (org_id, archived);

create table if not exists public.inventory_aliases (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  alias             text not null,
  normalized_alias  text not null,
  created_at        timestamptz not null default now(),
  unique (org_id, normalized_alias)
);
create index if not exists idx_inventory_aliases_item
  on public.inventory_aliases (inventory_item_id);

create table if not exists public.menu_item_ingredients (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  menu_item_id      uuid not null references public.menu_items(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity          numeric(12,3) not null check (quantity > 0),
  ai_estimated      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (menu_item_id, inventory_item_id)
);
create index if not exists idx_menu_item_ingredients_menu
  on public.menu_item_ingredients (menu_item_id);
create index if not exists idx_menu_item_ingredients_item
  on public.menu_item_ingredients (inventory_item_id);

create table if not exists public.inventory_transactions (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  delta             numeric(12,3) not null,
  balance_after     numeric(12,3) not null,
  reason            text not null check (reason in (
                      'initial', 'purchase', 'usage', 'waste',
                      'adjustment', 'scan', 'order_deduction', 'order_reversal'
                    )),
  reference_type    text,
  reference_id      uuid,
  note              text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_inventory_transactions_item
  on public.inventory_transactions (inventory_item_id, created_at desc);
create index if not exists idx_inventory_transactions_org
  on public.inventory_transactions (org_id, created_at desc);
create unique index if not exists uq_inventory_transactions_order_ref
  on public.inventory_transactions
    (org_id, reference_type, reference_id, inventory_item_id, reason)
  where reference_id is not null and reference_type = 'order';

create table if not exists public.inventory_scans (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  kind         text not null check (kind in ('inventory', 'menu_ingredients')),
  status       text not null default 'preview'
                 check (status in ('preview', 'applied', 'discarded', 'failed')),
  image_count  integer not null default 1,
  model        text not null default 'claude-haiku-5-5',
  raw_result   jsonb,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_inventory_scans_org
  on public.inventory_scans (org_id, created_at desc);

create table if not exists public.inventory_notifications (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete cascade,
  type              text not null check (type in ('low', 'out')),
  title             text not null,
  body              text,
  status            text not null default 'unread'
                      check (status in ('unread', 'read', 'resolved', 'cleared')),
  created_at        timestamptz not null default now(),
  read_at           timestamptz,
  resolved_at       timestamptz,
  cleared_at        timestamptz,
  cleared_by        uuid references auth.users(id) on delete set null
);
create index if not exists idx_inventory_notifications_org
  on public.inventory_notifications (org_id, cleared_at, created_at desc);
create index if not exists idx_inventory_notifications_item
  on public.inventory_notifications (inventory_item_id, created_at desc);

-- ── 3. RLS (multi-org staff pattern from 0022) ────────────────────────────────
alter table public.inventory_items enable row level security;
alter table public.inventory_aliases enable row level security;
alter table public.menu_item_ingredients enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.inventory_scans enable row level security;
alter table public.inventory_notifications enable row level security;

-- inventory_items
drop policy if exists "inventory_items_select_staff" on public.inventory_items;
create policy "inventory_items_select_staff"
  on public.inventory_items for select to authenticated
  using (exists (select 1 from public.staff_users s where s.org_id = inventory_items.org_id and s.auth_user_id = auth.uid()));
drop policy if exists "inventory_items_insert_staff" on public.inventory_items;
create policy "inventory_items_insert_staff"
  on public.inventory_items for insert to authenticated
  with check (exists (select 1 from public.staff_users s where s.org_id = inventory_items.org_id and s.auth_user_id = auth.uid()));
drop policy if exists "inventory_items_update_staff" on public.inventory_items;
create policy "inventory_items_update_staff"
  on public.inventory_items for update to authenticated
  using (exists (select 1 from public.staff_users s where s.org_id = inventory_items.org_id and s.auth_user_id = auth.uid()));
drop policy if exists "inventory_items_delete_staff" on public.inventory_items;
create policy "inventory_items_delete_staff"
  on public.inventory_items for delete to authenticated
  using (exists (select 1 from public.staff_users s where s.org_id = inventory_items.org_id and s.auth_user_id = auth.uid()));

-- inventory_aliases
drop policy if exists "inventory_aliases_select_staff" on public.inventory_aliases;
create policy "inventory_aliases_select_staff"
  on public.inventory_aliases for select to authenticated
  using (exists (select 1 from public.staff_users s where s.org_id = inventory_aliases.org_id and s.auth_user_id = auth.uid()));
drop policy if exists "inventory_aliases_insert_staff" on public.inventory_aliases;
create policy "inventory_aliases_insert_staff"
  on public.inventory_aliases for insert to authenticated
  with check (exists (select 1 from public.staff_users s where s.org_id = inventory_aliases.org_id and s.auth_user_id = auth.uid()));
drop policy if exists "inventory_aliases_update_staff" on public.inventory_aliases;
create policy "inventory_aliases_update_staff"
  on public.inventory_aliases for update to authenticated
  using (exists (select 1 from public.staff_users s where s.org_id = inventory_aliases.org_id and s.auth_user_id = auth.uid()));
drop policy if exists "inventory_aliases_delete_staff" on public.inventory_aliases;
create policy "inventory_aliases_delete_staff"
  on public.inventory_aliases for delete to authenticated
  using (exists (select 1 from public.staff_users s where s.org_id = inventory_aliases.org_id and s.auth_user_id = auth.uid()));

-- menu_item_ingredients
drop policy if exists "menu_item_ingredients_select_staff" on public.menu_item_ingredients;
create policy "menu_item_ingredients_select_staff"
  on public.menu_item_ingredients for select to authenticated
  using (exists (select 1 from public.staff_users s where s.org_id = menu_item_ingredients.org_id and s.auth_user_id = auth.uid()));
drop policy if exists "menu_item_ingredients_insert_staff" on public.menu_item_ingredients;
create policy "menu_item_ingredients_insert_staff"
  on public.menu_item_ingredients for insert to authenticated
  with check (exists (select 1 from public.staff_users s where s.org_id = menu_item_ingredients.org_id and s.auth_user_id = auth.uid()));
drop policy if exists "menu_item_ingredients_update_staff" on public.menu_item_ingredients;
create policy "menu_item_ingredients_update_staff"
  on public.menu_item_ingredients for update to authenticated
  using (exists (select 1 from public.staff_users s where s.org_id = menu_item_ingredients.org_id and s.auth_user_id = auth.uid()));
drop policy if exists "menu_item_ingredients_delete_staff" on public.menu_item_ingredients;
create policy "menu_item_ingredients_delete_staff"
  on public.menu_item_ingredients for delete to authenticated
  using (exists (select 1 from public.staff_users s where s.org_id = menu_item_ingredients.org_id and s.auth_user_id = auth.uid()));

-- transactions: read-only for staff
drop policy if exists "inventory_transactions_select_staff" on public.inventory_transactions;
create policy "inventory_transactions_select_staff"
  on public.inventory_transactions for select to authenticated
  using (exists (select 1 from public.staff_users s where s.org_id = inventory_transactions.org_id and s.auth_user_id = auth.uid()));

-- scans: read-only for staff
drop policy if exists "inventory_scans_select_staff" on public.inventory_scans;
create policy "inventory_scans_select_staff"
  on public.inventory_scans for select to authenticated
  using (exists (select 1 from public.staff_users s where s.org_id = inventory_scans.org_id and s.auth_user_id = auth.uid()));

-- notifications: read + update (clear/read) for staff
drop policy if exists "inventory_notifications_select_staff" on public.inventory_notifications;
create policy "inventory_notifications_select_staff"
  on public.inventory_notifications for select to authenticated
  using (exists (select 1 from public.staff_users s where s.org_id = inventory_notifications.org_id and s.auth_user_id = auth.uid()));
drop policy if exists "inventory_notifications_update_staff" on public.inventory_notifications;
create policy "inventory_notifications_update_staff"
  on public.inventory_notifications for update to authenticated
  using (exists (select 1 from public.staff_users s where s.org_id = inventory_notifications.org_id and s.auth_user_id = auth.uid()));

-- ── 4. Helpers ────────────────────────────────────────────────────────────────
create or replace function public.inventory_stock_status(
  p_qty numeric,
  p_par numeric,
  p_pct numeric,
  p_track boolean,
  p_archived boolean
) returns text
language sql
immutable
as $$
  select case
    when p_archived or not p_track then 'untracked'
    when p_qty <= 0 then 'out'
    when p_par is null or p_par <= 0 then 'untracked'
    when p_qty <= p_par * coalesce(p_pct, 75) / 100 then 'low'
    else 'ok'
  end;
$$;

create or replace function public.record_inventory_notification(
  p_org_id uuid,
  p_item_id uuid,
  p_old_status text,
  p_new_status text,
  p_item_name text,
  p_qty numeric,
  p_par numeric,
  p_unit text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_new_status in ('low', 'out') and p_new_status is distinct from p_old_status then
    -- A low alert is superseded by an out alert for the same item.
    update public.inventory_notifications
      set status = 'resolved', resolved_at = now()
      where org_id = p_org_id
        and inventory_item_id = p_item_id
        and cleared_at is null
        and status in ('unread', 'read');

    insert into public.inventory_notifications (org_id, inventory_item_id, type, title, body)
    values (
      p_org_id,
      p_item_id,
      p_new_status,
      case when p_new_status = 'out' then 'Out of stock: ' else 'Low stock: ' end || p_item_name,
      p_qty::text || ' ' || p_unit ||
        case when p_par is not null then ' left; par ' || p_par::text || ' ' || p_unit else ' left' end
    );
  elsif p_new_status = 'ok' and p_old_status in ('low', 'out') then
    update public.inventory_notifications
      set status = 'resolved', resolved_at = now()
      where org_id = p_org_id
        and inventory_item_id = p_item_id
        and cleared_at is null
        and status in ('unread', 'read');
  end if;
end;
$$;

-- ── 5. Manual / scan stock adjustment ────────────────────────────────────────
create or replace function public.adjust_inventory_stock(
  p_org_id uuid,
  p_item_id uuid,
  p_mode text,
  p_quantity numeric,
  p_reason text,
  p_note text default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_created_by uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.inventory_items;
  v_new_qty numeric;
  v_delta numeric;
  v_old_status text;
  v_new_status text;
begin
  if p_reason not in ('initial', 'purchase', 'usage', 'waste', 'adjustment', 'scan') then
    raise exception 'invalid reason';
  end if;
  if p_mode not in ('delta', 'set') then
    raise exception 'invalid mode';
  end if;

  select * into v_item
    from public.inventory_items
    where id = p_item_id and org_id = p_org_id
    for update;

  if not found then raise exception 'item not found'; end if;
  if v_item.archived then raise exception 'item archived'; end if;

  if p_mode = 'set' then
    if p_quantity < 0 then raise exception 'quantity must be >= 0'; end if;
    v_new_qty := p_quantity;
  else
    v_new_qty := v_item.quantity_on_hand + p_quantity;
  end if;

  v_delta := v_new_qty - v_item.quantity_on_hand;
  if v_delta = 0 then
    return jsonb_build_object(
      'quantity', v_new_qty,
      'delta', 0,
      'status', public.inventory_stock_status(v_new_qty, v_item.par_level, v_item.low_stock_percent, v_item.track_stock, false)
    );
  end if;

  v_old_status := public.inventory_stock_status(
    v_item.quantity_on_hand, v_item.par_level, v_item.low_stock_percent, v_item.track_stock, v_item.archived
  );

  update public.inventory_items
    set quantity_on_hand = v_new_qty, updated_at = now()
    where id = v_item.id;

  v_new_status := public.inventory_stock_status(
    v_new_qty, v_item.par_level, v_item.low_stock_percent, v_item.track_stock, false
  );

  insert into public.inventory_transactions
    (org_id, inventory_item_id, delta, balance_after, reason, reference_type, reference_id, note, created_by)
  values
    (p_org_id, p_item_id, v_delta, v_new_qty, p_reason, p_reference_type, p_reference_id, p_note, p_created_by);

  perform public.record_inventory_notification(
    p_org_id, p_item_id, v_old_status, v_new_status, v_item.name, v_new_qty, v_item.par_level, v_item.base_unit
  );

  return jsonb_build_object('quantity', v_new_qty, 'delta', v_delta, 'status', v_new_status);
end;
$$;

-- Atomic batch receipt for the inventory scanner. All lines commit or none.
create or replace function public.apply_inventory_receipts(
  p_org_id uuid,
  p_lines jsonb,
  p_reason text default 'purchase',
  p_created_by uuid default null,
  p_reference_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line jsonb;
  v_item public.inventory_items;
  v_qty numeric;
  v_new_qty numeric;
  v_old_status text;
  v_new_status text;
  v_count integer := 0;
begin
  if p_reason not in ('purchase', 'scan', 'adjustment') then
    raise exception 'invalid reason';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'lines must be an array';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := (v_line->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid quantity';
    end if;

    select * into v_item
      from public.inventory_items
      where id = (v_line->>'inventory_item_id')::uuid
        and org_id = p_org_id
      for update;

    if not found then raise exception 'item not found'; end if;
    if v_item.archived then raise exception 'item archived'; end if;

    v_old_status := public.inventory_stock_status(
      v_item.quantity_on_hand, v_item.par_level, v_item.low_stock_percent, v_item.track_stock, v_item.archived
    );
    v_new_qty := v_item.quantity_on_hand + v_qty;

    update public.inventory_items
      set quantity_on_hand = v_new_qty,
          unit_cost = coalesce((v_line->>'unit_cost')::numeric, unit_cost),
          updated_at = now()
      where id = v_item.id;

    v_new_status := public.inventory_stock_status(
      v_new_qty, v_item.par_level, v_item.low_stock_percent, v_item.track_stock, false
    );

    insert into public.inventory_transactions
      (org_id, inventory_item_id, delta, balance_after, reason, reference_type, reference_id, note, created_by)
    values
      (p_org_id, v_item.id, v_qty, v_new_qty, p_reason, 'scan', p_reference_id, v_line->>'note', p_created_by);

    perform public.record_inventory_notification(
      p_org_id, v_item.id, v_old_status, v_new_status, v_item.name, v_new_qty, v_item.par_level, v_item.base_unit
    );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('affected', v_count);
end;
$$;

-- Atomic recipe replacement for one menu item.
create or replace function public.replace_menu_item_ingredients(
  p_org_id uuid,
  p_menu_item_id uuid,
  p_items jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be an array';
  end if;

  delete from public.menu_item_ingredients
    where org_id = p_org_id and menu_item_id = p_menu_item_id;

  insert into public.menu_item_ingredients
    (org_id, menu_item_id, inventory_item_id, quantity, ai_estimated)
  select
    p_org_id,
    p_menu_item_id,
    (elem->>'inventory_item_id')::uuid,
    (elem->>'quantity')::numeric,
    coalesce((elem->>'ai_estimated')::boolean, false)
  from jsonb_array_elements(p_items) elem
  join public.inventory_items ii
    on ii.id = (elem->>'inventory_item_id')::uuid
   and ii.org_id = p_org_id
   and ii.archived = false;
end;
$$;

-- ── 6. Order deduction / reversal ────────────────────────────────────────────
create or replace function public.apply_order_inventory(
  p_order_id uuid,
  p_direction text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_row record;
  v_item public.inventory_items;
  v_reason text;
  v_sign numeric;
  v_new_qty numeric;
  v_old_status text;
  v_new_status text;
  v_tx_id uuid;
  v_affected integer := 0;
begin
  if p_direction not in ('deduct', 'reverse') then
    raise exception 'invalid direction';
  end if;

  select id, org_id, items into v_order
    from public.orders
    where id = p_order_id;

  if not found then raise exception 'order not found'; end if;

  v_reason := case when p_direction = 'deduct' then 'order_deduction' else 'order_reversal' end;
  v_sign := case when p_direction = 'deduct' then -1 else 1 end;

  for v_row in
    select
      mii.inventory_item_id as item_id,
      sum(mii.quantity * coalesce(nullif(elem->>'quantity', '')::numeric, 0)) as qty
    from jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb)) elem
    join public.menu_items mi
      on mi.id = (elem->>'id')::uuid
     and mi.org_id = v_order.org_id
     and mi.deducts_stock = true
    join public.menu_item_ingredients mii
      on mii.menu_item_id = mi.id
     and mii.org_id = v_order.org_id
    join public.inventory_items ii
      on ii.id = mii.inventory_item_id
     and ii.org_id = v_order.org_id
     and ii.track_stock = true
     and ii.archived = false
    group by mii.inventory_item_id
  loop
    if v_row.qty is null or v_row.qty <= 0 then continue; end if;

    -- Reversal without a prior deduction is a no-op.
    if p_direction = 'reverse' and not exists (
      select 1 from public.inventory_transactions
      where org_id = v_order.org_id
        and reference_type = 'order'
        and reference_id = p_order_id
        and inventory_item_id = v_row.item_id
        and reason = 'order_deduction'
    ) then
      continue;
    end if;

    select * into v_item
      from public.inventory_items
      where id = v_row.item_id and org_id = v_order.org_id
      for update;

    if not found then continue; end if;

    v_new_qty := v_item.quantity_on_hand + (v_sign * v_row.qty);
    v_old_status := public.inventory_stock_status(
      v_item.quantity_on_hand, v_item.par_level, v_item.low_stock_percent, v_item.track_stock, v_item.archived
    );

    v_tx_id := null;
    insert into public.inventory_transactions
      (org_id, inventory_item_id, delta, balance_after, reason, reference_type, reference_id)
    values
      (v_order.org_id, v_item.id, v_sign * v_row.qty, v_new_qty, v_reason, 'order', p_order_id)
    on conflict do nothing
    returning id into v_tx_id;

    if v_tx_id is null then continue; end if;

    update public.inventory_items
      set quantity_on_hand = v_new_qty, updated_at = now()
      where id = v_item.id;

    v_new_status := public.inventory_stock_status(
      v_new_qty, v_item.par_level, v_item.low_stock_percent, v_item.track_stock, false
    );

    perform public.record_inventory_notification(
      v_order.org_id, v_item.id, v_old_status, v_new_status, v_item.name, v_new_qty, v_item.par_level, v_item.base_unit
    );

    v_affected := v_affected + 1;
  end loop;

  return jsonb_build_object('affected', v_affected, 'direction', p_direction);
end;
$$;

-- ── 7. Function permissions ───────────────────────────────────────────────────
revoke all on function public.inventory_stock_status(numeric, numeric, numeric, boolean, boolean) from public;
revoke all on function public.record_inventory_notification(uuid, uuid, text, text, text, numeric, numeric, text) from public;
revoke all on function public.adjust_inventory_stock(uuid, uuid, text, numeric, text, text, text, uuid, uuid) from public;
revoke all on function public.apply_inventory_receipts(uuid, jsonb, text, uuid, uuid) from public;
revoke all on function public.replace_menu_item_ingredients(uuid, uuid, jsonb) from public;
revoke all on function public.apply_order_inventory(uuid, text) from public;

grant execute on function public.inventory_stock_status(numeric, numeric, numeric, boolean, boolean) to service_role;
grant execute on function public.record_inventory_notification(uuid, uuid, text, text, text, numeric, numeric, text) to service_role;
grant execute on function public.adjust_inventory_stock(uuid, uuid, text, numeric, text, text, text, uuid, uuid) to service_role;
grant execute on function public.apply_inventory_receipts(uuid, jsonb, text, uuid, uuid) to service_role;
grant execute on function public.replace_menu_item_ingredients(uuid, uuid, jsonb) to service_role;
grant execute on function public.apply_order_inventory(uuid, text) to service_role;

-- ── 8. Realtime ──────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_items'
  ) then
    execute 'alter publication supabase_realtime add table public.inventory_items';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.inventory_notifications';
  end if;
end $$;

comment on table public.inventory_items is
  'Per-restaurant ingredient stock. quantity_on_hand may be negative when recipes over-consume; UI treats <= 0 as out of stock. par_level is a target quantity, not a maximum.';
comment on table public.inventory_transactions is
  'Append-only stock ledger. Order deduction/reversal rows are idempotent through uq_inventory_transactions_order_ref.';
comment on table public.inventory_notifications is
  'Low/out-of-stock notification events. Clear all sets status=cleared; recovery sets status=resolved.';
