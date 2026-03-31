const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key) process.env[key] = val.join('=').trim().replace(/['"]/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@maf.com',
    password: 'password123'
  });
  
  if (authErr) {
    console.error("Auth Err:", authErr);
    return;
  }
  
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
    .limit(1);

  if (error) {
    console.error("Query Error:", error);
  } else {
    console.log("SUCCESS Data:", data);
  }
}

run();
