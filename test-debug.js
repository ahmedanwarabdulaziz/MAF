const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');

let url = '';
let key = '';

env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
});

async function run() {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key);

  console.log('Testing query...');
  const { data: certs, error: errCerts } = await supabase
    .from('subcontractor_certificates')
    .select('id, certificate_no, project_id, subcontract_agreement_id, subcontractor_party_id, period_to, status')
    .order('created_at', { ascending: false })
    .limit(5);

  if (errCerts) {
    console.error('Error fetching certs:', errCerts);
    return;
  }

  console.log('Recent certs:', certs);

  if (certs && certs.length > 0) {
    const aggId = certs[0].subcontract_agreement_id;
    const projId = certs[0].project_id;
    const partyId = certs[0].subcontractor_party_id;

    console.log(`\nTesting status query for Project: ${projId}, Party: ${partyId}, Agg: ${aggId}`);
    
    let q1 = supabase.from('subcontractor_certificates')
      .select('period_to')
      .eq('project_id', projId)
      .eq('subcontractor_party_id', partyId)
      .not('period_to', 'is', null)
      .neq('status', 'cancelled')
      .eq('subcontract_agreement_id', aggId);

    const { data: latestCerts, error: errLatest } = await q1
      .order('period_to', { ascending: false })
      .limit(1);

    if (errLatest) {
      console.error('Error fetching latestCerts:', errLatest);
    } else {
      console.log('Status query latestCerts:', latestCerts);
    }
    
    console.log('\nTesting server createDraftCertificate query...');
    const { data: testDraft, error: testErr } = await supabase
      .from('subcontractor_certificates')
      .select('period_to')
      .eq('project_id', projId)
      .eq('subcontract_agreement_id', aggId)
      .not('period_to', 'is', null)
      .neq('status', 'cancelled')
      .order('period_to', { ascending: false })
      .limit(1);
      
    if (testErr) {
      console.error('Server logic error:', testErr);
    } else {
      console.log('Server logic latestCerts:', testDraft);
    }
  }
}

run();
