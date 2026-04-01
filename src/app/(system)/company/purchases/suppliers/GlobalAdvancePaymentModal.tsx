'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  recordAdvancePayment,
  getProjectPartiesForAdvance,
  getCompanyProjects
} from '@/actions/payments'
import { getTreasuriesForProject } from '@/actions/owner_billing'
import DatePicker from '@/components/DatePicker'

interface Props {
  isOpen:    boolean
  onClose:   () => void
}

type PartyType = 'supplier' | 'contractor'
type Party = { id: string; arabic_name: string; type: PartyType }
type Project = { id: string; arabic_name: string; project_code: string }

const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  supplier:   '🏪 مورد',
  contractor: '🏗️ مقاول',
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'حوالة بنكية' },
  { value: 'cheque',        label: 'شيك بنكي' },
  { value: 'cash',          label: 'نقدي (كاش)' },
]

export default function GlobalAdvancePaymentModal({ isOpen, onClose }: Props) {
  const router = useRouter()

  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingDetails,  setLoadingDetails]  = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  
  const [projects,        setProjects]        = useState<Project[]>([])
  const [suppliers,       setSuppliers]       = useState<Party[]>([])
  const [contractors,     setContractors]     = useState<Party[]>([])
  const [accounts,        setAccounts]        = useState<{ id: string; name: string; type: string }[]>([])
  
  const [selectedPartyType, setSelectedPartyType] = useState<PartyType>('supplier')

  const [formData, setFormData] = useState({
    project_id:           '',
    party_id:             '',
    financial_account_id: '',
    amount:               0,
    payment_date:         new Date().toISOString().split('T')[0],
    payment_method:       'bank_transfer',
    reference_no:         '',
    notes:                '',
  })

  // Load Projects on Initial Mount
  useEffect(() => {
    if (!isOpen) return
    let isMounted = true

    setError(null)
    setSaving(false)
    setSelectedPartyType('supplier')
    resetForm()

    async function loadInitial() {
      setLoadingProjects(true)
      try {
        const projs = await getCompanyProjects()
        if (isMounted) setProjects(projs)
      } catch (e: any) {
        if (isMounted) setError('تعذر تحميل المشاريع: ' + e.message)
      } finally {
        if (isMounted) setLoadingProjects(false)
      }
    }
    
    loadInitial()

    return () => { isMounted = false }
  }, [isOpen])

  // Load Treasuries and Parties when Project Changes
  useEffect(() => {
    if (!formData.project_id) {
      setSuppliers([])
      setContractors([])
      setAccounts([])
      return
    }

    let isMounted = true
    async function fetchProjectData() {
      setLoadingDetails(true)
      try {
        const [parties, accs] = await Promise.all([
          getProjectPartiesForAdvance(formData.project_id),
          getTreasuriesForProject(formData.project_id),
        ])
        
        if (isMounted) {
          setSuppliers(parties.suppliers as Party[])
          setContractors(parties.contractors as Party[])
          setAccounts(accs)

          // Auto-select if only one account exists
          if (accs.length === 1) {
            setFormData(prev => ({ ...prev, financial_account_id: accs[0].id }))
          } else {
             // Reset dependent fields when project changes
             setFormData(prev => ({ ...prev, financial_account_id: '', party_id: '' }))
          }
        }
      } catch (e: any) {
        if (isMounted) setError('تعذر تحميل بيانات المشروع: ' + e.message)
      } finally {
        if (isMounted) setLoadingDetails(false)
      }
    }

    fetchProjectData()
    return () => { isMounted = false }
  }, [formData.project_id])


  function resetForm() {
    setFormData({
      project_id:           '',
      party_id:             '',
      financial_account_id: '',
      amount:               0,
      payment_date:         new Date().toISOString().split('T')[0],
      payment_method:       'bank_transfer',
      reference_no:         '',
      notes:                '',
    })
  }

  function update(field: string, val: any) {
    setFormData(prev => ({ ...prev, [field]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    const showError = (msg: string) => {
      setError(msg)
      document.querySelector('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' })
    }

    if (!formData.project_id)          { showError('يرجى اختيار المشروع.'); return }
    if (formData.amount <= 0)          { showError('يجب أن يكون المبلغ أكبر من صفر.'); return }
    if (!formData.party_id)            { showError('يرجى اختيار الطرف (مورد / مقاول).'); return }
    if (!formData.financial_account_id){ showError('يرجى اختيار الحساب / الخزينة لسحب الدفعة.'); return }

    setSaving(true)
    setError(null)

    try {
      await recordAdvancePayment({
        project_id:           formData.project_id,
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
      const msg = err.message || 'حدث خطأ أثناء حفظ الدفعة'
      setError(msg)
      setSaving(false)
      document.querySelector('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (!isOpen) return null

  const currentParties = selectedPartyType === 'supplier' ? suppliers : contractors

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => !saving && onClose()} />

      <div className="relative w-full max-w-xl bg-background rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-navy">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-success">
                <path d="M12 7.5a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" />
                <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 14.625v-9.75zM8.25 9.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM18.75 9a.75.75 0 00-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 00.75-.75V9.75a.75.75 0 00-.75-.75h-.008zM4.5 9.75A.75.75 0 015.25 9h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H5.25a.75.75 0 01-.75-.75V9.75z" clipRule="evenodd" />
                <path d="M2.25 18a.75.75 0 000 1.5c5.4 0 10.63.722 15.6 2.075 1.19.324 2.4-.558 2.4-1.82V18.75a.75.75 0 00-.75-.75H2.25z" />
              </svg>
              سداد دفعة مقدمة
            </h2>
            <p className="text-white/60 text-xs mt-0.5">صرف مبلغ مالي من حساب المشروع إلى مورد أو مقاول محدد</p>
          </div>
          <button disabled={saving} onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/80 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Wrapper around body & footer */}
        <form id="global-advance-form" noValidate onSubmit={handleSubmit} className="flex flex-col overflow-hidden max-h-[80vh]">
          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-5 bg-gray-50/30">
            {loadingProjects ? (
              <div className="py-14 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
                <p className="text-text-secondary text-sm">جاري تحميل دليلات المشاريع...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {error && (
                  <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger flex items-start gap-3">
                    <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span>{error}</span>
                  </div>
                )}

                {/* 1. Project Selection */}
                <div className="flex flex-col gap-1.5 p-4 rounded-xl border border-border bg-white shadow-sm">
                  <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-text-tertiary">
                      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                    </svg>
                    تحديد نطاق العمل (المشروع) <span className="text-danger">*</span>
                  </label>
                  <select 
                    required 
                    value={formData.project_id} 
                    onChange={e => update('project_id', e.target.value)}
                    className="rounded-lg border border-border bg-background-secondary focus:bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  >
                    <option value="">-- اختر المشروع --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.arabic_name} {p.project_code ? `(${p.project_code})` : ''}</option>
                    ))}
                  </select>
                </div>

                {formData.project_id && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {loadingDetails ? (
                      <div className="py-8 flex flex-col items-center gap-2 text-text-secondary text-sm">
                        <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
                        جاري تحميل بيانات المشروع المالي...
                      </div>
                    ) : (
                      <>
                        {/* Party Type Toggle */}
                        <div className="grid grid-cols-2 gap-3">
                          {(['supplier', 'contractor'] as PartyType[]).map(pt => (
                            <button
                              key={pt} type="button"
                              onClick={() => { setSelectedPartyType(pt); update('party_id', '') }}
                              className={`rounded-xl border-2 p-3 text-center transition-all text-sm font-bold flex flex-col items-center justify-center gap-1 ${selectedPartyType === pt
                                ? 'border-primary bg-primary/5 text-primary shadow-sm'
                                : 'border-border text-text-secondary hover:border-text-tertiary bg-white'}`}
                            >
                              <span className="text-lg">{pt === 'supplier' ? '🏪' : '🏗️'}</span>
                              {PARTY_TYPE_LABELS[pt]}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Party Selector */}
                          <div className="flex flex-col gap-1.5 md:col-span-2">
                            <label className="text-sm font-semibold text-text-primary">
                              اسم {selectedPartyType === 'supplier' ? 'المورد' : 'المقاول'} <span className="text-danger">*</span>
                            </label>
                            {currentParties.length === 0 ? (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
                                لا يوجد {selectedPartyType === 'supplier' ? 'موردون مسجلون' : 'مقاولون مرتبطون بعقود'} في هذا المشروع بعد.
                              </div>
                            ) : (
                              <select 
                                required value={formData.party_id} onChange={e => update('party_id', e.target.value)}
                                className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                              >
                                <option value="">-- اختر {selectedPartyType === 'supplier' ? 'المورد' : 'المقاول'} --</option>
                                {currentParties.map(p => (
                                  <option key={p.id} value={p.id}>{p.arabic_name}</option>
                                ))}
                              </select>
                            )}
                          </div>

                          {/* Amount */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-text-primary">مبلغ الدفعة <span className="text-danger">*</span></label>
                            <div className="relative">
                              <input
                                type="number" step="0.01" min="0.01" required
                                value={formData.amount || ''}
                                onChange={e => update('amount', Number(e.target.value))}
                                placeholder="0.00"
                                className="w-full rounded-lg border border-border bg-white pl-12 pr-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary/20 dir-ltr text-right font-bold text-success transition-all"
                              />
                              <span className="absolute left-4 top-3 text-xs font-bold text-text-tertiary uppercase">EGP</span>
                            </div>
                          </div>

                          {/* Date */}
                          <div className="flex flex-col gap-1.5 z-30">
                            <label className="text-sm font-semibold text-text-primary">تاريخ الصرف <span className="text-danger">*</span></label>
                            <DatePicker value={formData.payment_date} onChange={val => update('payment_date', val)} />
                          </div>

                          {/* Financial Account */}
                          <div className="flex flex-col gap-1.5 md:col-span-2">
                            <label className="text-sm font-semibold text-text-primary">سحب الدفعة من خزينة/حساب <span className="text-danger">*</span></label>
                            {accounts.length === 0 ? (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                لا توجد حسابات مالية نشطة متاحة للمقاصة في هذا المشروع.
                              </div>
                            ) : (
                              <select 
                                required value={formData.financial_account_id} onChange={e => update('financial_account_id', e.target.value)}
                                className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                              >
                                <option value="">-- اختر حساب الصرف --</option>
                                {accounts.map(a => (
                                  <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                              </select>
                            )}
                          </div>

                          {/* Payment Method */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold text-text-secondary">طريقة الدفع <span className="text-danger">*</span></label>
                            <select required value={formData.payment_method} onChange={e => update('payment_method', e.target.value)}
                              className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary transition-colors">
                              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                          </div>

                          {/* Reference */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold text-text-secondary">رقم المرجع (إيصال/شيك)</label>
                            <input type="text" value={formData.reference_no} onChange={e => update('reference_no', e.target.value)}
                              placeholder="مثال: CHK-10294" className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary dir-ltr text-right" />
                          </div>

                          {/* Notes */}
                          <div className="flex flex-col gap-1.5 md:col-span-2">
                            <label className="text-sm font-bold text-text-secondary">ملاحظات إضافية</label>
                            <textarea rows={2} value={formData.notes} onChange={e => update('notes', e.target.value)}
                              placeholder="تفاصيل عن سبب الدفعة المقدمة..."
                              className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary resize-none" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loadingProjects && (
            <div className="px-6 py-4 border-t border-border bg-background flex justify-between shrink-0">
              <button type="button" onClick={onClose} disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-text-secondary hover:bg-background-secondary transition-colors border border-transparent hover:border-border">
                تراجع وإلغاء
              </button>
              <button type="submit"
                disabled={saving || !formData.project_id || accounts.length === 0}
                className="px-8 py-2.5 rounded-xl bg-success text-white text-sm font-bold shadow-lg shadow-success/20 hover:bg-success/90 hover:shadow-xl hover:shadow-success/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center gap-2">
                {saving
                  ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جاري الترحيل...</>
                  : 'تسجيل وصرف الدفعة ✓'
                }
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
