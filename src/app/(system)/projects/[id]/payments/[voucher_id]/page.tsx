import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'

export const metadata = {
  title: 'تفاصيل السند | نظام إدارة المقاولات'
}

export default async function PaymentVoucherDetailPage({ params }: { params: { id: string, voucher_id: string } }) {
  const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(params.voucher_id);
  if (!params.voucher_id || !isUUID) notFound();

  const supabase = createClient()
  
  const { data: voucher, error } = await supabase
    .from('payment_vouchers')
    .select(`
      *,
      financial_account:financial_account_id(arabic_name, currency),
      created_by_user:users(display_name),
      parties:payment_voucher_parties(
        id,
        paid_amount,
        party:party_id(arabic_name),
        allocations:payment_allocations(
            id,
            allocated_amount,
            source_entity_type,
            source_entity_id,
            supplier_invoices(invoice_no, invoice_date),
            subcontractor_certificates(certificate_no, certificate_date)
        )
      )
    `)
    .eq('id', params.voucher_id)
    .single()

  if (error || !voucher) notFound()

  const partyRecord = Array.isArray(voucher.parties) ? voucher.parties[0] : voucher.parties
  const allocations = partyRecord?.allocations || []

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
        <Link href={`/projects/${params.id}/payments`} className="hover:text-primary">سجلات الدفع</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">سند رقم {voucher.voucher_no}</span>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-xl border border-border bg-white shadow-sm p-6">
        <div>
            <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-navy" dir="ltr">{voucher.voucher_no}</h1>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    voucher.status === 'posted' ? 'bg-success/10 text-success-dark' : 'bg-text-tertiary/10 text-text-secondary'
                }`}>
                    {voucher.status === 'posted' ? 'ترحيل محقق' : voucher.status}
                </span>
            </div>
            <p className="mt-1 text-sm text-text-secondary">تم الإصدار في {voucher.payment_date} بواسطة {voucher.created_by_user?.display_name || 'النظام'}</p>
        </div>
        <div className="text-left">
            <p className="text-xs font-bold text-text-secondary uppercase mb-1">المبلغ الإجمالي</p>
            <p className="text-3xl font-bold text-navy" dir="ltr">
                {Number(voucher.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {voucher.financial_account?.currency || 'EGP'}
            </p>
        </div>
      </div>

      {/* Details Grid */}
      <div className="rounded-xl border border-border bg-white shadow-sm p-6 overflow-hidden">
        <h2 className="text-lg font-bold text-navy border-b border-border pb-3 mb-4">بيانات السند</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
            <div>
                <span className="block text-xs text-text-secondary mb-1">الطرف المستفيد</span>
                <span className="font-bold text-primary">{partyRecord?.party?.arabic_name || 'مجهول'}</span>
            </div>
            <div>
                <span className="block text-xs text-text-secondary mb-1">جهة الصرف (الخزينة)</span>
                <span className="font-medium text-text-primary">{voucher.financial_account?.arabic_name || '-'}</span>
            </div>
            <div>
                <span className="block text-xs text-text-secondary mb-1">طريقة الدفع</span>
                <span className="font-medium text-text-primary">
                    {voucher.payment_method === 'cash' ? 'نقداً' : voucher.payment_method === 'cheque' ? 'شيك' : voucher.payment_method === 'bank_transfer' ? 'تحويل' : voucher.payment_method}
                </span>
            </div>
            <div>
                <span className="block text-xs text-text-secondary mb-1">المرجع</span>
                <span className="font-medium text-text-primary" dir="ltr">{voucher.receipt_reference_no || '-'}</span>
            </div>
            <div className="md:col-span-2 bg-background-secondary/50 rounded p-4 text-sm mt-2">
                <span className="block text-xs text-text-secondary mb-1">ملاحظات والتفاصيل</span>
                <span className="text-text-primary">{voucher.notes || 'لايوجد'}</span>
            </div>
        </div>
      </div>

      {/* Allocations Table */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="border-b border-border bg-background-secondary/50 px-6 py-4">
            <h2 className="text-lg font-bold text-navy">التوجيه المستندي والمطالبات التي تم إغلاقها</h2>
        </div>
        
        {allocations.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-secondary">دفعة مقدمة غير موجهة لمطالبة معينة.</div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                    <thead className="bg-background-secondary border-b border-border">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-text-secondary">البيان</th>
                            <th className="px-6 py-4 font-semibold text-text-secondary">التاريخ</th>
                            <th className="px-6 py-4 font-semibold text-text-secondary">المبلغ المخصوم</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {allocations.map((alloc: any) => {
                            const label = alloc.source_entity_type === 'supplier_invoice' 
                                            ? `فاتورة توريد #${alloc.supplier_invoices?.invoice_no}`
                                            : `مستخلص أعمال #${alloc.subcontractor_certificates?.certificate_no}`
                            const docDate = alloc.source_entity_type === 'supplier_invoice'
                                            ? alloc.supplier_invoices?.invoice_date
                                            : alloc.subcontractor_certificates?.certificate_date
                            
                            return (
                                <tr key={alloc.id} className="hover:bg-black/5 transition-colors">
                                    <td className="px-6 py-4 font-medium text-text-primary">{label}</td>
                                    <td className="px-6 py-4 text-text-secondary" dir="ltr">{docDate || '-'}</td>
                                    <td className="px-6 py-4 font-bold text-danger" dir="ltr">
                                        -{Number(alloc.allocated_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                    <tfoot className="bg-background border-t border-border">
                        <tr>
                            <td colSpan={2} className="px-6 py-4 text-left font-bold text-text-secondary">المجموع المسدد:</td>
                            <td className="px-6 py-4 font-bold text-text-primary" dir="ltr">
                                {allocations.reduce((sum: number, curr: any) => sum + Number(curr.allocated_amount), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {voucher.financial_account?.currency || 'EGP'}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        )}
      </div>

    </div>
  )
}
