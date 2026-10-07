-- RLS for public.email_verifications.
--
-- This table was created outside the migration flow and has no policies, so
-- the Security Advisor flags it ("RLS Disabled in Public"). Nothing in the
-- app reads it through PostgREST (anon/authenticated) — all server access
-- uses the service-role key (lib/supabase/admin.ts), which bypasses RLS —
-- so default-deny is the correct posture: enabling RLS with no permissive
-- policies blocks all anon/authenticated API access to verification tokens.
alter table public.email_verifications enable row level security;
