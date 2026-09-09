-- =============================================================================
-- Tablecraft — 0016_add_subscription_fields.sql
-- Add subscription tracking columns to organizations table.
-- =============================================================================

alter table public.organizations
  add column if not exists stripe_customer_id   text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status  text not null default 'free' check (subscription_status in ('free', 'active', 'canceled', 'past_due')),
  add column if not exists subscription_plan    text check (subscription_plan in ('free', 'pro', 'max')),
  add column if not exists subscription_current_period_end timestamptz;
