'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ApprovalsClient({ initialData }: { initialData: any }) {
  const { prs, invoices } = initialData
  const [projectIdFilter, setProjectIdFilter] = useState<string>('all')

  // Derive unique projects
  const projectMap = new Map<string, any>()
  prs.forEach((pr: any) => {
    const p = Array.isArray(pr.project) ? pr.project[0] : pr.project
    if (p) projectMap.set(p.id, p)
  })
  invoices.forEach((inv: any) => {
    const p = Array.isArray(inv.project) ? inv.project[0] : inv.project
    if (p) projectMap.set(p.id, p)
  })
  const allProjects = Array.from(projectMap.values())

  // Apply filter
  const filteredPrs = projectIdFilter === 'all' ? prs : prs.filter((pr: any) => pr.project_id === projectIdFilter)
  const filteredInvoices = projectIdFilter === 'all' ? invoices : invoices.filter((inv: any) => inv.project_id === projectIdFilter)

  // Group by project
  const groupedData: Record<string, { project: any, prs: any[], invoices: any[] }> = {}
  filteredPrs.forEach((pr: any) => {
    const pId = pr.project_id
    if (!groupedData[pId]) groupedData[pId] = { project: Array.isArray(pr.project) ? pr.project[0] : pr.project, prs: [], invoices: [] }
    groupedData[pId].prs.push(pr)
  })
  filteredInvoices.forEach((inv: any) => {
    const pId = inv.project_id
    if (!groupedData[pId]) groupedData[pId] = { project: Array.isArray(inv.project) ? inv.project[0] : inv.project, prs: [], invoices: [] }
    groupedData[pId].invoices.push(inv)
  })

  // Group keys sorted by project name
  const groupKeys = Object.keys(groupedData).sort((a, b) => (groupedData[a].project?.arabic_name || '').localeCompare(groupedData[b].project?.arabic_name || ''))

  if (prs.length === 0 && invoices.length === 0) {
    return <div className="py-12 text-center text-text-secondary">لا توجد أية اعتمادات معلقة حالياً.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-border shadow-sm">
        <label className="text-sm font-semibold text-text-primary">تصفية بالمشروع:</label>
        <select 
          value={projectIdFilter} 
          onChange={e => setProjectIdFilter(e.target.value)}
          className="rounded-lg border border-border bg-background-secondary px-3 py-1.5 text-sm outline-none focus:border-primary"
        >
          <option value="all">-- جميع المشاريع --</option>
          {allProjects.map(p => <option key={p.id} value={p.id}>{p.arabic_name}</option>)}
        </select>
        <div className="text-xs text-text-secondary mr-auto">
          إجمالي: <span className="font-bold">{filteredPrs.length}</span> طلب شراء، و <span className="font-bold">{filteredInvoices.length}</span> فاتورة
        </div>
      </div>

      <div className="space-y-6">
        {groupKeys.length === 0 ? (
          <div className="py-8 text-center text-text-secondary">لا توجد سجلات تطابق عوامل التصفية.</div>
        ) : groupKeys.map(pid => {
          const group = groupedData[pid]
          return (
            <div key={pid} className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-background-secondary/40 border-b border-border flex justify-between items-center">
                <h2 className="text-lg font-bold text-navy">{group.project?.arabic_name || 'مشروع غير معروف'}</h2>
                <div className="flex gap-2">
                  {group.prs.length > 0 && <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded">{group.prs.length} طلب شراء</span>}
                  {group.invoices.length > 0 && <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded">{group.invoices.length} فاتورة</span>}
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* PRs */}
                {group.prs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-text-secondary mb-3 border-b border-border/50 pb-2">طلبات الشراء (Purchase Requests)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.prs.map((pr: any) => (
                         <Link key={pr.id} href={`/projects/${pid}/procurement/requests/${pr.id}`} className="block border border-border rounded-lg p-4 hover:border-primary/40 transition-colors bg-slate-50/30">
                           <div className="flex justify-between items-start mb-2">
                             <span className="font-mono text-sm font-bold text-text-primary">{pr.request_no}</span>
                             <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">بانتظار الاعتماد</span>
                           </div>
                           <div className="text-xs text-text-secondary mb-1">المُقدم: {Array.isArray(pr.requester) ? pr.requester[0]?.display_name : pr.requester?.display_name || 'غير محدد'}</div>
                           <div className="text-xs text-text-secondary">التاريخ: <span className="dir-ltr inline-block">{pr.request_date}</span></div>
                         </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invoices */}
                {group.invoices.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-text-secondary mb-3 border-b border-border/50 pb-2">فواتير الموردين (Supplier Invoices)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.invoices.map((inv: any) => {
                         const sup = Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier;
                         return (
                           <Link key={inv.id} href={`/projects/${pid}/procurement/invoices/${inv.id}`} className="block border border-border rounded-lg p-4 hover:border-primary/40 transition-colors bg-blue-50/30">
                             <div className="flex justify-between items-start mb-2">
                               <span className="font-mono text-sm font-bold text-text-primary">{inv.invoice_no}</span>
                               <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">بانتظار المطابقة</span>
                             </div>
                             <div className="text-xs text-text-secondary mb-1 truncate">المورد: {sup?.arabic_name || 'غير محدد'}</div>
                             <div className="flex justify-between items-center text-xs text-text-secondary mt-2 border-t border-border/50 pt-2">
                               <span>ت. الإصدار: <span className="dir-ltr inline-block">{inv.invoice_date}</span></span>
                               <span className="font-bold text-success dir-ltr">{Number(inv.net_amount).toLocaleString()} ج.م</span>
                             </div>
                           </Link>
                         )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
