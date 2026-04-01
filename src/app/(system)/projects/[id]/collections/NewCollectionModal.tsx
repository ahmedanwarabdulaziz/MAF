'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  recordOwnerCollection,
  getTreasuriesForProject,
} from '@/actions/owner_billing'
import DatePicker from '@/components/DatePicker'

interface Props {
  projectId: string
  isOpen: boolean
  onClose: () => void
}

// نوع التحصيل
type CollectionKind = 'regular' | 'advance'

const KIND_LABELS: Record<CollectionKind, { label: string; desc: string; color: string }> = {
  regular: {
    label: 'تحصيل مستخلص',
    desc:  'مبلغ مُحصَّل مقابل فاتورة معتمدة',
    color: 'border-primary bg-primary/5 text-primary',
  },
  advance: {
    label: 'دفعة مقدمة',
    desc:  'مبلغ مُقدَّم من المالك يُهلَك على المستخلصات اللاحقة',
    color: 'border-amber-500 bg-amber-50 text-amber-700',
  },
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'حوالة بنكية' },
  { value: 'cheque',        label: 'شيك بنكي' },
  { value: 'cash',          label: 'نقدي (كاش)' },
]

export default function NewCollectionModal({ projectId, isOpen, onClose }: Props) {
  const router = useRouter()

  const [loading,        setLoading]        = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null)
  const [accounts,       setAccounts]       = useState<{ id: string; name: string; type: string }[]>([])
  const [kind,           setKind]           = useState<CollectionKind>('regular')
  const [attachments,    setAttachments]    = useState<File[]>([])

  const [formData, setFormData] = useState({
    received_amount:           0,
    received_date:             new Date().toISOString().split('T')[0],
    payment_method:            'bank_transfer',
    reference_no:              '',
    financial_account_id:      '',
    notes:                     '',
  })

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setSaving(false)
    setKind('regular')
    setAttachments([])
    setFormData({
      received_amount:           0,
      received_date:             new Date().toISOString().split('T')[0],
      payment_method:            'bank_transfer',
      reference_no:              '',
      financial_account_id:      '',
      notes:                     '',
    })
    loadData()
  }, [isOpen, projectId])

  async function loadData() {
    setLoading(true)
    try {
      const db = createClient()

      const { data: project } = await db
        .from('projects')
        .select('owner_party_id')
        .eq('id', projectId)
        .single()

      if (project?.owner_party_id) setProjectOwnerId(project.owner_party_id)
      else setError('لا يوجد مالك مرتبط بالمشروع.')

      const accs = await getTreasuriesForProject(projectId)
      setAccounts(accs)

      // Auto-select if only one account
      if (accs.length === 1) {
        setFormData(prev => ({ ...prev, financial_account_id: accs[0].id }))
      }
    } catch (e: any) {
      setError('تعذر تحميل البيانات: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function update(field: string, val: any) {
    setFormData(prev => ({ ...prev, [field]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectOwnerId) return
    if (formData.received_amount <= 0) {
      setError('يجب أن يكون المبلغ أكبر من صفر.')
      return
    }
    if (!formData.financial_account_id) {
      setError('يرجى اختيار الحساب / الخزينة.')
      return
    }

    setSaving(true)
    setError(null)

    let uploadedUrls: string[] = []
    
    // Upload files
    if (attachments.length > 0) {
      const db = createClient()
      for (const file of attachments) {
        const ext = file.name.split('.').pop() || 'tmp'
        const path = `collections/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
        
        const { error: uploadErr } = await db.storage.from('owner_collections').upload(path, file)
        
        if (!uploadErr) {
          const { data } = db.storage.from('owner_collections').getPublicUrl(path)
          uploadedUrls.push(data.publicUrl)
        } else {
          setError('تعذر رفع المرفقات: ' + uploadErr.message)
          setSaving(false)
          return
        }
      }
    }

    try {
      await recordOwnerCollection({
        project_id:      projectId,
        owner_party_id:  projectOwnerId,
        received_amount: formData.received_amount,
        received_date:   formData.received_date,
        payment_method:  formData.payment_method,
        reference_no:    formData.reference_no || undefined,
        treasury_id:     formData.financial_account_id,
        collection_type: kind,
        notes:           (kind === 'advance' ? '[دفعة مقدمة] ' : '') + (formData.notes || ''),
        attachments:     uploadedUrls,
      })
      router.refresh()
      onClose()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ')
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const accountTypeLabel = (type: string) => {
    if (type === 'cash')  return '🏦 كاش'
    if (type === 'bank')  return '🏦 بنك'
    if (type === 'site')  return '📦 خزينة موقع'
    return type
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-navy/50 backdrop-blur-sm" onClick={() => !saving && onClose()} />

      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-navy">
          <div>
            <h2 className="text-lg font-bold text-white">تسجيل تحصيل جديد</h2>
            <p className="text-white/60 text-xs mt-0.5">إثبات مبلغ مُحصَّل في الدفاتر</p>
          </div>
          <button disabled={saving} onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/80 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh] space-y-5">
          {loading ? (
            <div className="py-14 flex flex-col items-center gap-3">
              <div className="w-9 h-9 border-4 border-border border-t-primary rounded-full animate-spin" />
              <p className="text-text-secondary text-sm">جاري التحميل...</p>
            </div>
          ) : (
            <form id="collection-form" onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </div>
              )}

              {/* نوع التحصيل — Toggle */}
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(KIND_LABELS) as CollectionKind[]).map(k => (
                  <button
                    key={k} type="button"
                    onClick={() => setKind(k)}
                    className={`rounded-xl border-2 p-3 text-right transition-all ${kind === k ? KIND_LABELS[k].color + ' font-bold' : 'border-border text-text-secondary hover:border-border/60'}`}
                  >
                    <p className="text-sm font-bold">{KIND_LABELS[k].label}</p>
                    <p className={`text-xs mt-0.5 ${kind === k ? 'opacity-80' : 'opacity-60'}`}>{KIND_LABELS[k].desc}</p>
                  </button>
                ))}
              </div>

              {/* Amount + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-text-primary">المبلغ <span className="text-danger">*</span></label>
                  <input
                    type="number" step="0.01" min="0.01" required
                    value={formData.received_amount || ''}
                    onChange={e => update('received_amount', Number(e.target.value))}
                    className={`rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary dir-ltr text-right font-bold transition-colors ${kind === 'advance' ? 'text-amber-600' : 'text-success'}`}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex flex-col gap-1.5 z-30">
                  <label className="text-sm font-semibold text-text-primary">تاريخ التحصيل <span className="text-danger">*</span></label>
                  <DatePicker value={formData.received_date} onChange={val => update('received_date', val)} />
                </div>
              </div>

              {/* Payment Method + Reference */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-text-primary">طريقة السداد <span className="text-danger">*</span></label>
                  <select required value={formData.payment_method} onChange={e => update('payment_method', e.target.value)}
                    className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors">
                    {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-text-primary">رقم المرجع</label>
                  <input type="text" value={formData.reference_no} onChange={e => update('reference_no', e.target.value)}
                    placeholder="TRX-123456" className="rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary dir-ltr" />
                </div>
              </div>

              {/* Financial Account — الحساب / الخزينة */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-text-primary">الحساب / الخزينة <span className="text-danger">*</span></label>
                {accounts.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                    لا توجد حسابات مالية نشطة. أضف حساباً من صفحة الخزينة أولاً.
                  </div>
                ) : (
                  <select required value={formData.financial_account_id} onChange={e => update('financial_account_id', e.target.value)}
                    className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors">
                    <option value="">-- اختر الحساب --</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {accountTypeLabel(a.type)}
                      </option>
                    ))}
                  </select>
                )}
              </div>


              {/* Advance note */}
              {kind === 'advance' && (
                <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <strong>دفعة مقدمة:</strong> سيُسجَّل هذا المبلغ في سجل التحصيلات وسيُتاح خصمه تدريجياً عبر خانة "اهلاك الدفعة المقدمة" في كل مستخلص.
                </div>
              )}

              {/* Attachments */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-text-primary flex items-center justify-between">
                  <span>المرفقات (اختياري)</span>
                  <span className="text-xs text-text-secondary font-normal">الحد الأقصى 5 ملفات</span>
                </label>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files || [])
                    if (selected.length + attachments.length > 5) {
                      setError('يمكنك إرفاق 5 ملفات كحد أقصى.')
                    } else {
                      setAttachments(prev => [...prev, ...selected].slice(0, 5))
                    }
                    e.target.value = '' // reset input
                  }}
                  className="rounded-lg border border-border bg-white p-1 text-sm outline-none transition-colors file:ml-4 file:py-2 file:px-4 file:border-0 file:font-semibold file:bg-primary/5 file:text-primary hover:file:bg-primary/10 file:rounded-md file:cursor-pointer text-text-secondary cursor-pointer"
                />
                
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {attachments.map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2 text-sm shadow-sm">
                        <div className="flex flex-row items-center gap-2 max-w-[80%]">
                          <svg className="w-4 h-4 text-text-secondary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          <span className="truncate" dir="ltr">{file.name}</span>
                          <span className="text-xs text-text-secondary">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                        </div>
                        <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-danger hover:text-white transition-colors p-1.5 rounded-md hover:bg-danger/90">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-text-primary">ملاحظات</label>
                <textarea rows={2} value={formData.notes} onChange={e => update('notes', e.target.value)}
                  className="rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary resize-none" />
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="px-6 py-4 border-t border-border bg-background-secondary/30 flex justify-between">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-text-secondary hover:bg-background-secondary transition-colors">
              إلغاء
            </button>
            <button type="submit" form="collection-form"
              disabled={saving || !projectOwnerId || accounts.length === 0}
              className={`px-7 py-2.5 rounded-lg text-white text-sm font-bold shadow-md disabled:opacity-50 transition-all flex items-center gap-2 ${kind === 'advance' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-success hover:bg-success/90'}`}>
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جارٍ الحفظ...</>
                : kind === 'advance' ? '✓ تسجيل الدفعة المقدمة' : '✓ إثبات التسجيل في الدفاتر'
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
