'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  recordAdvancePayment,
  getProjectPartiesForAdvance,
} from '@/actions/payments'
import { getTreasuriesForProject } from '@/actions/owner_billing'
import DatePicker from '@/components/DatePicker'

interface Props {
  projectId: string
  isOpen:    boolean
  onClose:   () => void
}

type PartyType = 'supplier' | 'contractor'
type Party = { id: string; arabic_name: string; type: PartyType }

const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  supplier:   '🏪 موردين',
  contractor: '🏗️ مقاولين',
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'حوالة بنكية' },
  { value: 'cheque',        label: 'شيك بنكي' },
  { value: 'cash',          label: 'نقدي (كاش)' },
]

export default function AdvancePaymentModal({ projectId, isOpen, onClose }: Props) {
  const router = useRouter()

  const [loading,         setLoading]         = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [suppliers,       setSuppliers]       = useState<Party[]>([])
  const [contractors,     setContractors]     = useState<Party[]>([])
  const [accounts,        setAccounts]        = useState<{ id: string; name: string; type: string }[]>([])
  const [selectedPartyType, setSelectedPartyType] = useState<PartyType>('supplier')

  const [formData, setFormData] = useState({
    party_id:             '',
    financial_account_id: '',
    amount:               0,
    payment_date:         new Date().toISOString().split('T')[0],
    payment_method:       'bank_transfer',
    reference_no:         '',
    notes:                '',
  })

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setSaving(false)
    setSelectedPartyType('supplier')
    setFormData({
      party_id:             '',
      financial_account_id: '',
      amount:               0,
      payment_date:         new Date().toISOString().split('T')[0],
      payment_method:       'bank_transfer',
      reference_no:         '',
      notes:                '',
    })
    loadData()
  }, [isOpen, projectId])

  async function loadData() {
    setLoading(true)
    try {
      const [parties, accs] = await Promise.all([
        getProjectPartiesForAdvance(projectId),
        getTreasuriesForProject(projectId),
      ])
      setSuppliers(parties.suppliers as Party[])
      setContractors(parties.contractors as Party[])
      setAccounts(accs)

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
    if (formData.amount <= 0)          { setError('يجب أن يكون المبلغ أكبر من صفر.'); return }
    if (!formData.party_id)            { setError('يرجى اختيار الطرف (مورد / مقاول).'); return }
    if (!formData.financial_account_id){ setError('يرجى اختيار الحساب / الخزينة.'); return }

    setSaving(true)
    setError(null)

    try {
      await recordAdvancePayment({
        project_id:           projectId,
        party_id:             formData.party_id,
        party_type:           selectedPartyType,
        financial_account_id: formData.financial_account_id,
        amount:               formData.amount,
        payment_date:         formData.payment_date,
        payment_method:       formData.payment_method,
        reference_no:         formData.reference_no || undefined,
        notes:                formData.notes || undefined,
      })
      router.refresh()
      onClose()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ')
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const currentParties = selectedPartyType === 'supplier' ? suppliers : contractors

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-navy/50 backdrop-blur-sm" onClick={() => !saving && onClose()} />

      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-navy">
          <div>
            <h2 className="text-lg font-bold text-white">تسجيل دفعة مقدمة</h2>
            <p className="text-white/60 text-xs mt-0.5">صرف مبلغ مقدم لمورد أو مقاول</p>
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
            <form id="advance-form" onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </div>
              )}

              {/* Party Type Toggle */}
              <div className="grid grid-cols-2 gap-3">
                {(['supplier', 'contractor'] as PartyType[]).map(pt => (
                  <button
                    key={pt} type="button"
                    onClick={() => { setSelectedPartyType(pt); update('party_id', '') }}
                    className={`rounded-xl border-2 p-3 text-right transition-all text-sm font-bold ${selectedPartyType === pt
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-text-secondary hover:border-border/60'}`}
                  >
                    {PARTY_TYPE_LABELS[pt]}
                  </button>
                ))}
              </div>

              {/* Party Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-text-primary">
                  {selectedPartyType === 'supplier' ? 'المورد' : 'المقاول'} <span className="text-danger">*</span>
                </label>
                {currentParties.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                    لا يوجد {selectedPartyType === 'supplier' ? 'موردون' : 'مقاولون'} مرتبطون بهذا المشروع بعد.
                  </div>
                ) : (
                  <select required value={formData.party_id} onChange={e => update('party_id', e.target.value)}
                    className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors">
                    <option value="">-- اختر --</option>
                    {currentParties.map(p => (
                      <option key={p.id} value={p.id}>{p.arabic_name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Amount + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-text-primary">المبلغ <span className="text-danger">*</span></label>
                  <input
                    type="number" step="0.01" min="0.01" required
                    value={formData.amount || ''}
                    onChange={e => update('amount', Number(e.target.value))}
                    placeholder="0.00"
                    className="rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary dir-ltr text-right font-bold text-danger transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5 z-30">
                  <label className="text-sm font-semibold text-text-primary">تاريخ الصرف <span className="text-danger">*</span></label>
                  <DatePicker value={formData.payment_date} onChange={val => update('payment_date', val)} />
                </div>
              </div>

              {/* Payment Method + Reference */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-text-primary">طريقة الدفع <span className="text-danger">*</span></label>
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

              {/* Financial Account */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-text-primary">الحساب / الخزينة <span className="text-danger">*</span></label>
                {accounts.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                    لا توجد حسابات مالية نشطة.
                  </div>
                ) : (
                  <select required value={formData.financial_account_id} onChange={e => update('financial_account_id', e.target.value)}
                    className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors">
                    <option value="">-- اختر الحساب --</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Note banner */}
              <div className="rounded-xl border-2 border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary/80">
                ⚡ هذه الدفعة ستُرحَّل فوراً وتُخصم من رصيد الخزينة. يمكن الرجوع إليها في سجل الدفعات.
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
            <button type="submit" form="advance-form"
              disabled={saving || accounts.length === 0}
              className="px-7 py-2.5 rounded-lg bg-danger text-white text-sm font-bold shadow-md hover:bg-danger/90 disabled:opacity-50 transition-all flex items-center gap-2">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جارٍ الصرف...</>
                : '✓ صرف الدفعة المقدمة'
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
