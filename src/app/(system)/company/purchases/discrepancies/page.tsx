import { getDiscrepancyInvoices, resolveInvoiceDiscrepancy } from '@/actions/procurement'
import Link from 'next/link'

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

export default async function GlobalDiscrepanciesPage({ searchParams }: { searchParams?: { search?: string, project?: string, supplier?: string } }) {
  let invoices = []
  let error = null
  try {
    invoices = await getDiscrepancyInvoices(undefined)
  } catch(err: any) {
    error = err.message
  }

  // Extract unique projects and suppliers for dropdowns
  const uniqueProjects = Array.from(new Set(invoices.map((inv: any) => {
    const proj = Array.isArray(inv.project) ? inv.project[0] : inv.project
    return proj?.arabic_name
  }).filter(Boolean))).sort() as string[]

  const uniqueSuppliers = Array.from(new Set(invoices.map((inv: any) => {
    const sup = Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier
    return sup?.arabic_name
  }).filter(Boolean))).sort() as string[]

  const searchQuery = searchParams?.search?.toLowerCase() || ''
  const projectQuery = searchParams?.project || ''
  const supplierQuery = searchParams?.supplier || ''

  const filteredInvoices = invoices.filter((inv: any) => {
    const projName = (Array.isArray(inv.project) ? inv.project[0] : inv.project)?.arabic_name || ''
    const supName = (Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier)?.arabic_name || ''
    
    let match = true

    if (projectQuery && projectQuery !== 'all') {
      if (projName !== projectQuery) match = false
    }

    if (supplierQuery && supplierQuery !== 'all') {
      if (supName !== supplierQuery) match = false
    }

    if (searchQuery) {
      if (!inv.invoice_no?.toLowerCase().includes(searchQuery) &&
          !projName.toLowerCase().includes(searchQuery) &&
          !supName.toLowerCase().includes(searchQuery)) {
        match = false
      }
    }

    return match
  })

  const hasActiveFilters = searchQuery || (projectQuery && projectQuery !== 'all') || (supplierQuery && supplierQuery !== 'all')

  return (
    <div className="space-y-6 pb-24 mx-auto max-w-7xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-navy">فروق الاستلامات (الشركة الرئيسية)</h1>
        <p className="text-text-secondary">مراجعة ومعالجة النقص في توريد البضائع لإنشاء إشعارات الخصم من حسابات الموردين تلقائياً على مستوى جميع المشاريع.</p>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-border">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
          <svg className="w-5 h-5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h2 className="font-bold text-navy text-base">خيارات البحث والتصفية</h2>
        </div>
        
        <form className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end w-full">
          
          <div className="flex flex-col w-full">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">نطاق العمل (المشروع)</label>
            <select
              name="project"
              defaultValue={projectQuery || 'all'}
              className="w-full border border-border rounded-lg px-3 py-2 bg-background-secondary focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
            >
              <option value="all">كافة المشاريع</option>
              {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="flex flex-col w-full">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">جهة التوريد (المورد)</label>
            <select
              name="supplier"
              defaultValue={supplierQuery || 'all'}
              className="w-full border border-border rounded-lg px-3 py-2 bg-background-secondary focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
            >
              <option value="all">كافة الموردين</option>
              {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex flex-col w-full md:col-span-2">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">بحث حر</label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  name="search" 
                  defaultValue={searchQuery}
                  placeholder="رقم الفاتورة، ملاحظات..." 
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background-secondary focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                />
                <svg className="w-4 h-4 text-text-tertiary absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
              <button type="submit" className="px-6 py-2 bg-navy text-white font-semibold rounded-lg text-sm shadow-sm hover:bg-navy/90 transition-colors whitespace-nowrap">
                بحث
              </button>
              {hasActiveFilters && (
                <Link href="/company/purchases/discrepancies" className="px-4 py-2 flex items-center justify-center border border-border bg-white text-text-secondary font-semibold rounded-lg text-sm hover:bg-background-secondary transition-colors whitespace-nowrap">
                  إلغاء التصفية
                </Link>
              )}
            </div>
          </div>
        </form>
      </div>

      {error ? (
        <div className="p-4 rounded-xl border border-danger/20 bg-danger/10 text-danger text-sm">
          {error}
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="p-12 border border-dashed border-border rounded-2xl bg-white text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-8 w-8 text-success">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-navy mb-2">لا توجد فروق استلام مطابقة</h2>
          <p className="text-text-secondary max-w-sm mx-auto">لم يتم العثور على أية فروق تتطابق مع بحثك، أو أنه لا توجد فروق معلقة حالياً.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredInvoices.map((inv: any) => {
            let actualNet = 0
            if (inv.supplier_invoice_lines) {
              for (const l of inv.supplier_invoice_lines) {
                const rQty = l.received_quantity !== null && l.received_quantity !== undefined ? Number(l.received_quantity) : Number(l.invoiced_quantity)
                const amt = rQty * Number(l.unit_price)
                actualNet += amt
              }
            }

            const proj = Array.isArray(inv.project) ? inv.project[0] : inv.project

            return (
            <div key={inv.id} className="p-5 bg-white border border-danger/30 rounded-2xl shadow-sm flex flex-col md:flex-row gap-6 md:items-center justify-between transition-colors hover:border-danger/60 hover:shadow-md">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-1 bg-red-100 text-danger text-xs font-bold rounded">نقص توريد</span>
                  <h3 className="text-lg font-bold text-navy">{inv.invoice_no}</h3>
                  <span className="text-sm text-text-secondary">{inv.invoice_date}</span>
                </div>
                <p className="text-text-secondary text-sm">
                  المشروع: <span className="font-bold text-text-primary mr-3">{proj?.arabic_name || '---'}</span>
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
                  href={`?view_invoice=${inv.id}&projectId=${inv.project_id}`}
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
