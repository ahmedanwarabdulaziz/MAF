import Link from 'next/link'
import { getTreasuryExecutionQueue } from '@/actions/payments'
import { getTreasuryAccounts } from '@/actions/treasury'
import { requirePermission } from '@/lib/auth'
import ExecutePaymentDialog from './ExecutePaymentDialog'

export const metadata = {
  title: 'قائمة انتظار تنفيذ المدفوعات | النظام المالي'
}

export default async function TreasuryExecutionQueuePage() {
  await requirePermission('treasury', 'review') // Only treasury or finance reviewers can execute

  const [vouchers, accounts] = await Promise.all([
    getTreasuryExecutionQueue(),
    getTreasuryAccounts() // Load company + project accounts to allow fallback adjustments
  ])

  // Count metrics
  const totalPendingVouchers = vouchers.length
  const totalAmountPending = vouchers.reduce((sum, v) => sum + Number(v.total_amount), 0)

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/company/treasury" className="text-text-tertiary hover:text-primary transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-navy">قائمة انتظار تنفيذ المدفوعات</h1>
          </div>
          <p className="mt-1 text-sm text-text-secondary pr-8">
            أوامر الدفع المعتمدة بانتظار التحويل البنكي أو الصرف النقدي الفعلي من قبل أمين الخزينة.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-border p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase mb-1">أوامر معلقة</p>
            <p className="text-2xl font-black text-navy">{totalPendingVouchers}</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center text-xl">
             ⏳
          </div>
        </div>
        <div className="bg-white border border-border p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase mb-1">إجمالي المبالغ المعلقة</p>
            <p className="text-2xl font-black text-danger dir-ltr">{totalAmountPending.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</p>
          </div>
          <div className="w-12 h-12 bg-danger/10 text-danger rounded-full flex items-center justify-center text-xl">
             💸
          </div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        {vouchers.length === 0 ? (
           <div className="p-12 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-background-secondary rounded-full flex items-center justify-center text-4xl mb-4 opacity-50">✨</div>
              <h3 className="text-lg font-bold text-navy">القائمة فارغة</h3>
              <p className="text-sm text-text-secondary mt-1">لا توجد أوامر دفع معلقة بانتظار التنفيذ.</p>
           </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm whitespace-nowrap">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                   <th className="px-4 py-3 font-semibold text-text-secondary w-16">رقم السند</th>
                   <th className="px-4 py-3 font-semibold text-text-secondary">المشروع / الإدارة</th>
                   <th className="px-4 py-3 font-semibold text-text-secondary">الجهة المستفيدة</th>
                   <th className="px-4 py-3 font-semibold text-text-secondary">الخزينة المبدئية</th>
                   <th className="px-4 py-3 font-semibold text-text-secondary">طريقة الدفع</th>
                   <th className="px-4 py-3 font-semibold text-text-secondary text-left">المبلغ المطلوب</th>
                   <th className="px-4 py-3 font-semibold text-text-secondary">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vouchers.map(v => {
                  const partyRecord = v.parties ? (Array.isArray(v.parties) ? v.parties[0] : v.parties) : null
                  return (
                    <tr key={v.id} className="hover:bg-black/5 transition-colors">
                      <td className="px-4 py-4 truncate">
                        <Link href={v.project_id ? `/projects/${v.project_id}/payments` : '#'} className="font-mono text-primary font-bold hover:underline">
                           {v.voucher_no}
                        </Link>
                        <div className="text-[10px] text-text-secondary mt-1">{v.payment_date}</div>
                      </td>
                      <td className="px-4 py-4">
                         <span className="font-semibold text-navy">{v.project?.arabic_name || 'إدارة عامة'}</span>
                         <div className="text-[10px] text-text-secondary mt-0.5">طلب بواسطة: {v.created_by_user?.display_name || '-'}</div>
                      </td>
                      <td className="px-4 py-4 font-medium text-text-primary">
                         {partyRecord?.party?.arabic_name || 'غير معروف'}
                      </td>
                      <td className="px-4 py-4 text-text-secondary">
                         {v.financial_account?.arabic_name || 'لم يحدد'}
                      </td>
                      <td className="px-4 py-4">
                         {v.payment_method === 'cash' ? 'نقدي' : v.payment_method === 'bank_transfer' ? 'تحويل بنكي' : v.payment_method === 'cheque' ? 'شيك' : 'أخرى'}
                      </td>
                      <td className="px-4 py-4 text-left font-black text-navy dir-ltr">
                         {Number(v.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 w-32">
                         <ExecutePaymentDialog voucher={v} accounts={accounts} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
