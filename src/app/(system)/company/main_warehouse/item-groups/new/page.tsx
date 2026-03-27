import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import ItemGroupForm from './item-group-form'
import { getMainCompanyId } from '@/actions/warehouse'

export default async function NewItemGroupPage() {
  await requirePermission('main_warehouse', 'view')
  
  const supabase = createClient()
  const companyId = await getMainCompanyId()

  // Fetch parent categories for the dropdown
  const { data: parentGroups } = await supabase
    .from('item_groups')
    .select('id, arabic_name')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('parent_group_id', null) // only top level for simplicity, or all

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">إضافة مجموعة أصناف</h1>
        <p className="mt-1 text-sm text-text-secondary">
          تعريف فئة جديدة في شجرة الأصناف للمخزن الرئيسي
        </p>
      </div>

      <ItemGroupForm companyId={companyId} parentGroups={parentGroups || []} />
    </div>
  )
}
