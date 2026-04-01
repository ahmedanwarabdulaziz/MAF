'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCertificateHeader } from '@/actions/certificates'
import DatePicker from '@/components/DatePicker'

export default function EditCertificateDialog({
  certificate,
  projectId,
}: {
  certificate: any
  projectId: string
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const [form, setForm] = useState({
    certificate_no:   certificate.certificate_no   || '',
    certificate_date: certificate.certificate_date || '',
    period_to:        certificate.period_to        || '',
    notes:            certificate.notes            || '',
  })

  function open() {
    setForm({
      certificate_no:   certificate.certificate_no   || '',
      certificate_date: certificate.certificate_date || '',
      period_to:        certificate.period_to        || '',
      notes:            certificate.notes            || '',
    })
    setError(null)
    setIsOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updateCertificateHeader(certificate.id, projectId, form)
      setIsOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ التعديلات')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={open}
        className="rounded-lg border border-border bg-white px-3 py-1.5 text-text-secondary hover:bg-background-secondary hover:text-primary transition-colors flex items-center gap-1.5 text-sm font-medium shadow-sm"
        title="تعديل بيانات المستخلص"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
        </svg>
        تعديل
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            style={{ animation: 'selectDropdown 0.2s cubic-bezier(0.16,1,0.3,1) both' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-background-secondary/50 px-5 py-4">
              <h3 className="text-lg font-bold text-text-primary">تعديل بيانات المستخلص</h3>
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-full p-1.5 text-text-secondary hover:bg-border/50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-6 space-y-5">
              {error && (
                <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
              )}

              {/* Certificate No */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">رقم المستخلص <span className="text-danger">*</span></label>
                <input
                  type="text"
                  required
                  value={form.certificate_no}
                  onChange={e => setForm({ ...form, certificate_no: e.target.value })}
                  className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary font-bold text-navy"
                  dir="ltr"
                />
              </div>

              {/* Issue Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">تاريخ الإصدار</label>
                <DatePicker value={form.certificate_date} onChange={val => setForm({ ...form, certificate_date: val })} />
              </div>

              {/* period_from: read-only, derived from agreement */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-text-secondary">من تاريخ (تلقائي من العقد)</label>
                <p className="rounded-lg border border-border bg-background-secondary/50 px-3 py-2 text-sm text-text-secondary dir-ltr">
                  {certificate.period_from || '—'}
                </p>
              </div>

              {/* Period To */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">
                  حتى تاريخ (الإغلاق) <span className="text-danger">*</span>
                </label>
                <DatePicker required value={form.period_to} onChange={val => setForm({ ...form, period_to: val })} />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">ملاحظات</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsOpen(false)} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-background-secondary transition-colors">
                  إلغاء
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
