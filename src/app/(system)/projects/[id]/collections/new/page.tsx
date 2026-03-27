'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { recordOwnerCollection } from '@/actions/owner_billing'
import DatePicker from '@/components/DatePicker'

export default function NewOwnerCollection({ params }: { params: { id: string } }) {
  const router = useRouter()
  
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null)
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    received_amount: 0,
    received_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    reference_no: '',
    notes: '',
    owner_billing_document_id: ''
  })

  useEffect(() => {
    async function loadData() {
      const db = createClient()
      
      // 1. Get Project Owner
      const { data: project } = await db.from('projects').select('owner_party_id').eq('id', params.id).single()
      if (project?.owner_party_id) {
        setProjectOwnerId(project.owner_party_id)
      } else {
        setError('لا يوجد مالك مرتبط بالمشروع، لا يمكن إتمام التحصيل.')
      }

      // 2. Get Open/Approved Invoices (to link payment)
      const { data: invoices } = await db.from('owner_billing_documents')
        .select('id, document_no, net_amount')
        .eq('project_id', params.id)
        .in('status', ['approved', 'submitted'])

      setUnpaidInvoices(invoices || [])
      setLoading(false)
    }
    
    loadData()
  }, [params.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!projectOwnerId) return
    if (formData.received_amount <= 0) {
      setError('يجب أن يكون مبلغ التحصيل أكبر من صفر.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await recordOwnerCollection({
        project_id: params.id,
        owner_party_id: projectOwnerId,
        owner_billing_document_id: formData.owner_billing_document_id || undefined,
        received_amount: formData.received_amount,
        received_date: formData.received_date,
        payment_method: formData.payment_method,
        reference_no: formData.reference_no,
        notes: formData.notes
      })
      router.push(`/projects/${params.id}/collections`)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ التحصيل')
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-text-secondary">جاري التحميل...</div>

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <Link href={`/projects/${params.id}/collections`} className="hover:text-primary transition-colors">التحصيلات</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">تسجيل تحصيل جديد</span>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">إثبات تحصيل نقدي أو بنكي (Record Collection)</h1>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-6 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="flex flex-col gap-1.5 focus-within:text-primary">
              <label className="text-sm font-medium text-text-primary">مبلغ التحصيل <span className="text-danger">*</span></label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.received_amount}
                onChange={e => setFormData({ ...formData, received_amount: Number(e.target.value) })}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary transition-colors text-right font-bold text-success"
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">تاريخ التحصيل <span className="text-danger">*</span></label>
              <DatePicker
                value={formData.received_date}
                onChange={val => setFormData({ ...formData, received_date: val })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5 focus-within:text-primary">
              <label className="text-sm font-medium text-text-primary">طريقة السداد <span className="text-danger">*</span></label>
              <select
                required
                value={formData.payment_method}
                onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
              >
                <option value="bank_transfer">حوالة بنكية</option>
                <option value="cheque">شيك بنكي</option>
                <option value="cash">نقدي (كاش)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 focus-within:text-primary">
              <label className="text-sm font-medium text-text-primary">رقم المرجع (رقم الحوالة أو الشيك)</label>
              <input
                type="text"
                value={formData.reference_no}
                onChange={e => setFormData({ ...formData, reference_no: e.target.value })}
                placeholder="TRX-123456"
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                dir="ltr"
              />
            </div>
          </div>

          <hr className="border-border" />

          <div className="flex flex-col gap-1.5 focus-within:text-primary">
            <label className="text-sm font-medium text-text-primary">تخصيص التحصيل (ربط بفاتورة مالك معينة)</label>
            <select
              value={formData.owner_billing_document_id}
              onChange={e => setFormData({ ...formData, owner_billing_document_id: e.target.value })}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
            >
              <option value="">-- تحصيل دفعات مقدمة (لا يرتبط بفاتورة حاليا) --</option>
              {unpaidInvoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.document_no} - (الصافي المستحق: {inv.net_amount.toLocaleString()} د.ع)
                </option>
              ))}
            </select>
            <p className="text-xs text-text-secondary mt-1">تجاهل الربط المباشر إذا كانت الدفعة دفعة مقدمة عامة للمشروع.</p>
          </div>

          <div className="flex flex-col gap-1.5 focus-within:text-primary">
            <label className="text-sm font-medium text-text-primary">ملاحظات إضافية</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
            <Link
              href={`/projects/${params.id}/collections`}
              className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
            >
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={saving || !projectOwnerId}
              className="rounded-lg bg-success px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-success/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'جارٍ الحفظ...' : 'إثبات التسجيل في الدفاتر'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
