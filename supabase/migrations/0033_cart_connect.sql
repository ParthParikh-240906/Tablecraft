-- =============================================================================
-- Tablecraft — 0033_cart_connect.sql
--
-- Guest cart checkout + Stripe Connect onboarding.
--
-- 1. organizations.stripe_connect_account_id / stripe_connect_status:
--    the restaurant's own Stripe Express account for destination-charge
--    guest checkouts. Billing columns stay out of the public view (0032).
-- 2. orders.fulfillment ('pickup' default, 'delivery') + customer_phone:
--    cart checkout writes these; kitchen/console already read the row.
-- 3. design_settings.cart_config is schemaless JSONB (like booking_config):
--    {mode, delivery_fee, min_order} with app-level defaults in
--    lib/design.ts defaultCartConfig(). No view change needed.
-- =============================================================================

alter table public.organizations
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_status text not null default 'none';

alter table public.orders
  add column if not exists fulfillment text not null default 'pickup'
    check (fulfillment in ('pickup', 'delivery')),
  add column if not exists customer_phone text;
