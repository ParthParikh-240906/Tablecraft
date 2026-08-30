import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const slug = process.argv[2];

if (!slug) {
  console.error('Usage: node scripts/get-org-details.mjs <slug>');
  process.exit(1);
}

const { data: org, error } = await supabase
  .from('organizations')
  .select('*')
  .eq('slug', slug)
  .single();

if (error) {
  console.error('Error fetching org:', error);
  process.exit(1);
}

if (!org) {
  console.error('Organization not found');
  process.exit(1);
}

console.log('Organization Details:');
console.log(JSON.stringify(org, null, 2));