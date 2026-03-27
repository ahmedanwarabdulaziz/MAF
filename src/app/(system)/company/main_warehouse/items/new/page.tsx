import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import ItemForm from './item-form'
import { getMainCompanyId } from '@/actions/warehouse'

export default async function NewItemPage() {
  await requirePermission('main_warehouse', 'view')
  
  const supabase = createClient()
  const companyId = await getMainCompanyId()

  const { data: itemGroups } = await supabase
    .from('item_groups')
    .select('id, arabic_name, group_code, parent_group_id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('arabic_name')

  const { data: units } = await supabase
    .from('units')
    .select('id, arabic_name')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('arabic_name')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">إضافة صنف جديد</h1>
        <p className="mt-1 text-sm text-text-secondary">
          تسجيل صنف جديد في دليل الأصناف وتحديد بياناته الأساسية
        </p>
      </div>

      <ItemForm 
        companyId={companyId} 
        itemGroups={itemGroups || []} 
        units={units || []} 
      />
    </div>
  )
}
