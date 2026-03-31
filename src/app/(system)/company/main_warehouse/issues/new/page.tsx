import { createClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/auth'
import { redirect } from 'next/navigation'
import MainWarehouseIssueForm from './issue-form'

export default async function NewMainWarehouseIssuePage() {
  await requirePermission('main_warehouse', 'edit')
  const supabase = createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('short_code', 'MAIN')
    .single()

  const { data: mainWarehouse } = await supabase
    .from('warehouses')
    .select('id, arabic_name')
    .eq('warehouse_type', 'main_company')
    .single()

  if (!mainWarehouse || !company) redirect('/company/main_warehouse/issues')

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">إذن صرف جديد — المخزن الرئيسي</h1>
        <p className="mt-1 text-sm text-text-secondary">
          صرف مواد من المخزن الرئيسي — الموافقة: أمين المخزن + Super Admin
        </p>
      </div>
      <MainWarehouseIssueForm
        companyId={company.id}
        warehouseId={mainWarehouse.id}
        warehouseName={mainWarehouse.arabic_name}
        returnUrl="/company/main_warehouse/issues"
      />
    </div>
  )
}
