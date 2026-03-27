const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://mudmlntyyozezevdccll.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZG1sbnR5eW96ZXpldmRjY2xsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMzc1NywiZXhwIjoyMDkwMDk5NzU3fQ.4cu4coFccwO6NXAfQVpTJrHuJ3DslMhlfBKHNsMgzhs'
)

async function heal() {
  const { data: invs, error } = await supabase.from('supplier_invoices').select('*').eq('outstanding_amount', 0).gt('net_amount', 0)
  if (error) return console.error(error)

  for (const inv of invs) {
      if (inv.paid_to_date < inv.net_amount) {
          console.log(`Healing invoice ${inv.invoice_no}: net=${inv.net_amount}, paid=${inv.paid_to_date}`)
          const out = inv.net_amount - inv.paid_to_date
          await supabase.from('supplier_invoices').update({ outstanding_amount: out }).eq('id', inv.id)
      }
  }
  console.log('Healing complete!')
}
heal()
