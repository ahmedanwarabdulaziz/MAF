import { createClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/auth'
import { formatCurrency } from '@/lib/format'
import { notFound } from 'next/navigation'
import { getProjectDashboardMetrics } from '@/actions/dashboards'

export const metadata = {
  title: 'تتبع تكاليف المشروع | نظام إدارة المقاولات'
}

export default async function ProjectCostTrackingPage({ params }: { params: { id: string } }) {
  await requirePermission('dashboard', 'view')

  const supabase = createClient()
  
  // Basic Project Info
  const { data: project } = await supabase
    .from('projects')
    .select('arabic_name, project_code')
    .eq('id', params.id)
    .single()
    
  if (!project) notFound()

  // Execute remaining independent queries in parallel
  const [
    metrics,
    { data: issues },
    { data: petty },
    { data: subcontractorCertificates },
    { data: supplierInvoices }
  ] = await Promise.all([
    getProjectDashboardMetrics(params.id),
    supabase
      .from('store_issues')
      .select(`
        id, document_no, issue_date,
        lines:store_issue_lines ( quantity, unit_cost, total_cost, item:item_id (item_code, arabic_name), unit:unit_id(arabic_name) )
      `)
      .eq('project_id', params.id)
      .eq('status', 'confirmed')
      .order('issue_date', { ascending: false }),
    supabase
      .from('petty_expenses')
      .select(`
        id, document_no, expense_date, amount, description,
        category:expense_category_id(arabic_name)
      `)
      .eq('project_id', params.id)
      .eq('status', 'approved')
      .order('expense_date', { ascending: false }),
    supabase
      .from('subcontractor_certificates')
      .select(`
        id, document_no, certificate_date, net_amount,
        agreement:agreement_id( subcontractor:subcontractor_id(arabic_name) )
      `)
      .eq('project_id', params.id)
      .in('status', ['approved', 'paid_in_full'])
      .order('certificate_date', { ascending: false }),
    supabase
      .from('supplier_invoices')
      .select(`
        id, invoice_number, invoice_date, net_amount,
        supplier:supplier_id(arabic_name)
      `)
      .eq('project_id', params.id)
      .in('status', ['posted', 'partially_paid', 'paid'])
      .order('invoice_date', { ascending: false })
  ])

  // Transform Data for easy rendering
  const materialLines = issues?.flatMap(i => 
    (Array.isArray(i.lines) ? i.lines : []).map((l: any) => ({
      issue_doc: i.document_no,
      date: i.issue_date,
      item: Array.isArray(l.item) ? l.item[0] : l.item,
      unit: Array.isArray(l.unit) ? l.unit[0] : l.unit,
      qty: l.quantity,
      cost: l.total_cost
    }))
  ) || []

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-text-secondary font-mono tracking-wider">
          [{project.project_code}]
        </p>
        <h1 className="text-3xl font-bold text-navy">تتبع تكاليف المشروع: {project.arabic_name}</h1>
        <p className="mt-2 text-text-secondary">سجل التكاليف المباشرة والالتزامات التفصيلية المحملة على الموازنة</p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
          <div className="text-sm font-semibold text-blue-800 mb-1">الموازنة التقديرية المعتمدة</div>
          <div className="text-2xl font-bold text-blue-900" dir="ltr">{formatCurrency(metrics.budget)}</div>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-5 shadow-sm">
          <div className="text-sm font-semibold text-orange-800 mb-1">الخامات المنصرفة للموقع</div>
          <p className="text-xs text-orange-600 mb-2">من أذون الصرف والمخازن</p>
          <div className="text-2xl font-bold text-orange-900" dir="ltr">
            {formatCurrency(materialLines.reduce((acc, curr) => acc + Number(curr.cost || 0), 0))}
          </div>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-sm">
          <div className="text-sm font-semibold text-indigo-800 mb-1">مقاولين وباطن وتوريدات</div>
          <p className="text-xs text-indigo-600 mb-2">من المستخلصات والفواتير المباشرة</p>
          <div className="text-2xl font-bold text-indigo-900" dir="ltr">
            {formatCurrency(metrics.subcontractor_liability + metrics.incurred_material_cost)}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <div className="text-sm font-semibold text-emerald-800 mb-1">إجمالي التكلفة الفعلية المحملة</div>
          <p className="text-xs text-emerald-600 mb-2">شامل جميع البنود والنثريات</p>
          <div className="text-2xl font-bold text-emerald-900" dir="ltr">
            {formatCurrency(
              materialLines.reduce((acc, curr) => acc + Number(curr.cost || 0), 0) +
              metrics.subcontractor_liability + 
              metrics.incurred_material_cost + 
              (petty?.reduce((acc, p) => acc + Number(p.amount || 0), 0) || 0)
            )}
          </div>
        </div>
      </div>

      {/* Material Cost Table */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden mt-6">
        <div className="border-b border-border bg-orange-50/50 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-orange-900">1. تكلفة الخامات المستهلكة (من المخازن الأساسية)</h2>
            <p className="text-sm text-orange-700/80 mt-1">المواد والأصناف التي تم سحبها فعلياً عبر أذون الصرف المعتمدة</p>
          </div>
          <span className="bg-orange-600 text-white font-bold py-1 px-4 rounded-lg shadow-sm" dir="ltr">
            {formatCurrency(materialLines.reduce((acc, curr) => acc + Number(curr.cost || 0), 0))}
          </span>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-background-secondary sticky top-0 z-10 shadow-sm">
              <tr className="text-right">
                <th className="px-6 py-3 font-semibold text-text-secondary">رقم الإذن</th>
                <th className="px-6 py-3 font-semibold text-text-secondary">التاريخ</th>
                <th className="px-6 py-3 font-semibold text-text-secondary">كود الصنف</th>
                <th className="px-6 py-3 font-semibold text-text-secondary">اسم البند</th>
                <th className="px-6 py-3 font-semibold text-text-secondary">الكمية</th>
                <th className="px-6 py-3 font-semibold text-text-secondary">التكلفة</th>
              </tr>
            </thead>
            <tbody>
              {materialLines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-secondary bg-gray-50/30">
                    لا يوجد خامات مستهلكة من مخزن المشروع حتى الآن.
                  </td>
                </tr>
              ) : (
                materialLines.map((ml: any, idx: number) => (
                  <tr key={idx} className="border-b border-border/40 hover:bg-orange-50/30 transition-colors">
                    <td className="px-6 py-3 font-medium text-primary" dir="ltr">{ml.issue_doc}</td>
                    <td className="px-6 py-3">{ml.date}</td>
                    <td className="px-6 py-3 font-mono text-xs">{ml.item?.item_code}</td>
                    <td className="px-6 py-3 font-medium">{ml.item?.arabic_name}</td>
                    <td className="px-6 py-3" dir="ltr">{Number(ml.qty).toLocaleString()} {ml.unit?.arabic_name}</td>
                    <td className="px-6 py-3 font-bold text-orange-700" dir="ltr">{formatCurrency(Number(ml.cost))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Subcontractors Table */}
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="border-b border-border bg-indigo-50/50 px-6 py-4 flex items-center justify-between">
             <h2 className="text-lg font-bold text-indigo-900">2. مستخلصات مقاولي الباطن</h2>
             <span className="font-bold text-indigo-700" dir="ltr">{formatCurrency(subcontractorCertificates?.reduce((acc, c) => acc + Number(c.net_amount || 0), 0) || 0)}</span>
          </div>
          <div className="flex-1 max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-background-secondary sticky top-0 z-10 shadow-sm">
                <tr className="text-right">
                  <th className="px-5 py-3 font-semibold text-text-secondary">المستخلص</th>
                  <th className="px-5 py-3 font-semibold text-text-secondary">المقاول</th>
                  <th className="px-5 py-3 font-semibold text-text-secondary">التكلفة الصافية</th>
                </tr>
              </thead>
              <tbody>
                {subcontractorCertificates?.map(c => {
                  const sub = Array.isArray(c.agreement) ? c.agreement[0] : c.agreement
                  const subcontractorName = (Array.isArray(sub?.subcontractor) ? sub.subcontractor[0] : sub?.subcontractor)?.arabic_name || '-'
                  return (
                    <tr key={c.id} className="border-b border-border/40 hover:bg-indigo-50/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-primary" dir="ltr">{c.document_no}</td>
                      <td className="px-5 py-3">{subcontractorName}</td>
                      <td className="px-5 py-3 font-bold text-indigo-700" dir="ltr">{formatCurrency(Number(c.net_amount))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Petty Expenses Table */}
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="border-b border-border bg-sky-50/40 px-6 py-4 flex items-center justify-between">
             <h2 className="text-lg font-bold text-sky-900">3. المصروفات والنثريات اليومية</h2>
             <span className="font-bold text-sky-700" dir="ltr">{formatCurrency(petty?.reduce((acc, p) => acc + Number(p.amount || 0), 0) || 0)}</span>
          </div>
          <div className="flex-1 max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-background-secondary sticky top-0 z-10 shadow-sm">
                <tr className="text-right">
                  <th className="px-5 py-3 font-semibold text-text-secondary">التاريخ</th>
                  <th className="px-5 py-3 font-semibold text-text-secondary">البند</th>
                  <th className="px-5 py-3 font-semibold text-text-secondary">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {petty?.map(p => {
                  const cat = Array.isArray(p.category) ? p.category[0] : p.category
                  return (
                    <tr key={p.id} className="border-b border-border/40 hover:bg-sky-50/30 transition-colors">
                      <td className="px-5 py-3">{p.expense_date}</td>
                      <td className="px-5 py-3">{cat?.arabic_name || p.description}</td>
                      <td className="px-5 py-3 font-bold text-sky-700" dir="ltr">{formatCurrency(Number(p.amount))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  )
}
