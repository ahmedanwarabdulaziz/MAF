import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(envFile.split('\n').filter(line => line && !line.startsWith('#') && line.includes('=')).map(line => line.split('=', 2).map(s => s.trim())))

const supabase = createClient(
  env['NEXT_PUBLIC_SUPABASE_URL'],
  env['SUPABASE_SERVICE_ROLE_KEY']
);

async function run() {
  console.log('Fixing owner collections...');
  const { data: collections, error: err1 } = await supabase.from('owner_collections').select('id, project_id');
  if (collections) {
    for (const c of collections) {
      await supabase.from('financial_transactions')
        .update({ project_id: c.project_id })
        .eq('reference_id', c.id)
        .in('reference_type', ['owner_collection', 'owner_advance'])
        .is('project_id', null);
    }
  }
  
  console.log('Fixing payment vouchers...');
  const { data: vouchers, error: err2 } = await supabase.from('payment_vouchers').select('id, project_id').not('project_id', 'is', null);
  if (vouchers) {
    for (const v of vouchers) {
      await supabase.from('financial_transactions')
        .update({ project_id: v.project_id })
        .eq('reference_id', v.id)
        .eq('reference_type', 'payment_voucher')
        .is('project_id', null);
    }
  }
  console.log('Done.');
}
run();
