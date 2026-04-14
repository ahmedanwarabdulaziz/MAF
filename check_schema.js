const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'd:/Res/MAF/.env.local';
const envRaw = fs.readFileSync(envPath, 'utf-8');
const parseEnv = (key) => envRaw.split('\n').find(l => l.startsWith(key + '='))?.split('=')[1].trim().replace(/^"|"$/g, '');

const supabase = createClient(parseEnv('NEXT_PUBLIC_SUPABASE_URL'), parseEnv('SUPABASE_SERVICE_ROLE_KEY'));

async function check() {
  const tables = ['purchase_requests', 'store_issues', 'subcontractor_certificates', 'owner_billing_documents', 'petty_expenses', 'subcontractor_retention_releases'];
  for (const table of tables) {
    const { data } = await supabase.from(table).select().limit(1);
    if (!data) { console.log(table, "NO DATA/ERROR"); continue; }
    if (data.length === 0) { console.log(table, "EMPTY TABLE"); continue; }
    
    console.log(table, "has attachment_urls:", Object.keys(data[0]).includes('attachment_urls') || Object.keys(data[0]).some(k => k.includes('attach')));
    console.log("Keys:", Object.keys(data[0]).filter(k => k.includes('attach') || k === 'file_url'));
  }
}
check();
