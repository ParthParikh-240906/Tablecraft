/**
 * Manually update subscription status in DB for testing.
 * Usage: node scripts/set-subscription.js <orgSlug> <plan> <status>
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const orgSlug = process.argv[2];
const plan = process.argv[3] || 'pro';
const status = process.argv[4] || 'active';

if (!orgSlug) {
  console.error('Usage: node scripts/set-subscription.js <orgSlug> [plan] [status]');
  console.error('Examples:');
  console.error('  node scripts/set-subscription.js malabar-bites pro active');
  console.error('  node scripts/set-subscription.js apex-cafe max active');
  console.error('  node scripts/set-subscription.js malabar-bites pro canceled');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

(async () => {
  const { error } = await supabase
    .from('organizations')
    .update({
      subscription_plan: plan,
      subscription_status: status,
      stripe_subscription_id: status === 'active' ? 'sub_test_manual' : null,
      stripe_customer_id: status === 'active' ? 'cus_test_manual' : null,
      subscription_current_period_end: status === 'active' ? periodEnd : null,
    })
    .eq('slug', orgSlug);

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log(`✅ Updated ${orgSlug}: plan=${plan}, status=${status}, periodEnd=${periodEnd}`);
  console.log('\nRefresh your browser to see the changes.');
})();
