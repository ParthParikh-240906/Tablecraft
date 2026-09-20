/**
 * Test Stripe webhook locally without the Stripe CLI.
 *
 * Usage: node scripts/test-webhook.js <event-type> [orgId] [orgSlug]
 *   event-type: subscription.created | subscription.updated | subscription.deleted
 */
const http = require('http');
const crypto = require('crypto');

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_sIYAewGwmdTsNB0hxMMTI3r9f6NpJ5Tw';
const ORG_ID = process.argv[3] || 'aeb1a707-2dcb-461e-80a2-65f9291b48aa';
const ORG_SLUG = process.argv[4] || 'apex-cafe';

const eventTypes = {
  'subscription.created': {
    type: 'customer.subscription.created',
    object: { id: 'sub_test_001', status: 'active', customer: 'cus_test_001' }
  },
  'subscription.updated': {
    type: 'customer.subscription.updated',
    object: { id: 'sub_test_001', status: 'active', customer: 'cus_test_001' }
  },
  'subscription.deleted': {
    type: 'customer.subscription.deleted',
    object: { id: 'sub_test_001', status: 'canceled', customer: 'cus_test_001' }
  },
};

const key = process.argv[2] || 'subscription.created';
const evt = eventTypes[key];
if (!evt) {
  console.error('Usage: node scripts/test-webhook.js <subscription.created|subscription.updated|subscription.deleted> [orgId] [orgSlug]');
  process.exit(1);
}

const periodEnd = Math.floor(Date.now() / 1000) + 2592000; // 30 days

const event = {
  id: `evt_test_${Date.now()}`,
  type: evt.type,
  data: {
    object: {
      ...evt.object,
      current_period_end: periodEnd,
      metadata: { orgId: ORG_ID, orgSlug: ORG_SLUG, plan: 'pro' }
    }
  }
};

const payload = JSON.stringify(event);
const timestamp = Math.floor(Date.now() / 1000);
// Fix: signature must be prefixed with s1=
const signature = crypto.createHmac('sha256', WEBHOOK_SECRET)
  .update(`${timestamp}.${payload}`)
  .digest('hex');

const headers = {
  'Content-Type': 'application/json',
  'Stripe-Signature': `t=${timestamp},v1=${signature}`
};

console.log(`Sending ${event.type} to localhost:3000/api/webhooks/stripe`);
console.log(`Org: ${ORG_SLUG} (${ORG_ID})`);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/webhooks/stripe',
  method: 'POST',
  headers
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(`---\nResponse: ${res.statusCode} ${data}`);
    if (res.statusCode === 200) {
      console.log('\n✅ DB should now show Pro plan for this org.');
    } else {
      console.log('\n❌ Check server logs for errors.');
    }
  });
});

req.on('error', (e) => console.error(`Request error: ${e.message}`));
req.write(payload);
req.end();
