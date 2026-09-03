-- Migration: add table_type column to tables
-- movable tables: always 4 seats alone, 6 seats when paired (never combine >2)
-- non-movable tables: use actual capacity for all logic
alter table public.tables
  add column if not exists table_type text not null default 'non-movable'
    check (table_type in ('movable', 'non-movable'));
