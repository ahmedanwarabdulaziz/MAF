import { getGlobalSupplierBalances } from '../actions'
import SupplierListClient from './supplier-list-client'

export const metadata = { title: 'حسابات الموردين المركزية | الشركة' }

export default async function CompanySuppliersPage() {
  const rawScopes = await getGlobalSupplierBalances()

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">مركز حسابات الموردين والمقاولين المجمع</h1>
          <p className="text-sm text-text-secondary mt-1">توضح هذه الشاشة ملخص كشوف حسابات الموردين الإجمالية عبر كافة مشاريع الشركة والمركز الرئيسي.</p>
        </div>
      </div>

      <SupplierListClient rawScopes={rawScopes} />
    </div>
  )
}
