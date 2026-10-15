/**
 * Owner-wide backfill: mirror ONE plan across ALL restaurants owned by the same owner.
 *
 * Phase 0 unblock for "upgraded to Max but still shows Free / per-restaurant select".
 *
 * Usage:
 *   node scripts/backfill-owner-plan.js <orgSlug|ownerEmail> [plan] [status]
 *   node scripts/backfill-owner-plan.js taj max active
 *   node scripts/backfill-owner-plan.js owner@example.com max active
 *   node scripts/backfill-owner-plan.js taj --dry-run
 *
 * Behavior:
 *   1. Resolves the owner (auth_user_id) from an org slug or owner email.
 *   2. Lists EVERY org where that user is owner.
 *   3. Picks the source-of-truth subscription row: the owned org with the
 *      highest tier (max > pro > free), preferring active over canceled.
 *      Explicit [plan] [status] args override the inferred plan/status.
 *   4. Mirrors subscription_plan/status/customer/subscription/periodEnd to ALL
 *      owned orgs so /console/pricing shows ONE plan everywhere.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env (.env.local)');
  process.exit(1);
}

const [target, planArg, statusArg] = process.argv.slice(2);
const dryRun = process.argv.includes('--dry-run');

if (!target || target === '--dry-run') {
  console.error('Usage: node scripts/backfill-owner-plan.js <orgSlug|ownerEmail> [plan] [status] [--dry-run]');
  console.error('Examples:');
  console.error('  node scripts/backfill-owner-plan.js taj max active');
  console.error('  node scripts/backfill-owner-plan.js owner@example.com max active');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const TIER_RANK = { free: 0, pro: 1, max: 2 };

(async () => {
  // 1) Resolve owner auth_user_id.
  let ownerId = null;

  if (target.includes('@')) {
    const { data: staffRow, error } = await supabase
      .from('staff_users')
      .select('auth_user_id, org_id')
      .eq('email', target)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();
    if (error || !staffRow) {
      console.error(`No owner found for email ${target}:`, error?.message ?? 'not found');
      process.exit(1);
    }
    ownerId = staffRow.auth_user_id;
  } else {
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('id, slug')
      .eq('slug', target)
      .maybeSingle();
    if (orgErr || !org) {
      console.error(`Org slug "${target}" not found:`, orgErr?.message ?? '');
      process.exit(1);
    }
    const { data: ownerRow, error: ownerErr } = await supabase
      .from('staff_users')
      .select('auth_user_id')
      .eq('org_id', org.id)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();
    if (ownerErr || !ownerRow?.auth_user_id) {
      console.error(`No owner row for org ${target}.`);
      process.exit(1);
    }
    ownerId = ownerRow.auth_user_id;
  }

  // 2) Every org this owner holds.
  const { data: links, error: linksErr } = await supabase
    .from('staff_users')
    .select('org_id')
    .eq('auth_user_id', ownerId)
    .eq('role', 'owner');
  if (linksErr) {
    console.error('Owner org lookup failed:', linksErr.message);
    process.exit(1);
  }
  const orgIds = [...new Set((links ?? []).map((r) => r.org_id).filter(Boolean))];
  if (orgIds.length === 0) {
    console.error('Owner holds no restaurants.');
    process.exit(1);
  }

  const { data: orgs, error: orgsErr } = await supabase
    .from('organizations')
    .select('id, slug, subscription_plan, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_current_period_end')
    .in('id', orgIds);
  if (orgsErr) {
    console.error('Org fetch failed:', orgsErr.message);
    process.exit(1);
  }

  console.log(`Owner ${ownerId} holds ${orgs.length} restaurant(s):`);
  for (const o of orgs) {
    console.log(`  - ${o.slug} plan=${o.subscription_plan} status=${o.subscription_status} cus=${o.stripe_customer_id ?? 'none'} sub=${o.stripe_subscription_id ?? 'none'}`);
  }

  // 3) Source of truth: highest tier, preferring active.
  const sorted = [...orgs].sort((a, b) => {
    const rankDiff = (TIER_RANK[b.subscription_plan] ?? 0) - (TIER_RANK[a.subscription_plan] ?? 0);
    if (rankDiff !== 0) return rankDiff;
    if (a.subscription_status === b.subscription_status) return 0;
    return a.subscription_status === 'active' ? -1 : 1;
  });
  const source = sorted[0];
  const plan = planArg || source.subscription_plan || 'free';
  const status = statusArg || (plan === 'free' ? 'canceled' : source.subscription_status || 'active');
  const customerId = orgs.map((o) => o.stripe_customer_id).find(Boolean) ?? source.stripe_customer_id ?? null;
  const subscriptionId = status === 'active'
    ? (orgs.map((o) => o.stripe_subscription_id).find(Boolean) ?? source.stripe_subscription_id ?? null)
    : null;
  const periodEnd = status === 'active'
    ? (orgs.map((o) => o.subscription_current_period_end).find(Boolean)
      ?? source.subscription_current_period_end
      ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
    : source.subscription_current_period_end ?? null;

  console.log(`\nMirroring → plan=${plan} status=${status} cus=${customerId ?? 'none'} sub=${subscriptionId ?? 'none'} across ${orgIds.length} org(s)`);

  if (dryRun) {
    console.log('Dry run — no changes made.');
    return;
  }

  const { error: updateErr } = await supabase
    .from('organizations')
    .update({
      subscription_plan: plan,
      subscription_status: status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_current_period_end: periodEnd,
    })
    .in('id', orgIds);

  if (updateErr) {
    console.error('Backfill failed:', updateErr.message);
    process.exit(1);
  }

  console.log(`✅ Backfilled ${orgIds.length} org(s) → ${plan}/${status}. Refresh /console/pricing to verify one plan everywhere.`);
})();
