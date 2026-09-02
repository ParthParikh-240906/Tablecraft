const https = require('https');

const options = {
  hostname: 'iydildntxvztbnlpjcoa.supabase.co',
  port: 443,
  path: '/rest/v1/menu_items?select=id,name,category,sort_order,category_sort_order&org_id=eq.f197436c-d262-4ee7-9826-2afd7d3c8a16&order=category_sort_order.asc,sort_order.asc',
  method: 'GET',
  headers: {
    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('All items:');
      parsed.forEach((i, idx) => {
        console.log(`${idx+1}. ${i.name} (${i.category}): sort_order=${i.sort_order}, cat_sort=${i.category_sort_order}, id=${i.id}`);
      });
      console.log(`\nTotal: ${parsed.length} items`);
    } catch (e) {
      console.log('Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => console.error(e));
req.end();
