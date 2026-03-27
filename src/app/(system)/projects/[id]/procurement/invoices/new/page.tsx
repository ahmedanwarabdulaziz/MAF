'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getPurchaseRequestDetails, convertPrToInvoice, getPurchaseRequests } from '@/actions/procurement'
import { peekNextDocumentNoByProject } from '@/actions/sequences'
import DatePicker from '@/components/DatePicker'
import CustomSelect from '@/components/CustomSelect'

export default function NewSupplierInvoice({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPrId = searchParams.get('pr_id')
  
  const [sourcePrId, setSourcePrId] = useState<string | null>(initialPrId)
  const [pr, setPr] = useState<any>(null)
  
  const [approvedPrs, setApprovedPrs] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    supplier_party_id: '',
    invoice_no: 'تلقائي',
    invoice_date: new Date().toISOString().split('T')[0]
  })

  // 1. Fetch Approved PRs if no sourcePrId
  useEffect(() => {
    async function init() {
      try {
        if (!sourcePrId) {
          const prs = await getPurchaseRequests(params.id)
          setApprovedPrs(prs.filter(p => p.status === 'approved'))
          setLoading(false)
          return
        }

        setLoading(true)
        const prData = await getPurchaseRequestDetails(sourcePrId)
        if (prData.status !== 'approved') {
          throw new Error('لا يمكن تحويل هذا الطلب لأنه ليس معتمداً أو تم تحويله مسبقاً.')
        }
        setPr(prData)

        const db = createClient()
        const { data: sups } = await db.from('parties').select('id, arabic_name, party_roles!inner(role_type)').eq('party_roles.role_type', 'supplier').eq('is_active', true)
        setSuppliers(sups || [])

      } catch (err: any) {
        setError('خطأ: ' + err.message)
      } finally {
        setLoading(false)
      }
    }

    async function fetchSeq() {
      try {
        const seq = await peekNextDocumentNoByProject(params.id, 'supplier_invoices', 'INV')
        setFormData(prev => ({ ...prev, invoice_no: seq }))
      } catch (err) {}
    }

    init()
    fetchSeq()
  }, [sourcePrId, params.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (!formData.supplier_party_id) {
      setError('يرجى اختيار المورد')
      setSaving(false)
      return
    }

    try {
      const result = await convertPrToInvoice(sourcePrId!, formData.supplier_party_id, formData.invoice_no, formData.invoice_date)
      router.push(`/projects/${params.id}/procurement/invoices/${result.id}`)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحويل الفاتورة')
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-text-secondary p-6">جاري تحميل البيانات...</div>

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <Link href={`/projects/${params.id}/procurement/invoices`} className="hover:text-primary transition-colors">فواتير الموردين</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">تسجيل فاتورة جديدة من طلب شراء</span>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">إنشاء فاتورة توريد (مرحلة المطابقة)</h1>
      <p className="text-sm text-text-secondary">الخطوة الأولى: تحديد بيانات الفاتورة والمورد لطلب الشراء المعتمد.</p>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger flex justify-between items-center">
          <span>{error}</span>
          {sourcePrId && <button onClick={() => { setError(null); setSourcePrId(null) }} className="underline text-xs">إلغاء واختيار طلب آخر</button>}
        </div>
      )}

      {!sourcePrId && !error && (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm space-y-4 animate-in fade-in duration-300">
          <label className="block text-sm font-medium text-text-primary mb-2">اختر طلب الشراء المعتمد المراد تسجيل فاتورة له <span className="text-danger">*</span></label>
          <CustomSelect
            value={sourcePrId || ''}
            onChange={val => {
              if (val) setSourcePrId(val)
            }}
            options={approvedPrs.map(p => ({ 
              value: p.id, 
              label: `${p.request_no} - بتاريخ ${p.request_date} - ${p.notes ? `(${p.notes})` : ''}` 
            }))}
            placeholder="-- اضغط لاختيار طلب شراء --"
            searchable={true}
          />
          {approvedPrs.length === 0 && (
             <p className="text-xs text-text-secondary mt-2">لا توجد طلبات شراء معتمدة وجاهزة للفوترة في هذا المشروع.</p>
          )}
        </div>
      )}

      {sourcePrId && pr && !error && (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm animate-in fade-in zoom-in-95 duration-300">
          <div className="mb-6 p-4 rounded-lg bg-background-secondary/50 border border-border flex justify-between items-start">
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-2">ربط مع طلب الشراء رقم: <span className="text-navy">{pr.request_no}</span></h3>
              <p className="text-xs text-text-secondary mb-1">تاريخ الطلب: {pr.request_date}</p>
              <p className="text-xs text-text-secondary">إجمالي البنود المستوردة: {pr.lines?.length} بند</p>
            </div>
            <button 
              onClick={() => { setSourcePrId(null); setPr(null) }}
              className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-md transition-colors border border-blue-100"
            >
              تغيير الطلب
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col gap-1.5 focus-within:text-primary">
              <label className="text-sm font-medium text-text-primary">المورد <span className="text-danger">*</span></label>
              <CustomSelect
                required
                value={formData.supplier_party_id}
                onChange={val => setFormData({ ...formData, supplier_party_id: val })}
                options={suppliers.map(s => ({ value: s.id, label: s.arabic_name }))}
                placeholder="اختر المورد..."
                searchable={true}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5 focus-within:text-primary">
                <label className="text-sm font-medium text-text-primary">رقم فاتورة المورد <span className="text-danger">*</span></label>
                <input
                  type="text"
                  readOnly
                  value={formData.invoice_no}
                  className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm text-text-secondary cursor-not-allowed"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1.5 focus-within:text-primary">
                <label className="text-sm font-medium text-text-primary">تاريخ الفاتورة <span className="text-danger">*</span></label>
                <DatePicker
                  value={formData.invoice_date}
                  onChange={val => setFormData({ ...formData, invoice_date: val })}
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3 border-t border-border pt-6">
              <Link
                href={`/projects/${params.id}/procurement/invoices`}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
              >
                إلغاء
              </Link>
              <button
                type="submit"
                disabled={saving || !formData.supplier_party_id}
                className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'جارٍ التحويل حفظ...' : 'إنشاء وحفظ مسودة الفاتورة'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
