import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mudmlntyyozezevdccll.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZG1sbnR5eW96ZXpldmRjY2xsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMzc1NywiZXhwIjoyMDkwMDk5NzU3fQ.4cu4coFccwO6NXAfQVpTJrHuJ3DslMhlfBKHNsMgzhs'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function run() {
  console.log('=== P16: Testing Employee Custody & Expenses Logic ===\n')

  // 1. Get a random company
  const { data: companies } = await admin.from('companies').select('id').limit(1)
  const companyId = companies[0]?.id
  if (!companyId) throw new Error('No company found.')

  // 2. Get the super admin user
  const { data: { users } } = await admin.auth.admin.listUsers()
  const superUser = users.find(u => u.email === 'a@a.com')
  if (!superUser) throw new Error('Super admin not found')

  // 3. Create Expense Group and Item
  console.log('1. Setting up Test Expense Group and Item...')
  const { data: grp, error: grpErr } = await admin.from('expense_groups')
    .insert([{ company_id: companyId, group_code: 'TEST-TRNS', arabic_name: 'انتقالات تجريبية' }])
    .select().single()
  
  // Ignore duplicate errors if re-running
  let groupId = grp?.id
  if (grpErr && grpErr.code === '23505') {
    const { data: g } = await admin.from('expense_groups').select('id').eq('group_code', 'TEST-TRNS').single()
    groupId = g.id
  } else if (grpErr) throw grpErr

  const { data: itm, error: itmErr } = await admin.from('expense_items')
    .insert([{ expense_group_id: groupId, item_code: 'TEST-TAXI', arabic_name: 'تاكسي' }])
    .select().single()

  let itemId = itm?.id
  if (itmErr && itmErr.code === '23505') {
    const { data: i } = await admin.from('expense_items').select('id').eq('item_code', 'TEST-TAXI').single()
    itemId = i.id
  } else if (itmErr) throw itmErr

  // 4. Create Custody Account (Test Account with 500 limit)
  console.log('2. Creating Custody Account (Limit: 500 EGP)...')
  const { data: account, error: accErr } = await admin.from('employee_custody_accounts')
    .insert([{
      company_id: companyId,
      employee_user_id: superUser.id,
      account_type: 'temporary',
      allowed_negative_limit: 500,
      notes: 'Test Custody Account'
    }])
    .select().single()

  let accountId = account?.id
  if (accErr && accErr.code === '23505') {
    const { data: a } = await admin.from('employee_custody_accounts')
      .select('id').eq('employee_user_id', superUser.id).eq('account_type', 'temporary').single()
    accountId = a.id
  } else if (accErr) throw accErr

  // Clear previous test transactions for this account for a clean test map
  await admin.from('employee_custody_transactions').delete().eq('employee_custody_account_id', accountId)

  // 5. Fund the Account (1000 EGP)
  console.log('3. Funding Custody Account (+1000)...')
  await admin.from('employee_custody_transactions').insert([{
    employee_custody_account_id: accountId,
    transaction_type: 'funding',
    amount: 1000,
    reference_type: 'manual',
    notes: 'Initial test funding'
  }])

  // 6. Test Valid Expense Deduction (-1200 EGP) -> Limit allows -500, so (-200) balance is acceptable.
  console.log('4. Testing Valid Deduction (-1200) -> Should Succeed (Balance goes to -200, within 500 limit)')
  const { error: txErr1 } = await admin.from('employee_custody_transactions').insert([{
    employee_custody_account_id: accountId,
    transaction_type: 'expense',
    amount: -1200,
    reference_type: 'petty_expense',
    notes: 'Test valid expense'
  }])
  if (txErr1) throw new Error('Expected Valid Deduction to succeed, but it failed: ' + txErr1.message)
  console.log('  ✓ Succeeded')

  // 7. Check the balance view
  const { data: view1 } = await admin.from('employee_custody_balances_view').select('current_balance').eq('custody_account_id', accountId).single()
  console.log(`  Current Balance: ${view1.current_balance} EGP`)

  // 8. Test Invalid Expense Deduction (-400 EGP) -> Balance is -200, taking another 400 makes it -600. Limit is 500. Should FAIL.
  console.log('5. Testing Invalid Deduction (-400) -> Should Fail (Exceeds 500 deficit limit)')
  const { error: txErr2 } = await admin.from('employee_custody_transactions').insert([{
    employee_custody_account_id: accountId,
    transaction_type: 'expense',
    amount: -400,
    reference_type: 'petty_expense',
    notes: 'Test invalid expense'
  }])
  if (!txErr2) throw new Error('Expected Invalid Deduction to fail hitting the negative limit, but it Succeeded!')
  console.log('  ✓ Failed gracefully as expected. DB MSG: ' + txErr2.message)

  console.log('\n✅ All Custody Validation Tests Passed Successfully!')
}

run().catch(console.error)
