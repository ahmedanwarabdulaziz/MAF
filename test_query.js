const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key) process.env[key] = val.join('=').trim().replace(/['"]/g, '');
});

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function getSubcontractorStatements(projectId) {
  const { data: certs, error } = await supabase
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
    .eq('project_id', projectId)
    .in('status', ['approved', 'paid_in_full'])

  if (error) throw error

  const aggregated = new Map()
  
  for (const c of certs) {
    const pId = c.subcontractor_party_id
    if (!aggregated.has(pId)) {
      const subInfo = Array.isArray(c.subcontractor) ? c.subcontractor[0] : c.subcontractor
      // console.log("subInfo =>", subInfo);
      aggregated.set(pId, {
        subcontractor_party_id: pId,
        subcontractor_name: subInfo?.arabic_name,
        total_gross: 0,
        total_taaliya: 0,
        total_net_payable: 0,
        total_paid: 0,
        total_outstanding: 0,
      })
    }
    const current = aggregated.get(pId)
    current.total_gross += Number(c.gross_amount)
    current.total_taaliya += Number(c.taaliya_amount)
    current.total_net_payable += Number(c.net_amount)
    current.total_paid += Number(c.paid_to_date)
    current.total_outstanding += Number(c.outstanding_amount)
  }

  return Array.from(aggregated.values())
}

getSubcontractorStatements('71d61be8-4cc2-49a3-8773-441690daf58f')
  .then(res => console.log('SUCCESS:', res))
  .catch(err => console.error('FAIL:', err))
