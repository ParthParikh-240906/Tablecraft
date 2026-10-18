-- =============================================================================
-- 0037: custom domains + Free-plan concurrent session leases
-- =============================================================================
-- organization_domains: one logical custom domain per restaurant. The apex and
-- www hostnames are stored together (hostname + alternate_hostname) and both
-- are added to the Vercel project, but they count as one domain for the product
-- limit. All writes go through service-role API routes.
--
-- org_active_sessions: shared, atomic session leases used only for Free-plan
-- restaurants. Website visitor leases and console user leases share the same
-- per-org counter (limit 2). Rows expire after a short TTL and are renewed by
-- navigation + a client heartbeat.
-- =============================================================================

create table if not exists public.organization_domains (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  hostname text not null,
  alternate_hostname text,
  kind text not null check (kind in ('apex', 'subdomain')),
  status text not null default 'pending_dns'
    check (status in ('pending_dns', 'verifying', 'active', 'error', 'removed')),
  is_primary boolean not null default true,
  verification jsonb not null default '[]'::jsonb,
  dns_records jsonb not null default '[]'::jsonb,
  ssl_status text,
  last_error text,
  verified_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_domains_hostname_key
  on public.organization_domains (lower(hostname))
  where status <> 'removed';

create unique index if not exists organization_domains_alternate_key
  on public.organization_domains (lower(alternate_hostname))
  where status <> 'removed' and alternate_hostname is not null;

-- 1 logical domain per restaurant (apex + www share one row).
create unique index if not exists organization_domains_one_per_org
  on public.organization_domains (org_id)
  where status <> 'removed';

create index if not exists organization_domains_org_idx
  on public.organization_domains (org_id);

alter table public.organization_domains enable row level security;

drop policy if exists "owners_read_own_domains" on public.organization_domains;
create policy "owners_read_own_domains"
  on public.organization_domains for select
  to authenticated
  using (
    exists (
      select 1
      from public.staff_users
      where staff_users.org_id = organization_domains.org_id
        and staff_users.auth_user_id = auth.uid()
        and staff_users.role = 'owner'
    )
  );

-- -----------------------------------------------------------------------------
-- Free-plan session leases
-- -----------------------------------------------------------------------------
create table if not exists public.org_active_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  slot_key text not null,
  kind text not null check (kind in ('site', 'console')),
  auth_user_id uuid,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create unique index if not exists org_active_sessions_org_slot_key
  on public.org_active_sessions (org_id, slot_key);

create index if not exists org_active_sessions_org_expiry
  on public.org_active_sessions (org_id, expires_at);

alter table public.org_active_sessions enable row level security;
-- No policies: service role only.

-- Atomic acquisition. Serializes per org so two simultaneous first visitors
-- cannot both take the last slot.
create or replace function public.acquire_org_slot(
  p_org_id uuid,
  p_slot_key text,
  p_kind text,
  p_limit int default 2,
  p_ttl_seconds int default 120
)
returns table (allowed boolean, active_count int, slot_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  delete from public.org_active_sessions
   where org_id = p_org_id and expires_at <= now();

  update public.org_active_sessions
     set last_seen_at = now(),
         expires_at = now() + make_interval(secs => p_ttl_seconds)
   where org_id = p_org_id and slot_key = p_slot_key
   returning id into v_id;

  if v_id is not null then
    select count(*) into v_count
      from public.org_active_sessions where org_id = p_org_id;
    return query select true, v_count, v_id;
    return;
  end if;

  select count(*) into v_count
    from public.org_active_sessions where org_id = p_org_id;

  if v_count >= p_limit then
    return query select false, v_count, null::uuid;
    return;
  end if;

  insert into public.org_active_sessions (org_id, slot_key, kind, expires_at)
  values (p_org_id, p_slot_key, p_kind, now() + make_interval(secs => p_ttl_seconds))
  returning id into v_id;

  return query select true, v_count + 1, v_id;
end;
$$;

create or replace function public.touch_org_slot(
  p_org_id uuid,
  p_slot_key text,
  p_ttl_seconds int default 120
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_found boolean;
begin
  update public.org_active_sessions
     set last_seen_at = now(),
         expires_at = now() + make_interval(secs => p_ttl_seconds)
   where org_id = p_org_id and slot_key = p_slot_key
   returning true into v_found;
  return coalesce(v_found, false);
end;
$$;

create or replace function public.release_org_slot(
  p_org_id uuid,
  p_slot_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.org_active_sessions
   where org_id = p_org_id and slot_key = p_slot_key;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;
