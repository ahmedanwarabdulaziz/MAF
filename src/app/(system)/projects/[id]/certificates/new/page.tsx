'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSubcontractAgreements } from '@/actions/agreements'
import { createDraftCertificate, getNextCertificateCode, getLastSubcontractorCertEndDate } from '@/actions/certificates'
import DatePicker from '@/components/DatePicker'

export default function NewCertificatePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  
  const [agreements, setAgreements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    subcontract_agreement_id: '',
    certificate_no: '',
    certificate_date: new Date().toISOString().split('T')[0],
    period_from: '',
    period_to: '',
    notes: ''
  })
  const [lastEndDate, setLastEndDate] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const aggs = await getSubcontractAgreements(params.id)
        // Only active/draft agreements can have certificates logically, but we show all for now
        setAgreements(aggs || [])
      } catch (err: any) {
        setError('خطأ في تحميل العقود: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [params.id])

  useEffect(() => {
    async function loadConfig() {
      if (!formData.subcontract_agreement_id) {
        setFormData(prev => ({ ...prev, certificate_no: '' }))
        setLastEndDate(null)
        return
      }
      try {
        const nextCode = await getNextCertificateCode(formData.subcontract_agreement_id)
        setFormData(prev => ({ ...prev, certificate_no: nextCode }))

        const selectedAgg = agreements.find(a => a.id === formData.subcontract_agreement_id)
        if (selectedAgg) {
          const lastEnd = await getLastSubcontractorCertEndDate(params.id, selectedAgg.subcontractor_party_id)
          setLastEndDate(lastEnd)
          if (lastEnd) {
             const nextDay = new Date(lastEnd)
             nextDay.setDate(nextDay.getDate() + 1)
             setFormData(prev => ({ ...prev, period_from: nextDay.toISOString().split('T')[0] }))
          }
        }
      } catch (err) {
        console.error(err)
      }
    }
    loadConfig()
  }, [formData.subcontract_agreement_id, agreements, params.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (formData.period_from && formData.period_to) {
      if (formData.period_from > formData.period_to) {
        setError('تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.')
        return
      }
    }

    if (formData.period_from && lastEndDate) {
      if (new Date(formData.period_from) <= new Date(lastEndDate)) {
        setError(`تاريخ البداية يتداخل مع المستخلص السابق الذي ينتهي في ${lastEndDate}. يجب أن يبدأ بعده.`)
        return
      }
    }

    setSaving(true)
    setError(null)

    try {
      const selectedAgg = agreements.find(a => a.id === formData.subcontract_agreement_id)
      if (!selectedAgg) throw new Error('يرجى اختيار العقد')

      const result = await createDraftCertificate({
        project_id: params.id,
        subcontractor_party_id: selectedAgg.subcontractor_party_id,
        subcontract_agreement_id: formData.subcontract_agreement_id,
        certificate_no: formData.certificate_no,
        certificate_date: formData.certificate_date,
        period_from: formData.period_from || undefined,
        period_to: formData.period_to || undefined,
        notes: formData.notes
      })
      
      router.push(`/projects/${params.id}/certificates/${result.id}`)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء المستخلص')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <Link href={`/projects/${params.id}/certificates`} className="hover:text-primary transition-colors">مستخلصات مقاولي الباطن</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">مستخلص جديد</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">إنشاء مستخلص جديد (Draft)</h1>
        <p className="mt-1 text-sm text-text-secondary">
          حدّد العقد ورقم المستخلص والفترة الزمنية المشمولة لبدء إدخال الكميات المنفذة.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-6 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-text-secondary">جاري تحميل البيانات...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-sm font-medium text-text-primary">عقد مقاول الباطن المرجعي <span className="text-danger">*</span></label>
                <select
                  required
                  value={formData.subcontract_agreement_id}
                  onChange={e => setFormData({ ...formData, subcontract_agreement_id: e.target.value })}
                  className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="" disabled>اختر العقد...</option>
                  {agreements.map(ag => (
                    <option key={ag.id} value={ag.id}>
                      {ag.agreement_code} - {ag.subcontractor?.arabic_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-text-tertiary">سيتم جلب فئات وأسعار هذا العقد تلقائياً داخل المستخلص.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">رقم المستخلص الدفتري <span className="text-danger">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.certificate_no}
                  onChange={e => setFormData({ ...formData, certificate_no: e.target.value })}
                  placeholder="سيتم توليده تلقائياً (يمكن تعديله)..."
                  className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-bold text-primary tracking-widest outline-none focus:border-primary"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">تاريخ الإصدار <span className="text-danger">*</span></label>
                <DatePicker
                  value={formData.certificate_date}
                  onChange={val => setFormData({ ...formData, certificate_date: val })}
                />
              </div>

              <div className="flex flex-col gap-1.5 border-t border-border pt-4 md:col-span-2">
                <h3 className="text-sm font-bold text-text-secondary mb-2">الفترة الزمنية للأعمال المنجزة <span className="text-danger">*</span></h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 z-10">
                  <div className="flex flex-col gap-1.5 z-20">
                    <label className="text-sm font-medium text-text-primary">من تاريخ <span className="text-danger">*</span></label>
                    <DatePicker
                      required
                      value={formData.period_from}
                      onChange={val => setFormData({ ...formData, period_from: val })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 z-10">
                    <label className="text-sm font-medium text-text-primary">إلى تاريخ <span className="text-danger">*</span></label>
                    <DatePicker
                      required
                      value={formData.period_to}
                      onChange={val => setFormData({ ...formData, period_to: val })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-sm font-medium text-text-primary">ملاحظات المستخلص</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="أي ملاحظات عامة..."
                  className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3 border-t border-border pt-6">
              <Link
                href={`/projects/${params.id}/certificates`}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
              >
                إلغاء
              </Link>
              <button
                type="submit"
                disabled={saving || !formData.subcontract_agreement_id}
                className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'جارٍ الإنشاء...' : 'إنشاء المستخلص والمتابعة'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
