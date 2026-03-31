'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getPurchaseRequestDetails, convertPrToInvoice, getPurchaseRequests } from '@/actions/procurement'
import { peekNextDocumentNoByProject } from '@/actions/sequences'
import DatePicker from '@/components/DatePicker'
import CustomSelect from '@/components/CustomSelect'

interface NewSupplierInvoiceDialogProps {
  projectId: string
  initialPrId?: string
  trigger?: React.ReactNode
}

export default function NewSupplierInvoiceDialog({ projectId, initialPrId, trigger }: NewSupplierInvoiceDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  
  const [sourcePrId, setSourcePrId] = useState<string | null>(initialPrId || null)
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

  // Fetch whenever modal opens
  useEffect(() => {
    if (!isOpen) return
    
    setSourcePrId(initialPrId || null)
    setFormData({
      supplier_party_id: '',
      invoice_no: 'تلقائي',
      invoice_date: new Date().toISOString().split('T')[0]
    })
    setError(null)

    async function init() {
      try {
        const currentPrId = initialPrId || null
        if (!currentPrId) {
          const prs = await getPurchaseRequests(projectId)
          setApprovedPrs(prs.filter(p => p.status === 'approved'))
          setLoading(false)
          return
        }

        setLoading(true)
        const prData = await getPurchaseRequestDetails(currentPrId)
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
        const seq = await peekNextDocumentNoByProject(projectId, 'supplier_invoices', 'INV')
        setFormData(prev => ({ ...prev, invoice_no: seq }))
      } catch (err) {}
    }

    init()
    fetchSeq()
  }, [isOpen, initialPrId, projectId])

  // Re-fetch when sourcePrId changes from the dropdown inside the modal
  useEffect(() => {
    if (!isOpen || !sourcePrId || sourcePrId === initialPrId) return
    
    async function loadSelectedPr() {
      setLoading(true)
      try {
        const prData = await getPurchaseRequestDetails(sourcePrId!)
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
    loadSelectedPr()
  }, [sourcePrId, isOpen, initialPrId])

  const openModal = () => setIsOpen(true)
  const closeModal = () => setIsOpen(false)

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
      closeModal()
      router.push(`/projects/${projectId}/procurement/invoices/${result.id}`)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحويل الفاتورة')
      setSaving(false)
    }
  }

  return (
    <>
      {trigger ? (
        <span onClick={openModal}>{trigger}</span>
      ) : (
        <button
          onClick={openModal}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
        >
          + فاتورة توريد جديدة
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={closeModal} />
          
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
              <div className="text-right w-full">
                <h2 className="text-xl font-bold text-white">إنشاء فاتورة توريد (مرحلة المطابقة)</h2>
                <p className="mt-1 text-sm text-white/80">الخطوة الأولى: تحديد بيانات الفاتورة والمورد لطلب الشراء المعتمد</p>
              </div>
              <button type="button" onClick={closeModal} className="absolute left-6 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30 text-right">
              {loading ? (
                <div className="py-12 text-center text-text-secondary animate-pulse">جاري تحميل البيانات...</div>
              ) : (
                <div className="space-y-6">
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
                        {!initialPrId && (
                          <button 
                            onClick={() => { setSourcePrId(null); setPr(null) }}
                            className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-md transition-colors border border-blue-100"
                          >
                            تغيير الطلب
                          </button>
                        )}
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
                          <button
                            type="button"
                            onClick={closeModal}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
                          >
                            إلغاء
                          </button>
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
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
