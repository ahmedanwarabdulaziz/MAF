import Link from 'next/link'
import { getSubcontractorStatements } from '@/actions/certificates'

export default async function SubcontractorsStatementPage({ params }: { params: { id: string } }) {
  const statements = await getSubcontractorStatements(params.id)

  const overallGross    = statements.reduce((s, row) => s + Number(row.total_gross    || 0), 0)
  const overallNet      = statements.reduce((s, row) => s + Number(row.total_net_payable || 0), 0)
  const overallTaaliya  = statements.reduce((s, row) => s + Number(row.total_taaliya  || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">مقاولي الباطن (حسابات وختامي)</h1>
          <p className="mt-1 text-sm text-text-secondary">
            موقف مقاولي الباطن المالي، الدفعات المستحقة، والتعليات المحتجزة حتى تاريخه.
          </p>
        </div>
        <div className="flex gap-4 items-center text-left">
          <div className="bg-background-secondary px-4 py-2 rounded-lg">
            <span className="text-xs text-text-secondary mb-1 block">إجمالي تعليات المشروع</span>
            <span className="text-xl font-bold text-amber-600 dir-ltr inline-block">
              {overallTaaliya.toLocaleString()} ج.م
            </span>
          </div>
          <div className="bg-background-secondary px-4 py-2 rounded-lg">
            <span className="text-xs text-text-secondary mb-1 block">إجمالي المنصرف والمسدد</span>
            <span className="text-xl font-black text-navy dir-ltr inline-block">
              {overallNet.toLocaleString()} ج.م
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col pt-2">
        <div className="overflow-x-auto hide-scrollbar">
          {statements.length === 0 ? (
            <div className="py-12 text-center text-text-secondary">
              لم يتم العثور على أي مستخلصات معتمدة لمقاولي الباطن.
            </div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-5 py-4 font-semibold text-text-secondary">اسم المقاول</th>
                  <th className="px-5 py-4 font-semibold text-text-secondary">أعمال منفذة (إجمالي)</th>
                  <th className="px-5 py-4 font-semibold text-text-secondary text-amber-700">تعليات محتجزة</th>
                  <th className="px-5 py-4 font-semibold text-text-secondary text-success">مستحق الصرف (صافي)</th>
                  <th className="px-5 py-4 font-semibold text-text-secondary">المسدد لغاية تاريخه</th>
                  <th className="px-5 py-4 font-semibold text-text-secondary text-danger">الرصيد المتبقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {statements.map((st) => (
                  <tr key={st.subcontractor_party_id} className="hover:bg-background-secondary/40 transition-colors">
                    <td className="px-5 py-4 font-medium text-navy">
                      <Link href={`/projects/${params.id}/agreements`} className="hover:underline">
                        {st.subcontractor_name || 'غير معروف'}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-semibold text-text-primary dir-ltr text-right">
                      {Number(st.total_gross || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 font-semibold text-amber-600 dir-ltr text-right bg-amber-50/20">
                      {Number(st.total_taaliya || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 font-bold text-success dir-ltr text-right">
                      {Number(st.total_net_payable || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-text-secondary dir-ltr text-right">
                      {Number(st.total_paid || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 font-bold text-danger dir-ltr text-right bg-red-50/20">
                      {Number(st.total_outstanding || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
