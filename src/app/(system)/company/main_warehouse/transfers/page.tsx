import { createClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/auth'
import Link from 'next/link'

export default async function TransfersPage() {
  await requirePermission('main_warehouse', 'view')
  const supabase = createClient()

  const { data: transfers } = await supabase
    .from('warehouse_transfers')
    .select(`
      id, document_no, transfer_date, status,
      source:source_warehouse_id(arabic_name),
      destination:destination_warehouse_id(arabic_name)
    `)
    .order('transfer_date', { ascending: false })
    .order('document_no', { ascending: false })
    .limit(50)

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">أذون التحويل المخزني</h1>
          <p className="mt-1 text-sm text-text-secondary">
            متابعة تحويلات المخزون من وإلى المخزن الرئيسي ومخازن المشاريع
          </p>
        </div>
        <Link
          href="/company/main_warehouse/transfers/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          + إضافة إذن تحويل
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-secondary text-right">
              <th className="px-6 py-3 font-semibold text-text-secondary">رقم الإذن المستندي</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">التاريخ</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">من (المرسل)</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">إلى (المستلم)</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {!transfers?.length && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-text-secondary">
                  لا توجد أذون تحويل بعد.
                </td>
              </tr>
            )}
            {transfers?.map(t => {
              const src = Array.isArray(t.source) ? t.source[0] : t.source
              const dst = Array.isArray(t.destination) ? t.destination[0] : t.destination
              
              return (
                <tr key={t.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-primary" dir="ltr">{t.document_no}</td>
                  <td className="px-6 py-4 text-text-secondary">{t.transfer_date}</td>
                  <td className="px-6 py-4 font-medium">{src?.arabic_name || '-'}</td>
                  <td className="px-6 py-4 font-medium">{dst?.arabic_name || '-'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        t.status === 'confirmed'
                          ? 'bg-success/10 text-success'
                          : t.status === 'draft'
                          ? 'bg-secondary/10 text-secondary'
                          : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {t.status === 'confirmed' ? 'معتمد' : t.status === 'draft' ? 'مسودة' : 'ملغي'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
