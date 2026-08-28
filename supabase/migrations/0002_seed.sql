-- =============================================================================
-- Tablecraft — 0002_seed.sql
-- Demo data: one restaurant "Demo Diner" (slug 'demo-diner') so judges can
-- try the live flow without creating their own org first.
--
-- A temp table captures the org id so every FK reference in the seed resolves
-- to the same organization. Idempotent: if the slug already exists, seed_org
-- stays empty and all INSERT ... FROM seed_org select nothing — so re-running
-- migrations never duplicates the demo data.
-- =============================================================================

-- Always create the capture table first; the DO block below decides whether it
-- gets populated (new org) or stays empty (org already exists).
create temp table if not exists seed_org (org_id uuid);
truncate seed_org;

do $$
declare
  v_org_id uuid;
begin
  -- Skip if the demo org already exists (idempotent seed).
  select id into v_org_id
  from public.organizations
  where slug = 'demo-diner';

  if v_org_id is null then
    insert into public.organizations (name, slug, logo_url, theme_color)
    values ('Demo Diner', 'demo-diner', null, '#f97316')
    returning id into v_org_id;

    insert into seed_org (org_id) values (v_org_id);
  end if;
end $$;

-- Menu items (only when the org is brand new; empty seed_org => no-op on re-run).
insert into public.menu_items (org_id, name, description, price, category, image_url, available)
select so.org_id, m.name, m.description, m.price, m.category, m.image_url, m.available
from seed_org so
cross join (values
  ('Classic Burger', 'Beef patty, cheddar, lettuce, tomato, house sauce', 12.50, 'Mains',  null, true),
  ('Veggie Burger',  'Plant-based patty, avocado, slaw',                  11.00, 'Mains',  null, true),
  ('Truffle Fries',  'Parmesan, truffle oil, chive',                       6.50, 'Sides',  null, true),
  ('Caesar Salad',   'Romaine, parmesan, croutons, caesar dressing',       9.00, 'Sides',  null, true),
  ('Lemonade',       'Fresh-squeezed lemon, mint',                         4.00, 'Drinks', null, true),
  ('Iced Latte',     'Double shot espresso over ice, oat milk option',     4.50, 'Drinks', null, true)
) as m(name, description, price, category, image_url, available);

-- Tables (T1–T6, mixed statuses so the realtime / console demo has variety).
insert into public.tables (org_id, label, capacity, status)
select so.org_id, t.label, t.capacity, t.status
from seed_org so
cross join (values
  ('T1', 2, 'open'),
  ('T2', 2, 'occupied'),
  ('T3', 4, 'open'),
  ('T4', 4, 'reserved'),
  ('T5', 6, 'open'),
  ('T6', 8, 'open')
) as t(label, capacity, status);

-- Demo staff owner (auth_user_id NULL until they sign up with Supabase Auth).
insert into public.staff_users (org_id, email, role, auth_user_id)
select so.org_id, 'demo-owner@demo.com', 'owner', null
from seed_org so;

-- Sample bookings linked to tables in the demo org.
do $$
declare
  v_org_id uuid;
  v_t4_id uuid;
  v_t2_id uuid;
begin
  select org_id into v_org_id from seed_org limit 1;
  -- No-op if the org already existed (empty seed_org).
  if v_org_id is null then
    return;
  end if;

  select id into v_t4_id from public.tables where org_id = v_org_id and label = 'T4' limit 1;
  select id into v_t2_id from public.tables where org_id = v_org_id and label = 'T2' limit 1;

  insert into public.bookings (org_id, table_id, customer_name, party_size, datetime, status)
  values
    (v_org_id, v_t4_id, 'Jordan Lee', 4, now() + interval '2 hours', 'confirmed'),
    (v_org_id, v_t2_id, 'Sam Rivera',  2, now() + interval '1 hour',  'confirmed');
end $$;

-- Cleanup the catalog table.
drop table if exists seed_org;