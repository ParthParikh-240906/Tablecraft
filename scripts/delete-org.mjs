import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const orgId = process.argv[2];

if (!orgId) {
  console.error('Usage: node scripts/delete-org.mjs <orgId>');
  process.exit(1);
}

console.log(`Deleting organization: ${orgId}`);

// First, get the owner's auth_user_id from staff_users table
const { data: owner, error: fetchError } = await supabase
  .from('staff_users')
  .select('auth_user_id, email')
  .eq('org_id', orgId)
  .eq('role', 'owner')
  .single();

if (fetchError) {
  console.error('Error fetching owner:', fetchError);
  process.exit(1);
}

if (!owner) {
  console.error('Owner not found for this organization');
  process.exit(1);
}

// Delete organization FIRST (safer failure mode - cascade handles staff_users, menu_items, etc.)
const { error: deleteError } = await supabase
  .from('organizations')
  .delete()
  .eq('id', orgId);

if (deleteError) {
  console.error('Error deleting organization:', deleteError);
  process.exit(1);
}

// Delete auth user (non-critical - org is already safe if this fails)
try {
  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(
    owner.auth_user_id
  );

  if (deleteUserError) {
    console.error('Error deleting auth user:', deleteUserError);
    console.log('Warning: Auth user may remain, but organization is deleted');
  } else {
    console.log('Auth user deleted successfully:', owner.email);
  }
} catch (authError) {
  console.error('Error deleting auth user (non-critical):', authError.message);
}

console.log('Organization deletion completed');
