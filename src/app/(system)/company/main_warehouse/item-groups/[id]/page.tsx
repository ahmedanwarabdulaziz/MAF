import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import ItemGroupForm from '../new/item-group-form'
import { getMainCompanyId } from '@/actions/warehouse'
import { notFound } from 'next/navigation'

export default async function EditItemGroupPage({
  params
}: {
  params: { id: string }
}) {
  await requirePermission('main_warehouse', 'view')
  
  const supabase = createClient()
  const companyId = await getMainCompanyId()

  // Fetch the item group
  const { data: itemGroup } = await supabase
    .from('item_groups')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!itemGroup) {
    return notFound()
  }

  // Fetch parent categories for the dropdown (exclude self)
  const { data: parentGroups } = await supabase
    .from('item_groups')
    .select('id, arabic_name')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .neq('id', params.id) // Cannot be its own parent
    .is('parent_group_id', null) 

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">تعديل مجموعة أصناف</h1>
        <p className="mt-1 text-sm text-text-secondary">
          تعديل بيانات فئة المخزن الرئيسي
        </p>
      </div>

      <ItemGroupForm 
        companyId={companyId} 
        parentGroups={parentGroups || []} 
        initialData={itemGroup} 
      />
    </div>
  )
}
