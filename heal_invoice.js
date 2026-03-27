const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://mudmlntyyozezevdccll.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZG1sbnR5eW96ZXpldmRjY2xsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMzc1NywiZXhwIjoyMDkwMDk5NzU3fQ.4cu4coFccwO6NXAfQVpTJrHuJ3DslMhlfBKHNsMgzhs'
)

async function heal() {
  // Find outstanding invoices that have payment allocations
  const { data: allocs } = await supabase.from('payment_allocations')
    .select('source_entity_id, allocated_amount')
    .eq('source_entity_type', 'company_purchase_invoice')

  for (const alloc of allocs || []) {
    const invId = alloc.source_entity_id;
    const { data: inv } = await supabase.from('company_purchase_invoices').select('*').eq('id', invId).single()
    
    if (inv && inv.paid_to_date < inv.net_amount) {
       console.log('Healing invoice:', inv.invoice_no, 'Adding allocation:', alloc.allocated_amount);
       
       const newPaid = Number(inv.paid_to_date) + Number(alloc.allocated_amount);
       const newOut = Number(inv.net_amount) - newPaid;
       const newStatus = newOut <= 0 ? 'paid' : 'partially_paid';

       const { error } = await supabase.from('company_purchase_invoices').update({
           paid_to_date: newPaid,
           outstanding_amount: newOut,
           status: newStatus
       }).eq('id', invId);

       if (error) console.error('Error healing:', error)
       else console.log('Healed successfully!');
    }
  }
}
heal()
