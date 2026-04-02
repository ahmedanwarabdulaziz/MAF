'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import GlobalAdvancePaymentModal from './GlobalAdvancePaymentModal'
import VendorStatementModal from './VendorStatementModal'
import GlobalDraftPaymentModal from './GlobalDraftPaymentModal'

export default function SupplierListClient({ rawScopes }: { rawScopes: any[] }) {
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false)
  const [draftPaymentPartyId, setDraftPaymentPartyId] = useState<string | null>(null)
  const [isDraftPaymentOpen, setIsDraftPaymentOpen] = useState(false)
  const [statementVendorId, setStatementVendorId] = useState<string | null>(null)

  const fmt = (n: number) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })

  // Extract unique projects for the filter dropdown
  const allProjects = useMemo(() => {
    const list = new Set<string>()
    rawScopes.forEach(r => list.add(r.scope))
    return Array.from(list).sort()
  }, [rawScopes])

  const filtered = useMemo(() => {
    // 1. Filter raw data based on project so we ONLY sum the selected scope's numbers
    const scopedRows = projectFilter === 'all' 
      ? rawScopes 
      : rawScopes.filter(r => r.scope === projectFilter)

    // 2. Aggregate by supplier
    const grouped = scopedRows.reduce((acc, row) => {
      if (!acc[row.supplier_party_id]) {
        acc[row.supplier_party_id] = {
           id: row.supplier_party_id,
           name: row.supplier_name,
           total_net: 0,
           total_paid: 0,
           total_return: 0,
           total_outstanding: 0,
           advance_balance: 0,
           projects: new Set<string>(),
           has_pending_discrepancies: false
        }
      }
      const g = acc[row.supplier_party_id]
      g.total_gross = (g.total_gross || 0) + Number(row.total_gross || 0)
      g.total_discount = (g.total_discount || 0) + Number(row.total_discount || 0)
      g.total_net += Number(row.total_net || 0)
      g.total_paid += Number(row.total_paid || 0)
      g.total_return = (g.total_return || 0) + Number(row.total_return || 0)
      g.total_outstanding += Number(row.total_outstanding || 0)
      g.advance_balance = (g.advance_balance || 0) + Number(row.advance_balance || 0)
      g.has_pending_discrepancies = g.has_pending_discrepancies || !!row.has_pending_discrepancies
      g.projects.add(row.scope)
      return acc
    }, {} as Record<string, any>)

    const aggregated = Object.values(grouped).map((g: any) => ({
       ...g,
       projects: Array.from(g.projects)
    }))

    // 3. Apply search and status filters to the finalized grouped list
    return aggregated.filter(sup => {
      const supName = String(sup.name || '').toLowerCase()
      const matchSearch = !search || supName.includes(search.toLowerCase())
      
      let matchStatus = true
      const out_val = Number(sup.total_outstanding || 0) - Number(sup.advance_balance || 0) - Number(sup.total_return || 0)
      const net_val = Number(sup.total_net || 0)
      if (statusFilter === 'has_debt') matchStatus = out_val > 0
      if (statusFilter === 'advanced') matchStatus = out_val < 0
      if (statusFilter === 'cleared') matchStatus = out_val === 0 && net_val > 0

      return matchSearch && matchStatus
    }).sort((a, b) => b.total_outstanding - a.total_outstanding)
  }, [rawScopes, search, projectFilter, statusFilter])

  // Aggregates for filtered view
  const totals = filtered.reduce((acc, sup) => {
    acc.net += Number(sup.total_net || 0)
    acc.paid += Number(sup.total_paid || 0)
    acc.return += Number(sup.total_return || 0)
    acc.outstanding += Number(sup.total_outstanding || 0)
    acc.adv += Number(sup.advance_balance || 0)
    return acc
  }, { net: 0, paid: 0, return: 0, outstanding: 0, adv: 0 })

  return (
    <div className="space-y-6">
      <GlobalAdvancePaymentModal 
        isOpen={isAdvanceModalOpen} 
        onClose={() => setIsAdvanceModalOpen(false)} 
      />
      <GlobalDraftPaymentModal 
        isOpen={isDraftPaymentOpen}
        onClose={() => {
            setIsDraftPaymentOpen(false)
            setDraftPaymentPartyId(null)
        }}
        initialPartyId={draftPaymentPartyId}
      />

      {/* Page Header with Main Actions */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">مركز حسابات الموردين والمقاولين المجمع</h1>
          <p className="text-sm text-text-secondary mt-1">توضح هذه الشاشة ملخص كشوف حسابات الموردين الإجمالية عبر كافة مشاريع الشركة والمركز الرئيسي.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={() => setIsDraftPaymentOpen(true)}
            className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            إصدار أمر دفع مركزي
          </button>
          <button
            onClick={() => setIsAdvanceModalOpen(true)}
            className="px-6 py-2.5 rounded-lg bg-green-600 text-white font-bold text-sm hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
            صرف دفعة مقدمة
          </button>
        </div>
      </div>

      {/* Top Header Card Container */}
      <div className="flex flex-col xl:flex-row gap-6 mb-6">
        
        {/* RIGHT SIDE (RTL): Summary KPI Card */}
        <div className="w-full xl:w-[380px] shrink-0 rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col h-full">
            <div className="bg-white p-3 border-b border-border flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-text-secondary flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                عدد الموردين (المعروض)
              </span>
              <span className="text-xs font-bold text-navy">{filtered.length} مورد</span>
            </div>
            <div className="bg-white p-3 border-b border-border flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-text-secondary flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-navy/60"></span>
                إجمالي المطالبات
              </span>
              <span className="text-xs font-bold text-navy dir-ltr">{fmt(totals.net)}</span>
            </div>
            <div className="bg-success/5 p-3 border-b border-border/60 flex items-center justify-between gap-4 flex-1">
              <span className="text-xs font-semibold text-success-dark flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success"></span>
                المسدد (شامل المرتجع والمقدم)
              </span>
              <span className="text-xs font-bold text-success-dark dir-ltr">{fmt(totals.paid + totals.return + totals.adv)}</span>
            </div>
            <div className="bg-primary/5 p-3 border-b border-border/60 flex items-center justify-between gap-4 flex-1">
              <span className="text-xs font-semibold text-primary flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                الدفعات المقدمة (الرصيد)
              </span>
              <span className="text-xs font-bold text-primary dir-ltr">{fmt(totals.adv)}</span>
            </div>
            <div className="bg-danger/5 p-3 flex items-center justify-between gap-4 flex-1">
              <span className="text-xs font-bold text-danger flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-danger"></span>
                الرصيد المستحق
              </span>
              <span className="text-xs font-black text-danger dir-ltr">{fmt(totals.outstanding - totals.adv - totals.return)}</span>
            </div>
          </div>
        </div>

        {/* LEFT SIDE (RTL): Filters & Actions Card */}
        <div className="w-full flex-1 bg-white p-5 rounded-xl shadow-sm border border-border flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-border/50">
            <svg className="w-5 h-5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <h2 className="font-bold text-navy text-base">خيارات البحث والتصفية</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="flex flex-col">
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">نطاق العمل (المشروع)</label>
              <select
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 bg-background-secondary focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
              >
                <option value="all">كافة النطاقات والمشاريع</option>
                {allProjects.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">حالة المديونية</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 bg-background-secondary focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
              >
                <option value="all">الكل</option>
                <option value="has_debt">له مستحقات علينا (دائن &gt; 0)</option>
                <option value="advanced">مدين بدفعات مقدمة (الرصيد &lt; 0)</option>
                <option value="cleared">خالص السداد (الرصيد = 0)</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">بحث باسم المورد / المقاول</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث هنا..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background-secondary focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                />
                <svg className="w-4 h-4 text-text-tertiary absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-right">
          <thead className="bg-background-secondary border-b">
            <tr>
              <th className="px-5 py-3 font-semibold text-text-secondary">المورد / المقاول</th>
              <th className="px-5 py-3 font-semibold text-text-secondary">نطاقات العمل المعروضة</th>
              <th className="px-5 py-3 font-semibold text-text-secondary text-right" title="قيمة المطالبات قبل أي خصوم أو تعليات">كمية الأعمال (Gross)</th>
              <th className="px-5 py-3 font-semibold text-danger text-right" title="قيمة التعليات والخصومات ونسبتها من الإجمالي">التعليات والخصوم</th>
              <th className="px-5 py-3 font-semibold text-text-primary text-right" title="الصافي بعد التعلية والخصم">الصافي للمطالبة</th>
              <th className="px-5 py-3 font-semibold text-success text-right" title="مسدد مقابل فواتير">مسدد (فواتير)</th>
              <th className="px-5 py-3 font-semibold text-primary text-right" title="المبالغ المرتجعة">المرتجعات</th>
              <th className="px-5 py-3 font-semibold text-primary text-right" title="رصيد غير مستهلك من الدفعات">الدفعات المقدمة</th>
              <th className="px-5 py-3 font-semibold text-success text-right" title="إجمالي المسدد من فواتير + المرتجعات + الدفعات المقدمة">إجمالي المسدد (شامل)</th>
              <th className="px-5 py-3 font-semibold text-danger text-right" title="الرصيد الفعلي المستحق للمورد">الرصيد المستحق</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((sup: any) => (
              <tr key={sup.id} className="hover:bg-background-secondary/30 transition-colors">
                <td className="px-5 py-4">
                  <div className="font-semibold text-text-primary text-base flex flex-col items-start gap-1">
                    <span>{sup.name}</span>
                    {sup.has_pending_discrepancies && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger/10 text-danger border border-danger/20 whitespace-nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 ml-1">
                          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        فروق استلامات معلقة
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                    {sup.projects.map((pname: string) => {
                      const isMain = pname === 'الشركة الرئيسية'
                      return (
                        <span 
                          key={pname} 
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border shadow-sm ${
                            isMain 
                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isMain ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-1.5 inline-block"></span>
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1.5 inline-block"></span>
                          )}
                          {pname}
                        </span>
                      )
                    })}
                  </div>
                </td>
                <td className="px-5 py-4 text-text-secondary dir-ltr text-right">{fmt(sup.total_gross)}</td>
                <td className="px-5 py-4 text-danger dir-ltr text-right">
                  <div className="flex flex-col items-end">
                    <span>{fmt(sup.total_discount)}</span>
                    {sup.total_gross > 0 && sup.total_discount > 0 && (
                      <span className="text-[10px] block opacity-75">
                        ({((sup.total_discount / sup.total_gross) * 100).toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 font-bold text-text-primary dir-ltr text-right text-base">{fmt(sup.total_net)}</td>
                <td className="px-5 py-4 text-success font-medium dir-ltr text-right">{fmt(sup.total_paid)}</td>
                <td className="px-5 py-4 text-primary font-bold dir-ltr text-right">{fmt(sup.total_return)}</td>
                <td className="px-5 py-4 text-primary font-bold dir-ltr text-right">{fmt(sup.advance_balance)}</td>
                <td className="px-5 py-4 text-success font-bold dir-ltr text-right bg-green-50/50">
                  {fmt(Number(sup.total_paid || 0) + Number(sup.total_return || 0) + Number(sup.advance_balance || 0))}
                </td>
                <td className="px-5 py-4 font-bold text-text-primary dir-ltr text-right bg-red-50/50">
                  <span className={(sup.total_outstanding - sup.advance_balance - sup.total_return) > 0 ? 'text-danger' : 'text-text-secondary'}>
                    {fmt(sup.total_outstanding - sup.advance_balance - sup.total_return)}
                  </span>
                </td>
                <td className="px-5 py-4 text-left">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setDraftPaymentPartyId(sup.id)
                        setIsDraftPaymentOpen(true)
                      }}
                      title="إصدار أمر دفع مركزي"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 hover:shadow-sm transition-all border border-green-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setStatementVendorId(sup.id)}
                      title="كشف حساب تفصيلي"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 hover:shadow-sm transition-all border border-primary/10"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-text-secondary">
                  لا توجد نتائج تطابق خيارات التصفية الحالية.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdvanceModalOpen && (
        <GlobalAdvancePaymentModal isOpen={true} onClose={() => setIsAdvanceModalOpen(false)} />
      )}

      {statementVendorId && (
        <VendorStatementModal 
          partyId={statementVendorId} 
          onClose={() => setStatementVendorId(null)} 
        />
      )}
    </div>
  )
}
