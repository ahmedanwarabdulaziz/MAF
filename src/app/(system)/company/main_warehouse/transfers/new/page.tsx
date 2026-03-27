import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import TransferForm from './transfer-form'
import { getMainCompanyId } from '@/actions/warehouse'

export default async function NewTransferPage() {
  await requireAuth()
  
  const supabase = createClient()
  const companyId = await getMainCompanyId()

  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, arabic_name, warehouse_type')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('arabic_name')

  const { data: items } = await supabase
    .from('items')
    .select('id, item_code, arabic_name, primary_unit_id, units(arabic_name)')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('arabic_name')

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">إذن تحويل مخزني جديد</h1>
        <p className="mt-1 text-sm text-text-secondary">
          نقل بضاعة من مخزن إلى آخر وإصدار مسودة إذن تحويل
        </p>
      </div>

      <TransferForm 
        companyId={companyId} 
        warehouses={warehouses || []}
        items={items || []}
      />
    </div>
  )
}
