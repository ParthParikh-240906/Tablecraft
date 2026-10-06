// Minimal placeholder — replace with `supabase gen types` output when online.
// Run: npx supabase gen types typescript --project-id <ref> > types/database.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public: { Tables: Record<string, any>; Views: Record<string, never>; Functions: Record<string, never> };
}
