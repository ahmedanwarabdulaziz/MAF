'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSubcontractAgreement, updateSubcontractAgreement } from '@/actions/agreements'
import { createClient } from '@/lib/supabase'
import DatePicker from '@/components/DatePicker'

import { notFound } from 'next/navigation'

export default function AgreementDetailsPage({ params }: { params: { id: string, ag_id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  
  const [agreement, setAgreement] = useState<any>(null)
  // Header form state
  const [headerData, setHeaderData] = useState<any>({})

  useEffect(() => {
    const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(params.ag_id);
    if (!params.ag_id || !isUUID) {
      setError('معرف العقد غير صالح');
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const ag = await getSubcontractAgreement(params.ag_id)
        
        setAgreement(ag)
        setHeaderData({
          status: ag.status,
          default_taaliya_type: ag.default_taaliya_type,
          default_taaliya_value: Number(ag.default_taaliya_value),
          start_date: ag.start_date || '',
          end_date: ag.end_date || '',
          notes: ag.notes || ''
        })
      } catch (err: any) {
        setError('خطأ في تحميل تفاصيل العقد: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.ag_id, params.id])

  async function handleUpdateHeader(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await updateSubcontractAgreement(params.ag_id, params.id, headerData)
      setSuccessMsg('تم تحديث بيانات العقد بنجاح. جاري العودة...')
      setTimeout(() => {
        router.push(`/projects/${params.id}/agreements`)
      }, 1500)
    } catch (err: any) {
      setError('خطأ في حفظ العقد: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // No lines logic anymore

  if (loading) return <div className="text-sm text-text-secondary">جاري تحميل العقد...</div>
  if (!agreement) return <div className="text-sm text-danger">العقد غير موجود أو لا تملك صلاحية</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <Link href={`/projects/${params.id}/agreements`} className="hover:text-primary transition-colors">عقود مقاولي الباطن</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">{agreement.agreement_code}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            عقد مقاول: {agreement.subcontractor?.arabic_name || 'غير معروف'}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            إدارة بيانات العقد وتحديد الفئات (الأسعار) للبنود المتفق عليها.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
          {successMsg}
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-text-primary mb-4 border-b border-border pb-2">بيانات العقد الأساسية</h2>
        
        <form onSubmit={handleUpdateHeader} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">رقم العقد</label>
            <input type="text" disabled value={agreement.agreement_code} className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm text-text-tertiary cursor-not-allowed" dir="ltr" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">حالة العقد</label>
            <select
              value={headerData.status}
              onChange={e => setHeaderData({ ...headerData, status: e.target.value })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="draft">مسودة (Draft)</option>
              <option value="active">ساري (Active)</option>
              <option value="suspended">موقوف (Suspended)</option>
              <option value="closed">مغلق (Closed)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">نوع التعلية (الاستقطاع) الافتراضي</label>
            <select
              value={headerData.default_taaliya_type}
              onChange={e => setHeaderData({ ...headerData, default_taaliya_type: e.target.value })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="percentage">نسبة مئوية (%)</option>
              <option value="fixed_amount">مبلغ ثابت</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">قيمة التعلية</label>
            <input
              type="number"
              step="0.01"
              value={headerData.default_taaliya_value}
              onChange={e => setHeaderData({ ...headerData, default_taaliya_value: Number(e.target.value) })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">تاريخ البدء</label>
            <DatePicker
              value={headerData.start_date}
              onChange={val => setHeaderData({ ...headerData, start_date: val })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">تاريخ الانتهاء</label>
            <DatePicker
              value={headerData.end_date}
              onChange={val => setHeaderData({ ...headerData, end_date: val })}
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-3">
            <label className="text-sm font-medium text-text-primary">ملاحظات عامة</label>
            <textarea
              rows={2}
              value={headerData.notes}
              onChange={e => setHeaderData({ ...headerData, notes: e.target.value })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-background-secondary border border-border px-6 py-2 text-sm font-semibold text-text-primary hover:bg-border/50 transition-colors disabled:opacity-50"
            >
              حفظ التعديلات الأساسية
            </button>
          </div>
        </form>
      </div>

      {/* LINES SECTION REMOVED */}
    </div>
  )
}
