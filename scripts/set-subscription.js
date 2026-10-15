/**
 * Manually update subscription status in DB for testing.
 * Owner-wide: mirrors ONE plan across ALL restaurants the owner holds
 * (previously this updated a single org row, recreating the 1x Max / 2x Free
 * divergence seen in /dashboard).
 *
 * Usage: node scripts/set-subscription.js <orgSlug> [plan] [status]
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
  // Resolve the owner via the anchor org, then fan-out to every owned org.
  const { data: anchor, error: anchorErr } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .maybeSingle();
  if (anchorErr || !anchor) {
    console.error('Anchor org not found:', anchorErr?.message ?? orgSlug);
    process.exit(1);
  }
  const { data: ownerRow } = await supabase
    .from('staff_users')
    .select('auth_user_id')
    .eq('org_id', anchor.id)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();
  let targetIds = [anchor.id];
  if (ownerRow?.auth_user_id) {
    const { data: links } = await supabase
      .from('staff_users')
      .select('org_id')
      .eq('auth_user_id', ownerRow.auth_user_id)
      .eq('role', 'owner');
    const ids = [...new Set((links ?? []).map((r) => r.org_id).filter(Boolean))];
    if (ids.length > 0) targetIds = ids;
  }

  const { error } = await supabase
    .from('organizations')
    .update({
      subscription_plan: plan,
      subscription_status: status,
      stripe_subscription_id: status === 'active' ? 'sub_test_manual' : null,
      stripe_customer_id: status === 'active' ? 'cus_test_manual' : null,
      subscription_current_period_end: status === 'active' ? periodEnd : null,
    })
    .in('id', targetIds);

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log(`✅ Updated ${targetIds.length} org(s) via ${orgSlug}: plan=${plan}, status=${status}, periodEnd=${periodEnd}`);
  console.log('\nRefresh your browser to see the changes.');
})();
