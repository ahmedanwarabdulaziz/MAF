import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const [companyRes, projectsRes] = await Promise.all([
    supabase.from('company_supplier_balances_view').select('*'),
    supabase.from('supplier_account_summaries_view').select('*'),
  ])
  
  console.log('Company:', companyRes.data)
  console.log('Projects:', projectsRes.data)
}

test().catch(console.error)
