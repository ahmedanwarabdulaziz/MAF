import { 
  getCompanyPurchaseInvoices,
  getExpenseCategories,
  getSupplierParties,
  getMainWarehouses,
  getItems,
  getItemGroups,
  getCompanyCostCenters
} from './actions'
import Link from 'next/link'
import NewPurchaseDialog from './NewPurchaseDialog'
import ApproveInvoiceButton from './ApproveInvoiceButton'
import ViewInvoiceModal from './ViewInvoiceModal'
import EditPurchaseDialog from './EditPurchaseDialog'
import PayInvoiceDialog from './PayInvoiceDialog'
import InvoiceAttachmentsButton from './InvoiceAttachmentsButton'
import PurchasesFilterBar from './PurchasesFilterBar'

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
)

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  draft:          { label: 'مسودة',       class: 'bg-gray-100 text-gray-700' },
  posted:         { label: 'مُرحَّلة',    class: 'bg-blue-100 text-blue-700' },
  partially_paid: { label: 'مدفوعة جزئياً', class: 'bg-yellow-100 text-yellow-700' },
  paid:           { label: 'مدفوعة',     class: 'bg-green-100 text-green-700' },
  cancelled:      { label: 'ملغية',       class: 'bg-red-100 text-red-700' },
}

const TYPE_LABELS: Record<string, string> = {
  general_expense: 'مصروف عام',
  stock_purchase:  'شراء للمخزن',
}

function parseDateInput(val: string | undefined): Date | null {
  if (!val) return null
  const dmyMatch = val.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dmyMatch) return new Date(`${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`)
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function getDateRange(period: string, dateFrom?: string, dateTo?: string): { from?: string; to?: string } {
  const now = new Date()
  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    return { from: start.toISOString(), to: end.toISOString() }
  }
  if (period === 'last_90') {
    const start = new Date(now); start.setDate(start.getDate() - 90)
    return { from: start.toISOString() }
  }
  if (period === 'this_year') {
    return { from: new Date(now.getFullYear(), 0, 1).toISOString() }
  }
  if (period === 'custom') {
    const fromD = parseDateInput(dateFrom)
    const toD   = parseDateInput(dateTo)
    if (toD) toD.setHours(23, 59, 59, 999)
    return { from: fromD?.toISOString(), to: toD?.toISOString() }
  }
  return {}
}

export default async function CompanyPurchasesPage({
  searchParams
}: {
  searchParams: { period?: string; date_from?: string; date_to?: string }
}) {
  const period = ['this_month', 'last_90', 'this_year', 'all', 'custom'].includes(searchParams.period ?? '') 
    ? (searchParams.period ?? 'this_month') 
    : 'this_month'
  const dateRange = getDateRange(period, searchParams.date_from, searchParams.date_to)

  const [invoices, categories, suppliers, warehouses, items, itemGroups, costCenters] = await Promise.all([
    getCompanyPurchaseInvoices({ 
      date_from: dateRange.from, 
      date_to: dateRange.to 
    }),
    getExpenseCategories(),
    getSupplierParties(),
    getMainWarehouses(),
    getItems(),
    getItemGroups(),
    getCompanyCostCenters(),
  ])

  const totalNet         = invoices.reduce((s: number, i: Record<string, unknown>) => s + Number(i.net_amount),       0)
  const totalPaid        = invoices.reduce((s: number, i: Record<string, unknown>) => s + Number(i.paid_to_date),     0)
  const totalOutstanding = invoices.reduce((s: number, i: Record<string, unknown>) => s + Number(i.outstanding_amount), 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  return (
    <div className="p-6 space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مشتريات الشركة</h1>
          <p className="text-sm text-gray-500 mt-1">فواتير المصروفات العامة والمشتريات المخزنية للشركة الرئيسية</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/company/purchases/expense-categories"
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
          >
            أقسام المصروفات
          </Link>
          <NewPurchaseDialog 
            categories={categories}
            suppliers={suppliers}
            warehouses={warehouses}
            items={items}
            itemGroups={itemGroups}
            costCenters={costCenters}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">إجمالي الفواتير</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span className="text-sm font-normal text-gray-400 mr-1">ج.م</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">إجمالي المدفوع</p>
          <p className="text-2xl font-bold text-green-700 mt-1">
            {totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span className="text-sm font-normal text-gray-400 mr-1">ج.م</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">إجمالي المستحق</p>
          <p className="text-2xl font-bold text-red-700 mt-1">
            {totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span className="text-sm font-normal text-gray-400 mr-1">ج.م</span>
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <PurchasesFilterBar 
        currentPeriod={period}
        currentDateFrom={searchParams.date_from}
        currentDateTo={searchParams.date_to}
      />

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {invoices.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">لا يوجد فواتير بعد</p>
            <p className="text-sm mt-1">ابدأ بإضافة فاتورة جديدة</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-gray-600">رقم الفاتورة</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">التاريخ</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">المورد</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">النوع</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">القسم / المستودع</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">الصافي</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">المستحق</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">الحالة</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {invoices.map((inv: any) => {
                const status = STATUS_LABELS[inv.status] ?? { label: inv.status, class: 'bg-gray-100 text-gray-700' }
                const categoryOrWarehouse = inv.invoice_type === 'general_expense'
                  ? inv.expense_category?.arabic_name ?? '—'
                  : inv.warehouse?.arabic_name ?? '—'
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/company/purchases/${inv.id}`} className="font-medium text-blue-600 hover:underline">
                          {inv.invoice_no}
                        </Link>
                        <InvoiceAttachmentsButton urls={inv.attachment_urls} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inv.invoice_date}</td>
                    <td className="px-4 py-3 font-medium">{inv.supplier?.arabic_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        inv.invoice_type === 'stock_purchase'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {TYPE_LABELS[inv.invoice_type] ?? inv.invoice_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{categoryOrWarehouse}</td>
                    <td className="px-4 py-3 text-left font-medium">
                      {Number(inv.net_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`px-4 py-3 text-left font-medium ${Number(inv.outstanding_amount) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {Number(inv.outstanding_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${status.class}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <div className="flex items-center justify-end gap-2">
                        <ViewInvoiceModal id={inv.id} />
                        {inv.status === 'draft' && (
                          <EditPurchaseDialog 
                            invoiceId={inv.id}
                            categories={categories}
                            suppliers={suppliers}
                            warehouses={warehouses}
                            items={items}
                            itemGroups={itemGroups}
                            costCenters={costCenters}
                          />
                        )}
                        <ApproveInvoiceButton id={inv.id} status={inv.status} />
                        {['posted', 'partially_paid'].includes(inv.status) && Number(inv.outstanding_amount) > 0 && (
                          <PayInvoiceDialog 
                            invoiceId={inv.id} 
                            maxAmount={Number(inv.outstanding_amount)} 
                            invoiceNo={inv.invoice_no} 
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
