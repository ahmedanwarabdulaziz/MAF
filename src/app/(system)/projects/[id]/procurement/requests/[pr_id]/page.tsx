'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getPurchaseRequestDetails, submitPurchaseRequest, approvePurchaseRequest } from '@/actions/procurement'
// import { useAuth } from '@/components/AuthProvider'

export default function PurchaseRequestDetails({ params }: { params: { id: string, pr_id: string } }) {
  const router = useRouter()
  // auth stripped temporarily for linting
  
  const [pr, setPr] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await getPurchaseRequestDetails(params.pr_id)
      setPr(data)
    } catch (err: any) {
      setError('خطأ في تحميل بيانات الطلب: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(actionType: 'submit' | 'approve') {
    if (!confirm(actionType === 'submit' ? 'هل أنت متأكد من تقديم الطلب للاعتماد؟ لا يمكن تعديله بعد ذلك.' : 'تأكيد اعتماد طلب الشراء والموافقة على توفير المواد؟')) return
    
    setSaving(true)
    setError(null)
    
    try {
      if (actionType === 'submit') {
        await submitPurchaseRequest(pr.id, params.id)
      } else {
        await approvePurchaseRequest(pr.id, params.id)
      }
      await load()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تنفيذ الإجراء')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-text-secondary">جاري تحميل بيانات الطلب...</div>
  if (!pr) return <div className="text-sm text-danger">طلب الشراء غير موجود.</div>

  const req = Array.isArray(pr.requester) ? pr.requester[0] : pr.requester
  const proj = Array.isArray(pr.project) ? pr.project[0] : pr.project
  const canApprove = pr.status === 'pending_approval' // scope checked on server

  return (
    <div className="space-y-6 pb-24 mx-auto max-w-5xl">
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <Link href={`/projects/${params.id}/procurement/requests`} className="hover:text-primary transition-colors">طلبات الشراء</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">{pr.request_no}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            طلب شراء رقم: <span className="font-mono text-navy">{pr.request_no}</span>
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            المشروع: {proj?.name} | مُقدم الطلب: {req?.full_name || 'غير محدد'}
          </p>
        </div>
        
        <div className="flex gap-3">
          {pr.status === 'draft' && (
            <button
              onClick={() => handleAction('submit')}
              disabled={saving}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              تقديم الطلب للاعتماد
            </button>
          )}
          {canApprove && (
            <button
              onClick={() => handleAction('approve')}
              disabled={saving}
              className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90 transition-colors disabled:opacity-50"
            >
              اعتماد نهائي (Approve)
            </button>
          )}
          {pr.status === 'approved' && (
            <Link
              href={`/projects/${params.id}/procurement/invoices/new?pr_id=${pr.id}`}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              تحويل الطلب إلى فاتورة مورد
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">تاريخ الطلب</p>
          <p className="text-lg font-bold text-navy dir-ltr text-right">{pr.request_date}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">مطلوب التوريد قبل</p>
          <p className="text-lg font-bold text-amber-700 dir-ltr text-right">{pr.required_by_date || 'غير محدد'}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">الحالة</p>
          <p className={`text-lg font-bold ${
            pr.status === 'approved' ? 'text-success' : 
            pr.status === 'pending_approval' ? 'text-amber-600' :
            pr.status === 'closed' ? 'text-purple-700' : 'text-text-primary'
          }`}>
            {pr.status === 'draft' ? 'مسودة (Draft)' :
             pr.status === 'pending_approval' ? 'بانتظار الاعتماد' :
             pr.status === 'approved' ? 'معتمد' :
             pr.status === 'closed' ? 'مغلق (منفذ)' : pr.status}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">عدد بنود المواد</p>
          <p className="text-xl font-bold text-text-primary dir-ltr text-right">{pr.lines?.length || 0}</p>
        </div>
      </div>

      {pr.notes && (
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-text-secondary mb-2">سبب الطلب / ملاحظات:</h3>
          <p className="text-sm text-text-primary whitespace-pre-line">{pr.notes}</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col pt-2">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">مفردات المواد المطلوبة (PR Lines)</h2>
        </div>
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-background-secondary border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold text-text-secondary"># الكود</th>
                <th className="px-4 py-3 font-semibold text-text-secondary min-w-[200px]">المادة / الصنف</th>
                <th className="px-4 py-3 font-semibold text-text-secondary text-center">الوحدة</th>
                <th className="px-4 py-3 font-semibold text-navy">الكمية المطلوبة</th>
                <th className="px-4 py-3 font-semibold text-text-secondary">سعر تقديري</th>
                <th className="px-4 py-3 font-semibold text-text-secondary">ملاحظات البند</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pr.lines?.map((line: any, idx: number) => {
                const item = Array.isArray(line.item) ? line.item[0] : line.item
                const unit = item?.unit ? (Array.isArray(item.unit) ? item.unit[0] : item.unit) : null
                
                return (
                 <tr key={idx} className="hover:bg-background-secondary/30 transition-colors">
                    <td className="px-4 py-4 font-medium text-text-secondary">{item?.item_code || '---'}</td>
                    <td className="px-4 py-4 whitespace-normal min-w-[200px] text-text-primary font-medium">{item?.arabic_name || '---'}</td>
                    <td className="px-4 py-4 text-center text-text-tertiary">{unit?.arabic_name || '---'}</td>
                    <td className="px-4 py-4 font-bold text-navy text-lg dir-ltr text-right">{Number(line.requested_quantity).toLocaleString()}</td>
                    <td className="px-4 py-4 text-text-secondary dir-ltr text-right">
                      {Number(line.estimated_unit_price) > 0 ? `${Number(line.estimated_unit_price).toLocaleString()} ج.م` : '---'}
                    </td>
                    <td className="px-4 py-4 text-text-secondary whitespace-normal min-w-[150px]">{line.notes || '---'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
