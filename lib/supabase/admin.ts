import { createClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY Supabase client using the service-role key.
 *
 * ⚠️ WARNING: This client BYPASSES Row Level Security. It must NEVER be
 * imported into a client component or exposed to the browser. Only use it
 * inside API routes / server actions where you have explicitly validated
 * the request (e.g. bookings, signup, Stripe webhooks).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}