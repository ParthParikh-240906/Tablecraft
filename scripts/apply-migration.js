#!/usr/bin/env node
const https = require('https');

require('dotenv').config({ path: '.env.local' });

const url = 'iydildntxvztbnlpjcoa.supabase.co';
const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Keys loaded:', !!apiKey, !!serviceRoleKey);

async function execSQL(sql) {
  const postData = JSON.stringify({ sql });
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url,
      port: 443,
      path: '/rest/v1/',
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    const sql = `
      ALTER TABLE menu_items 
      ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS category_sort_order INTEGER DEFAULT 0;
    `;
    
    const result = await execSQL(sql);
    console.log('Result:', result.status, result.body);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
