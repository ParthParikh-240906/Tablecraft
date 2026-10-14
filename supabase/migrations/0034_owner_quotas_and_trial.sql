-- 0034: per-owner quotas + phone-OTP free trial (service-role only, RLS default-deny).
-- Code tries these tables first and falls back to in-memory when absent,
-- so the app works before `supabase db push` and in tests without env vars.

-- 1) Trial OTPs (one row per email; OTP hash, 10-min expiry, 7-day trial window)
create table if not exists public.trial_otps (
  email text primary key,
  phone text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  verified_at timestamptz,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.trial_otps enable row level security;

-- 2) Durable per-owner monthly usage (owner_id = auth.users.id of the owner)
create table if not exists public.owner_usage_monthly (
  owner_id uuid not null,
  category text not null check (category in ('chatbot','menu_scanner','restaurant_create','edit','image')),
  month text not null, -- YYYY-MM UTC
  used integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, category, month)
);
alter table public.owner_usage_monthly enable row level security;

-- 3) 75% warning dedup (one mail per owner+category+month)
create table if not exists public.owner_quota_warnings (
  owner_id uuid not null,
  category text not null,
  month text not null,
  warned_at timestamptz not null default now(),
  primary key (owner_id, category, month)
);
alter table public.owner_quota_warnings enable row level security;
