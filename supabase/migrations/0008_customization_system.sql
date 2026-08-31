
-- Customization system for restaurant layouts and styles.
-- state table: current live settings.
-- requests table: proposed changes awaiting approval.

create table if not exists public.restaurant_customizations (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default now()
);

create table if not exists public.customization_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  requested_changes jsonb not null,
  proposed_settings jsonb not null,
  status text not null default 'pending', -- 'pending', 'approved', 'rejected'
  created_at timestamp with time zone default now(),
  approved_at timestamp with time zone
);

create index idx_cust_requests_org_id on public.customization_requests(org_id);
