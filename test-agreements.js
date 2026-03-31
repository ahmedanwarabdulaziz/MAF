const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function test() {
  const projectId = '71d61be8-4cc2-49a3-8773-441690daf58f';
  const { data, error } = await supabase
    .from('subcontract_agreements')
    .select(`
      *,
      subcontractor:subcontractor_party_id(arabic_name)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  console.log('Error:', error);
  console.log('Data:', data);
}

test();
