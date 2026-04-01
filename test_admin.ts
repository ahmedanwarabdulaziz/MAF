import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-admin-key'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const [companyRes, projectsRes] = await Promise.all([
    supabase.from('company_supplier_balances_view').select('*'),
    supabase.from('supplier_account_summaries_view').select('*'),
  ])
  
  console.log('Company:', JSON.stringify(companyRes.data, null, 2))
  console.log('Projects:', JSON.stringify(projectsRes.data, null, 2))
  
  if (companyRes.error) console.error(companyRes.error);
}

test().catch(console.error)
