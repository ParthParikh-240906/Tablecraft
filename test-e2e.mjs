import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(URL, ANON);

// 1. Sign in
const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
  email: 'test-staff@test.com',
  password: 'TestPass123!'
});
if (authErr) { console.error('Sign in error:', authErr.message); process.exit(1); }
console.log('Signed in OK');

const session = authData.session;
const cookieValue = `sb-${URL.match(/supabase\.co$/)?.[0] ? '' : ''}auth-token=${session.access_token}`;

// 2. Create order via API
const TABLE_ID = 'bdea1c83-4d52-4afc-a4b9-0d9f8bfe5f87'; // Table 1
const ITEM_ID = 'faf24fa5-70f9-43e7-89dd-0f8d319e21d1';   // Butter Naan

const createRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '.localhost:3000')}/api/orders/create`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  // Can't easily pass cookies from Node, so use the service role key trick
  // Instead let's just test the server directly
});

console.log('API response:', await createRes.text());
