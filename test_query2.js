const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key) process.env[key] = val.join('=').trim().replace(/['"]/g, '');
});

const { createClient } = require('@supabase/supabase-js');

// Use SERVICE_ROLE_KEY to bypass RLS!
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase
    .from('subcontractor_certificates')
    .select(`
      subcontractor_party_id,
      gross_amount,
      taaliya_amount,
      other_deductions_amount,
      net_amount,
      paid_to_date,
      outstanding_amount,
      subcontractor:subcontractor_party_id(arabic_name)
    `)
    .limit(1)

  console.log('Error:', error)
  console.log('Data:', data)
}

test()
