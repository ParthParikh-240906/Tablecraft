-- =============================================================================
-- Tablecraft — 0026_add_portal_configuration.sql
-- Store per-org Stripe Billing Portal configuration ID for custom branding.
-- =============================================================================

alter table public.organizations
  add column if not exists stripe_portal_configuration_id text;
