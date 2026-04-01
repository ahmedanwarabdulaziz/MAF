import { getGlobalSupplierBalances } from '../actions'
import SupplierListClient from './supplier-list-client'

export const metadata = { title: 'حسابات الموردين المركزية | الشركة' }

export default async function CompanySuppliersPage() {
  const rawScopes = await getGlobalSupplierBalances()

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      <SupplierListClient rawScopes={rawScopes} />
    </div>
  )
}
