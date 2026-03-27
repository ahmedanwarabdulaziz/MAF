const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://mudmlntyyozezevdccll.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZG1sbnR5eW96ZXpldmRjY2xsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMzc1NywiZXhwIjoyMDkwMDk5NzU3fQ.4cu4coFccwO6NXAfQVpTJrHuJ3DslMhlfBKHNsMgzhs'
)

async function test() {
  const { data, error } = await supabase.from('supplier_account_summaries_view').select('*').limit(1)
  console.log('View Data:', data, error)
}
test()
