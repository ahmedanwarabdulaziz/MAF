import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mudmlntyyozezevdccll.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZG1sbnR5eW96ZXpldmRjY2xsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMzc1NywiZXhwIjoyMDkwMDk5NzU3fQ.4cu4coFccwO6NXAfQVpTJrHuJ3DslMhlfBKHNsMgzhs'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function run() {
  console.log('=== P18: Seeding Treasury Accounts ===\n')

  // 1. Get a random company
  const { data: companies } = await admin.from('companies').select('id').limit(1)
  const companyId = companies?.[0]?.id
  if (!companyId) throw new Error('No company found.')

  // 2. Get a random project
  const { data: projects } = await admin.from('projects').select('id, arabic_name').eq('company_id', companyId).limit(1)
  const projectId = projects?.[0]?.id

  // 3. Insert Corporate Bank Account
  console.log('1. Seeding Corporate Bank (CIB)...')
  const { error: accErr1 } = await admin.from('financial_accounts')
    .insert([{
      company_id: companyId,
      project_id: null,
      account_type: 'bank',
      arabic_name: 'البنك التجاري الدولي - حساب رئيسي',
      english_name: 'CIB - Main Account',
      currency: 'EGP',
      notes: 'Corporate Treasury'
    }])
  
  if (accErr1 && accErr1.code !== '23505') console.error('Failed to seed CIB:', accErr1.message)
  else console.log('  ✓ Corporate Bank OK')

  // 4. Insert Project Cashbox Account
  if (projectId) {
    console.log(`2. Seeding Project Cashbox for [${projects[0].arabic_name}]...`)
    const { error: accErr2 } = await admin.from('financial_accounts')
      .insert([{
        company_id: companyId,
        project_id: projectId,
        account_type: 'cashbox',
        arabic_name: 'خزينة الموقع',
        english_name: 'Site Cashbox',
        currency: 'EGP',
        notes: 'Project Site Treasury'
      }])
    
    if (accErr2 && accErr2.code !== '23505') console.error('Failed to seed Project Cashbox:', accErr2.message)
    else console.log('  ✓ Project Cashbox OK')
  }

  // 5. Check the balances view
  const { data: views, error: viewErr } = await admin.from('financial_account_balances_view').select('*')
  if (viewErr) {
    console.error('Failed to query balances view:', viewErr.message)
  } else {
    console.log(`\nFound ${views.length} active financial accounts in the balance view.`)
  }

  console.log('\n✅ Seed Script Finished!')
}

run().catch(console.error)
