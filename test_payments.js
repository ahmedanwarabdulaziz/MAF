const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key) process.env[key] = val.join('=').trim().replace(/['"]/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('payment_vouchers')
    .select(`
      *,
      financial_account:financial_account_id(arabic_name, currency),
      parties:payment_voucher_parties(
        paid_amount,
        party:party_id(arabic_name)
      )
    `)
    .limit(1)

  if (error) {
    console.error("Query Error:", error);
  } else {
    console.log("SUCCESS Data:", data);
  }
}

run();
