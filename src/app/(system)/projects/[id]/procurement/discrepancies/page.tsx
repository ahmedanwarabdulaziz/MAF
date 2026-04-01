import { getDiscrepancyInvoices, resolveInvoiceDiscrepancy } from '@/actions/procurement'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'

// A small functional component for server actions
function ResolveButton({ invoiceId }: { invoiceId: string }) {
  async function resolveAction() {
    'use server'
    await resolveInvoiceDiscrepancy(invoiceId)
  }

  return (
    <form action={resolveAction}>
      <button 
        type="submit"
        className="px-4 py-2 bg-text-primary text-white text-sm font-bold rounded-lg shadow-sm hover:bg-navy transition-colors flex items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        تسوية آلي وإصدار إشعار خصم
      </button>
    </form>
  )
}

export default async function DiscrepanciesPage({ params }: { params: { id: string } }) {
  let invoices = []
  let error = null
  try {
    invoices = await getDiscrepancyInvoices(params.id)
  } catch(err: any) {
    error = err.message
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-navy">فروق الاستلامات (تسويات الموردين)</h1>
        <p className="text-text-secondary">مراجعة ومعالجة النقص في توريد البضائع لإنشاء إشعارات الخصم من حسابات الموردين تلقائياً.</p>
      </div>

      {error ? (
        <div className="p-4 rounded-xl border border-danger/20 bg-danger/10 text-danger text-sm">
          {error}
        </div>
      ) : invoices.length === 0 ? (
        <div className="p-12 border border-dashed border-border rounded-2xl bg-white text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-8 w-8 text-success">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-navy mb-2">لا توجد فروق استلام معلقة</h2>
          <p className="text-text-secondary max-w-sm mx-auto">جميع استلامات المخازن مطابقة للفواتير المعتمدة من الموردين ولا حاجة لإصدار تسويات.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {invoices.map((inv: any) => {
            let actualNet = 0
            if (inv.supplier_invoice_lines) {
              for (const l of inv.supplier_invoice_lines) {
                const rQty = l.received_quantity !== null && l.received_quantity !== undefined ? Number(l.received_quantity) : Number(l.invoiced_quantity)
                const amt = rQty * Number(l.unit_price)
                actualNet += amt
              }
            }

            return (
            <div key={inv.id} className="p-5 bg-white border border-danger/30 rounded-2xl shadow-sm flex flex-col md:flex-row gap-6 md:items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-1 bg-red-100 text-danger text-xs font-bold rounded">نقص توريد</span>
                  <h3 className="text-lg font-bold text-navy">{inv.invoice_no}</h3>
                  <span className="text-sm text-text-secondary">{inv.invoice_date}</span>
                </div>
                <p className="text-text-secondary text-sm">
                  المورد: <span className="font-bold text-text-primary mr-1">{Array.isArray(inv.supplier) ? inv.supplier[0]?.arabic_name : inv.supplier?.arabic_name}</span>
                </p>
                <div className="mt-4 flex flex-wrap gap-6 text-sm">
                  <div>
                    <span className="text-text-secondary block text-xs">قيمة الفاتورة المعتمدة</span>
                    <span className="font-bold text-text-primary">{Number(inv.net_amount).toLocaleString()} ج.م</span>
                  </div>
                  <div>
                    <span className="text-text-secondary block text-xs">القيمة الفعلية المستلمة</span>
                    <span className="font-bold text-success">{actualNet.toLocaleString()} ج.م</span>
                  </div>
                  <div>
                    <span className="text-text-secondary block text-xs">قيمة العجز (فرق التوريد)</span>
                    <span className="font-bold text-danger text-lg underline">{(Number(inv.net_amount) - actualNet).toLocaleString()} ج.م</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-3 shrink-0">
                <ResolveButton invoiceId={inv.id} />
                <Link 
                  href={`/projects/${params.id}/procurement/invoices`}
                  className="px-4 py-2 border border-border text-center text-text-secondary text-sm font-semibold rounded-lg hover:bg-background-secondary transition-colors"
                >
                  عرض تفاصيل الفاتورة
                </Link>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}
