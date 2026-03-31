require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data, error } = await supabase
    .from('subcontractor_certificates')
    .select('id, certificate_no, subcontract_agreement_id, period_from, period_to, status')
    .in('certificate_no', ['CERT-SUB-001-01', 'CERT-SUB-001-02']);
    
  console.log('Certs:', data);
  
  if (data && data.length > 0) {
    const aggId = data[0].subcontract_agreement_id;
    console.log('Testing query for aggId:', aggId);
    
    // Simulate createDraftCertificate query exactly
    const { data: latestCerts } = await supabase
      .from('subcontractor_certificates')
      .select('certificate_no, period_to, status')
      .eq('subcontract_agreement_id', aggId)
      .not('period_to', 'is', null)
      .neq('status', 'cancelled')
      .order('period_to', { ascending: false })
      .limit(1);
      
    console.log('latestCerts query result:', latestCerts);
    
    if (latestCerts && latestCerts.length > 0) {
      const from = '2026-03-10';
      const to = latestCerts[0].period_to;
      console.log(`Checking: new Date("${from}") <= new Date("${to}")`);
      const check1 = new Date(from) <= new Date(to);
      console.log('Result:', check1);
      
      console.log(`Checking string comparison: "${from}" <= "${to}"`);
      const check2 = from <= to;
      console.log('Result string:', check2);
    }
  }
}

test();
