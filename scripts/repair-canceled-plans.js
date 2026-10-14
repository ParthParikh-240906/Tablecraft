/**
 * Repair orgs stuck on a paid plan with a canceled (or legacy "canceling")
 * subscription status. Canceling is immediate now: such rows should be Free.
 *
 * Usage:
 *   node scripts/repair-canceled-plans.js            # fix all inconsistent rows
 *   node scripts/repair-canceled-plans.js --dry-run  # list only, change nothing
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (service-role bypasses RLS, same as scripts/set-subscription.js).
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const supabase = createClient(supabaseUrl, serviceKey);

(async () => {
  const { data: rows, error } = await supabase
    .from('organizations')
    .select('id, slug, subscription_plan, subscription_status, stripe_subscription_id')
    .in('subscription_status', ['canceled', 'canceling'])
    .not('subscription_plan', 'eq', 'free');

  if (error) {
    console.error('Lookup failed:', error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('✅ No inconsistent rows — every canceled subscription is already Free.');
    return;
  }

  console.log(`Found ${rows.length} row(s) on a paid plan with a canceled status:`);
  for (const r of rows) {
    console.log(`  - ${r.slug} (plan=${r.subscription_plan}, status=${r.subscription_status}, sub=${r.stripe_subscription_id ?? 'none'})`);
  }

  if (dryRun) {
    console.log('\nDry run — no changes made. Re-run without --dry-run to fix.');
    return;
  }

  const { error: updateError } = await supabase
    .from('organizations')
    .update({
      subscription_plan: 'free',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
    })
    .in('subscription_status', ['canceled', 'canceling'])
    .not('subscription_plan', 'eq', 'free');

  if (updateError) {
    console.error('Update failed:', updateError.message);
    process.exit(1);
  }

  console.log(`\n✅ Repaired ${rows.length} row(s) → plan=free, status=canceled.`);
  console.log('Refresh the console pricing page to see both restaurants on Free.');
})();
