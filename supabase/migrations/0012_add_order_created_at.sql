-- Migration: add created_at to orders table
-- The orders table had no timestamp column; all UI pages sort/filter by created_at.
alter table public.orders
  add column if not exists created_at timestamptz not null default now();
