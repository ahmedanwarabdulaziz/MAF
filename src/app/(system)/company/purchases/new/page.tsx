import {
  getExpenseCategories,
  getSupplierParties,
  getMainWarehouses,
  getItems,
  getCompanyCostCenters,
} from '../actions'
import PurchaseInvoiceForm from './invoice-form'

export default async function NewCompanyPurchasePage() {
  const [categories, suppliers, warehouses, items, costCenters] = await Promise.all([
    getExpenseCategories(),
    getSupplierParties(),
    getMainWarehouses(),
    getItems(),
    getCompanyCostCenters(),
  ])

  return (
    <div className="p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">فاتورة مشتريات جديدة</h1>
        <p className="text-sm text-gray-500 mt-1">إضافة فاتورة مصروف عام أو شراء للمخزن</p>
      </div>
      <PurchaseInvoiceForm
        categories={categories}
        suppliers={suppliers}
        warehouses={warehouses}
        items={items}
        costCenters={costCenters}
      />
    </div>
  )
}
