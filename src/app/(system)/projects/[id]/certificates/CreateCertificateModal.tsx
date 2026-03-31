'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createDraftCertificate, getNextCertificateCode, getSubcontractorCertificateStatus } from '@/actions/certificates'
import DatePicker from '@/components/DatePicker'

interface CreateCertificateModalProps {
  projectId: string
  agreements: any[]
}

export default function CreateCertificateModal({ projectId, agreements }: CreateCertificateModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
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
  const [hasPending, setHasPending] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)

  const openModal = () => {
    setFormData({
      subcontract_agreement_id: '',
      certificate_no: '',
      certificate_date: new Date().toISOString().split('T')[0],
      period_from: '',
      period_to: '',
      notes: ''
    })
    setLastEndDate(null)
    setHasPending(false)
    setPendingMessage(null)
    setError(null)
    setIsOpen(true)
  }

  const closeModal = () => setIsOpen(false)

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
          const status = await getSubcontractorCertificateStatus(projectId, selectedAgg.subcontractor_party_id, selectedAgg.id)
          setLastEndDate(status.lastEndDate)
          setHasPending(Boolean(status.hasPending))
          
          if (status.hasPending) {
            setPendingMessage(`عذراً، يوجد مستخلص ${status.pendingStatus === 'draft' ? 'كمسودة' : 'بانتظار الاعتماد'} لهذا المقاول (رقم ${status.pendingNo}). يجب اعتماده أو حذفه أولاً.`)
          } else {
            setPendingMessage(null)
          }

          if (status.lastEndDate) {
             const nextDay = new Date(status.lastEndDate)
             nextDay.setDate(nextDay.getDate() + 1)
             setFormData(prev => ({ ...prev, period_from: nextDay.toISOString().split('T')[0] }))
          } else {
             setFormData(prev => ({ ...prev, period_from: '' }))
          }
        }
      } catch (err) {
        console.error(err)
      }
    }
    loadConfig()
  }, [formData.subcontract_agreement_id, agreements, projectId])

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
        project_id: projectId,
        subcontractor_party_id: selectedAgg.subcontractor_party_id,
        subcontract_agreement_id: formData.subcontract_agreement_id,
        certificate_no: formData.certificate_no,
        certificate_date: formData.certificate_date,
        period_from: formData.period_from || undefined,
        period_to: formData.period_to || undefined,
        notes: formData.notes
      })
      
      closeModal()
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء المستخلص')
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
      >
        + مستخلص جديد
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div 
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]"
            style={{ animation: 'selectDropdown 0.2s cubic-bezier(0.16,1,0.3,1) both' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-background-secondary/50 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-text-primary">إنشاء مستخلص جديد (Draft)</h3>
                <p className="text-xs text-text-secondary mt-0.5">حدّد العقد ورقم المستخلص والفترة الزمنية المشمولة.</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-1.5 text-text-secondary hover:bg-border/50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-white relative overflow-visible z-20">
              <form id="createCertForm" onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {error}
                  </div>
                )}
                {pendingMessage && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 mt-2 font-medium">
                    {pendingMessage}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text-primary">رقم المستخلص الدفتري <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.certificate_no}
                      onChange={e => setFormData({ ...formData, certificate_no: e.target.value })}
                      placeholder="سيتم توليده تلقائياً..."
                      className="rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm font-bold text-navy tracking-widest outline-none focus:border-primary cursor-not-allowed"
                      dir="ltr"
                      readOnly
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 z-30">
                    <label className="text-sm font-medium text-text-primary">تاريخ الإصدار <span className="text-danger">*</span></label>
                    <DatePicker
                      required
                      value={formData.certificate_date}
                      onChange={val => setFormData({ ...formData, certificate_date: val })}
                    />
                  </div>
                </div>

                <div className="border border-border rounded-lg p-4 bg-background-secondary/30">
                  <h4 className="text-sm font-bold text-text-primary mb-3">فترة الحصر</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 z-20">
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

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-primary">ملاحظات المستخلص</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="أي ملاحظات عامة..."
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                  />
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border bg-background-secondary/50 px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-white hover:text-text-primary transition-colors border border-transparent hover:border-border hover:shadow-sm"
                disabled={saving}
              >
                إلغاء
              </button>
              <button
                type="submit"
                form="createCertForm"
                disabled={saving || !formData.subcontract_agreement_id || hasPending}
                className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'جارٍ الإنشاء...' : 'إنشاء المستخلص والمتابعة'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
