import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = '.env.local';
const envRaw = fs.readFileSync(envPath, 'utf-8');

const parseEnv = (key: string) => {
  const line = envRaw.split('\n').find(l => l.startsWith(key + '='));
  if (line) return line.split('=')[1].trim().replace(/^"|"$/g, '');
  return '';
};

const url = parseEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = parseEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(url, key);

async function testAll() {
  console.log("Testing certificates query...");
  const { error: e1 } = await supabase.from('subcontractor_certificates').select('*, lines:subcontractor_certificate_lines(*, work_item:project_work_item_id(arabic_description)), project:project_id(arabic_name), subcontractor:subcontractor_party_id(arabic_name)').limit(1);
  console.log("Certificates:", e1 ? e1.message : "Success");

  console.log("Testing owner billing query...");
  const { error: e2 } = await supabase.from('owner_billing_documents').select('*, lines:owner_billing_lines(*), project:project_id(arabic_name)').limit(1);
  console.log("Owner Billing:", e2 ? e2.message : "Success");

  console.log("Testing petty expenses query...");
  const { error: e3 } = await supabase.from('petty_expenses').select('*, project:project_id(arabic_name)').limit(1);
  console.log("Petty Expenses:", e3 ? e3.message : "Success");

  console.log("Testing retention query...");
  const { error: e4 } = await supabase.from('subcontractor_retention_releases').select('*, project:project_id(arabic_name), subcontractor:subcontractor_party_id(arabic_name)').limit(1);
  console.log("Retention:", e4 ? e4.message : "Success");
}

testAll().then(() => console.log('Done'));
