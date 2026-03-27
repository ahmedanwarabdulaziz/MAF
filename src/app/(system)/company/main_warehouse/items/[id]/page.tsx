import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import ItemForm from '../new/item-form'
import { getMainCompanyId } from '@/actions/warehouse'
import { notFound } from 'next/navigation'

export default async function EditItemPage({
  params
}: {
  params: { id: string }
}) {
  await requireAuth()
  
  const supabase = createClient()
  const companyId = await getMainCompanyId()

  const { data: item } = await supabase
    .from('items')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!item) {
    return notFound()
  }

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
        <h1 className="text-2xl font-bold text-text-primary">تعديل بيانات الصنف</h1>
        <p className="mt-1 text-sm text-text-secondary">
          تحديث معلومات الصنف في دليل الأصناف
        </p>
      </div>

      <ItemForm 
        companyId={companyId} 
        itemGroups={itemGroups || []} 
        units={units || []}
        initialData={item}
      />
    </div>
  )
}
