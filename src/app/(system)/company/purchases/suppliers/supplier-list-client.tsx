'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

export default function SupplierListClient({ rawScopes }: { rawScopes: any[] }) {
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

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
           total_outstanding: 0,
           projects: new Set<string>()
        }
      }
      const g = acc[row.supplier_party_id]
      g.total_net += Number(row.total_net || 0)
      g.total_paid += Number(row.total_paid || 0)
      g.total_outstanding += Number(row.total_outstanding || 0)
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
      const out_val = Number(sup.total_outstanding || 0)
      const net_val = Number(sup.total_net || 0)
      if (statusFilter === 'has_debt') matchStatus = out_val > 0
      if (statusFilter === 'cleared') matchStatus = out_val <= 0 && net_val > 0

      return matchSearch && matchStatus
    }).sort((a, b) => b.total_outstanding - a.total_outstanding)
  }, [rawScopes, search, projectFilter, statusFilter])

  // Aggregates for filtered view
  const totals = filtered.reduce((acc, sup) => {
    acc.net += Number(sup.total_net || 0)
    acc.paid += Number(sup.total_paid || 0)
    acc.outstanding += Number(sup.total_outstanding || 0)
    return acc
  }, { net: 0, paid: 0, outstanding: 0 })

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-border flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 min-w-[240px]">
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

        <div className="w-full md:w-64">
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

        <div className="w-full md:w-64">
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">حالة المديونية</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 bg-background-secondary focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
          >
            <option value="all">الكل</option>
            <option value="has_debt">له مستحقات (الرصيد &gt; 0)</option>
            <option value="cleared">خالص السداد (الرصيد = 0)</option>
          </select>
        </div>
      </div>

      {/* Summary Chips for Filtered View */}
      <div className="flex gap-4 mb-2 overflow-x-auto hide-scrollbar pb-1">
        <div className="bg-background-secondary px-4 py-2 rounded-lg border border-border flex items-center gap-2 whitespace-nowrap">
          <span className="text-xs text-text-secondary">عدد الموردين (المعروض):</span>
          <span className="font-bold text-navy text-sm">{filtered.length} مورد</span>
        </div>
        <div className="bg-background-secondary px-4 py-2 rounded-lg border border-border flex items-center gap-2 whitespace-nowrap">
          <span className="text-xs text-text-secondary">إجمالي المطالبات:</span>
          <span className="font-bold text-navy text-sm dir-ltr">{fmt(totals.net)}</span>
        </div>
        <div className="bg-success/5 px-4 py-2 rounded-lg border border-success/20 flex items-center gap-2 whitespace-nowrap">
          <span className="text-xs text-success">إجمالي المسدد:</span>
          <span className="font-bold text-success text-sm dir-ltr">{fmt(totals.paid)}</span>
        </div>
        <div className="bg-danger/5 px-4 py-2 rounded-lg border border-danger/20 flex items-center gap-2 whitespace-nowrap">
          <span className="text-xs text-danger">الرصيد المستحق:</span>
          <span className="font-bold text-danger text-sm dir-ltr">{fmt(totals.outstanding)}</span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-right">
          <thead className="bg-background-secondary border-b">
            <tr>
              <th className="px-5 py-3 font-semibold text-text-secondary">المورد / المقاول</th>
              <th className="px-5 py-3 font-semibold text-text-secondary">نطاقات العمل المعروضة</th>
              <th className="px-5 py-3 font-semibold text-text-secondary">إجمالي المطالبات</th>
              <th className="px-5 py-3 font-semibold text-success">المدفوع الكلي</th>
              <th className="px-5 py-3 font-semibold text-danger">الرصيد المستحق</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((sup: any) => (
              <tr key={sup.id} className="hover:bg-background-secondary/30 transition-colors">
                <td className="px-5 py-4">
                  <div className="font-semibold text-text-primary text-base">{sup.name}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1">
                    {sup.projects.map((pname: string) => (
                      <span key={pname} className={`px-2 py-0.5 rounded text-[10px] font-bold ${pname === 'الشركة الرئيسية' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-background-tertiary text-text-secondary border border-border'}`}>
                        {pname}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-4 text-text-secondary dir-ltr text-right">{fmt(sup.total_net)} ج.م</td>
                <td className="px-5 py-4 text-success font-medium dir-ltr text-right">{fmt(sup.total_paid)} ج.م</td>
                <td className="px-5 py-4 font-bold text-text-primary dir-ltr text-right">
                  <span className={sup.total_outstanding > 0 ? 'text-danger' : 'text-text-secondary'}>
                    {fmt(sup.total_outstanding)} ج.م
                  </span>
                </td>
                <td className="px-5 py-4 text-left">
                  <Link
                    href={`/company/purchases/suppliers/${sup.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors border border-primary/10"
                  >
                    كشف حساب تفصيلي
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                    </svg>
                  </Link>
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
    </div>
  )
}
