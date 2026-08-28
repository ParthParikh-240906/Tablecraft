import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Used by public site reads (menu, tables), realtime channels, and cart/booking forms.
 * IMPORTANT: Do NOT pass the service-role key here. Only use anon + RLS.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}