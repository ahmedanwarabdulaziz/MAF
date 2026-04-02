'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { draftPaymentVoucher, getGlobalPayablesQueue } from '@/actions/payments'
import { getTreasuryAccounts } from '@/actions/treasury'
import DatePicker from '@/components/DatePicker'

interface GlobalDraftPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  initialPartyId?: string | null
}

export default function GlobalDraftPaymentModal({ isOpen, onClose, initialPartyId }: GlobalDraftPaymentModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [payablesQueue, setPayablesQueue] = useState<{ supplier_invoices: any[], subcontractor_certificates: any[], company_invoices: any[] }>({ supplier_invoices: [], subcontractor_certificates: [], company_invoices: [] })
  const [accounts, setAccounts] = useState<any[]>([])

  useEffect(() => {
    if (isOpen && accounts.length === 0) {
      setFetching(true)
      Promise.all([
        getGlobalPayablesQueue(),
        getTreasuryAccounts() // gets all accounts for the user
      ]).then(([queue, accs]) => {
        setPayablesQueue(queue as any)
        setAccounts(accs)
      }).catch(err => {
        setError('فشل في جلب البيانات: ' + err.message)
      }).finally(() => {
        setFetching(false)
      })
    }
  }, [isOpen, accounts.length])

  // Extract unique parties that have unallocated balances
  const uniqueParties = useMemo(() => {
    const map = new Map<string, { id: string, name: string, type: 'supplier' | 'subcontractor' }>()
    payablesQueue.supplier_invoices.forEach((inv: any) => {
        if (inv.supplier?.id && !map.has(inv.supplier.id)) {
            map.set(inv.supplier.id, { id: inv.supplier.id, name: inv.supplier.arabic_name, type: 'supplier' })
        }
    })
    payablesQueue.company_invoices.forEach((inv: any) => {
        if (inv.supplier?.id && !map.has(inv.supplier.id)) {
            map.set(inv.supplier.id, { id: inv.supplier.id, name: inv.supplier.arabic_name, type: 'supplier' })
        }
    })
    payablesQueue.subcontractor_certificates.forEach((cert: any) => {
        const sub = cert.subcontractor_agreement?.subcontractor
        if (sub && !map.has(sub.id)) {
            map.set(sub.id, { id: sub.id, name: sub.arabic_name, type: 'subcontractor' })
        }
    })
    return Array.from(map.values())
  }, [payablesQueue])

  const [formData, setFormData] = useState({
    party_id: initialPartyId || '',
    financial_account_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    receipt_reference_no: '',
    notes: ''
  })
  const [autoAllocAmount, setAutoAllocAmount] = useState('')

  // Whenever the modal opens and initialPartyId is provided or changes, reset the party_id
  useEffect(() => {
    if (isOpen) {
        setFormData(prev => ({ ...prev, party_id: initialPartyId || '' }))
        setAllocations({})
    }
  }, [isOpen, initialPartyId])

  const [allocations, setAllocations] = useState<Record<string, string>>({})

  // Reset allocations when party changes
  const selectedParty = uniqueParties.find(p => p.id === formData.party_id)
  
  const selectedPartyDocs = useMemo(() => {
    if (!selectedParty) return []
    if (selectedParty.type === 'supplier') {
        const projDocs = payablesQueue.supplier_invoices
            .filter((inv: any) => inv.supplier?.id === selectedParty.id)
            .map((inv: any) => ({
                id: inv.id, 
                type: 'supplier_invoice', 
                no: inv.invoice_no, 
                project: inv.project?.arabic_name || '',
                date: inv.invoice_date,
                project_id: inv.project_id,
                net_amount: Number(inv.net_amount || 0),
                returned_amount: Number(inv.returned_amount || 0),
                paid_to_date: Number(inv.paid_to_date || 0),
                amount: Math.max(0, Number(inv.net_amount || 0) - Number(inv.returned_amount || 0) - Number(inv.paid_to_date || 0))
            }))
        const compDocs = payablesQueue.company_invoices
            .filter((inv: any) => inv.supplier?.id === selectedParty.id)
            .map((inv: any) => ({
                id: inv.id, 
                type: 'company_purchase_invoice', 
                no: inv.invoice_no, 
                project: 'إدارة مركزية',
                date: inv.invoice_date,
                project_id: null,
                net_amount: Number(inv.net_amount || 0),
                returned_amount: Number(inv.returned_amount || 0),
                paid_to_date: Number(inv.paid_to_date || 0),
                amount: Math.max(0, Number(inv.net_amount || 0) - Number(inv.returned_amount || 0) - Number(inv.paid_to_date || 0))
            }))
        return [...projDocs, ...compDocs]
    } else {
         return payablesQueue.subcontractor_certificates
            .filter((cert: any) => cert.subcontractor_agreement?.subcontractor?.id === selectedParty.id)
            .map((cert: any) => ({
                id: cert.id, 
                type: 'subcontractor_certificate', 
                no: cert.certificate_no,
                project: cert.project?.arabic_name || '',
                date: cert.certificate_date,
                project_id: cert.project_id,
                net_amount: Number(cert.net_amount || 0),
                returned_amount: Number(cert.returned_amount || 0),
                paid_to_date: Number(cert.paid_to_date || 0),
                amount: Math.max(0, Number(cert.net_amount || 0) - Number(cert.returned_amount || 0) - Number(cert.paid_to_date || 0))
            }))
    }
  }, [selectedParty, payablesQueue])

  const selectedAccount = accounts.find(a => a.financial_account_id === formData.financial_account_id)
  
  const handleAutoAllocate = () => {
    const totalToAllocate = Number(autoAllocAmount) || 0
    if (totalToAllocate <= 0) return

    let remaining = totalToAllocate
    const newAllocations: Record<string, string> = {}

    // Sort by date inside auto allocate
    const sorted = [...selectedPartyDocs].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    for (const doc of sorted) {
        if (remaining <= 0) break
        const take = Math.min(remaining, doc.amount)
        newAllocations[doc.id] = take.toString()
        remaining -= take
    }

    setAllocations(newAllocations)
  }

  const handleAllocationChange = (docId: string, val: string) => {
    const doc = selectedPartyDocs.find((d: any) => d.id === docId)
    let numVal = Number(val)
    if (doc && numVal > doc.amount) {
        numVal = doc.amount
    }
    setAllocations(prev => ({ ...prev, [docId]: numVal > 0 ? numVal.toString() : val }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const totalVoucherAmount = Object.values(allocations).reduce((sum, val) => sum + (Number(val) || 0), 0)
    if (totalVoucherAmount <= 0) {
        setError('يرجى توزيع مبالغ على الفواتير أو المستخلصات أولاً لإصدار السند.')
        return
    }

    if (selectedAccount && totalVoucherAmount > Number(selectedAccount.current_balance)) {
        setError('رصيد حساب الخزينة المختار غير كاف لتغطية إجمالي المبالغ الموزعة.')
        return
    }

    // Determine the main project id based on dominant allocation, or fall back to account's project, or none.
    let targetProjectId = selectedAccount?.project_id || null

    const allocArray = Object.entries(allocations)
        .map(([id, val]) => {
            const doc = selectedPartyDocs.find((d: any) => d.id === id)
            if (doc?.project_id && !targetProjectId) {
                targetProjectId = doc.project_id // auto inherit project from lines if treasury account is corporate
            }
            return {
                source_type: doc?.type as string,
                source_id: id,
                amount: Number(val)
            }
        })
        .filter(a => a.amount > 0)

    setLoading(true)
    try {
        await draftPaymentVoucher({
            project_id: targetProjectId,
            company_id: selectedAccount?.company_id || payablesQueue.supplier_invoices[0]?.company_id || payablesQueue.subcontractor_certificates[0]?.company_id,
            ...formData,
            party_id: formData.party_id,
            total_amount: totalVoucherAmount,
            allocations: allocArray
        })
        router.refresh()
        onClose()
    } catch (err: any) {
        setError(err.message || 'فشل توليد السند')
    } finally {
        setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => !loading && onClose()} />
      
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-white px-6 py-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-navy">إصدار أوامر الدفع وتوزيع السداد (مركزي)</h2>
            <p className="text-xs text-text-secondary mt-1">توضح الاستحقاقات في كافة المشاريع لهذه الجهة</p>
          </div>
          <button onClick={() => !loading && onClose()} className="p-2 text-text-tertiary hover:text-danger rounded-full hover:bg-danger/10 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 text-right">
          {fetching ? (
             <div className="flex justify-center items-center py-20 text-primary animate-pulse">
                جاري جلب الفواتير والمطالبات المفتوحة...
             </div>
          ) : (
            <form id="globalPaymentForm" onSubmit={handleSubmit} className="space-y-6">
              {error && (
                  <div className="rounded-md bg-danger/10 p-4 text-sm text-danger border border-danger/20">
                      {error}
                  </div>
              )}

              {/* First Group: Metadata */}
              <div className="rounded-xl border border-border bg-white shadow-sm p-6 space-y-6">
                  <h2 className="text-lg font-bold text-navy border-b border-border pb-3">تحديد المستفيد والمبلغ</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                          <label className="block text-sm font-medium text-text-primary mb-1">المستفيد *</label>
                          <select
                              required
                              value={formData.party_id}
                              onChange={(e) => {
                                  setFormData(prev => ({ ...prev, party_id: e.target.value }))
                                  setAllocations({})
                              }}
                              className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                          >
                              <option value="">-- اختر الجهة --</option>
                              {uniqueParties.map(p => (
                                  <option key={p.id} value={p.id}>
                                      {p.type === 'subcontractor' ? '[مقاول]' : '[مورد]'} {p.name}
                                  </option>
                              ))}
                          </select>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-text-primary mb-1">خزينة / مصدر تمويل الدفع *</label>
                          <select
                              required
                              value={formData.financial_account_id}
                              onChange={(e) => setFormData(prev => ({ ...prev, financial_account_id: e.target.value }))}
                              className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                          >
                              <option value="">-- اختر الحساب البنكي أو الخزينة المتاحة --</option>
                              {accounts.filter(a => a.is_active).map(acc => (
                                  <option key={acc.financial_account_id} value={acc.financial_account_id}>
                                      {acc.arabic_name} {acc.project_id ? '(مشروع)' : '(رئيسية)'} - رصيد: {Number(acc.current_balance).toLocaleString()} {acc.currency}
                                  </option>
                              ))}
                          </select>
                      </div>

                      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                              <label className="block text-sm font-medium text-text-primary mb-1">إجمالي ما سيتم سداده في السند</label>
                               <div className="relative">
                                  <input
                                      type="text"
                                      readOnly
                                      value={Object.values(allocations).reduce((sum, val) => sum + (Number(val)||0), 0).toLocaleString()}
                                      className="w-full rounded-md border border-border px-3 py-2 bg-gray-50 text-left text-lg font-bold text-danger cursor-not-allowed"
                                      dir="ltr"
                                  />
                                  <span className="absolute right-3 top-2.5 text-sm font-bold text-text-secondary">EGP</span>
                              </div>
                              <p className="text-xs text-text-secondary mt-1">يُحسب تلقائياً بجمع توزيعات السداد أدناه</p>
                          </div>
                      
                          <div>
                              <label className="block text-sm font-medium text-text-primary mb-1">تاريخ الدفع المرتقب *</label>
                              <DatePicker
                                  value={formData.payment_date}
                                  onChange={val => setFormData(prev => ({ ...prev, payment_date: val }))}
                              />
                          </div>

                          <div>
                              <label className="block text-sm font-medium text-text-primary mb-1">طريقة الدفع *</label>
                              <select
                                  required
                                  value={formData.payment_method}
                                  onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                                  className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm h-10"
                              >
                                  <option value="cash">نقدي</option>
                                  <option value="cheque">شيك بنكي</option>
                                  <option value="bank_transfer">تحويل بنكي مستندي</option>
                              </select>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Second Group: Allocations */}
              {selectedParty && (
                  <div className="rounded-xl border border-border bg-white shadow-sm p-6 space-y-4">
                      <div className="flex items-center justify-between border-b border-border pb-3">
                          <h2 className="text-lg font-bold text-navy">توزيع قيمة الدفعة وسداد التزامات المشاريع المختلفة</h2>
                          <div className="flex items-center gap-2">
                              <input 
                                  type="number" 
                                  min="0" 
                                  step="0.01"
                                  placeholder="مبلغ لتوزيعه تلقائياً" 
                                  value={autoAllocAmount}
                                  onChange={(e) => setAutoAllocAmount(e.target.value)}
                                  className="w-40 rounded-full border border-border px-3 py-1.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-8"
                                  dir="ltr"
                              />
                              <button 
                                  type="button" 
                                  onClick={handleAutoAllocate}
                                  disabled={!autoAllocAmount || Number(autoAllocAmount) <= 0}
                                  className="text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 disabled:opacity-50 transition-colors px-3 py-1.5 rounded-full h-8 flex items-center"
                              >
                                  توزيع تلقائي أقدمية
                              </button>
                          </div>
                      </div>
                      
                      {selectedPartyDocs.length === 0 ? (
                          <p className="text-text-secondary text-sm p-4">تبدو ذمة المورد/المقاول خالية من الاستحقاقات المفتوحة.</p>
                      ) : (
                          <div className="overflow-x-auto">
                              <table className="w-full text-sm text-right">
                                  <thead className="bg-background-secondary border-b border-border">
                                      <tr>
                                          <th className="py-3 px-4 font-semibold text-text-secondary">المشروع</th>
                                          <th className="py-3 px-4 font-semibold text-text-secondary">الفاتورة/المستخلص</th>
                                          <th className="py-3 px-4 font-semibold text-text-secondary">تاريخه</th>
                                          <th className="py-3 px-4 font-semibold text-text-secondary">الإجمالي</th>
                                          <th className="py-3 px-4 font-semibold text-purple-700">المرتجع/مخصوم</th>
                                          <th className="py-3 px-4 font-semibold text-success">مسدد سابقاً</th>
                                          <th className="py-3 px-4 font-semibold text-danger">متبقي (يوزع الآن)</th>
                                          <th className="py-3 px-4 w-40 font-semibold text-text-secondary">المسدد في هذا السند</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                      {selectedPartyDocs.map((doc: any) => (
                                          <tr key={doc.id} className="hover:bg-black/5 transition-colors">
                                              <td className="py-3 px-4 text-navy font-semibold">{doc.project || 'إدارة مركزية'}</td>
                                              <td className="py-3 px-4 font-medium text-text-primary" dir="ltr">{doc.no}</td>
                                              <td className="py-3 px-4 text-text-secondary" dir="ltr">{doc.date}</td>
                                              <td className="py-3 px-4 font-medium text-gray-500" dir="ltr">{doc.net_amount?.toLocaleString() || '0'}</td>
                                              <td className="py-3 px-4 font-medium text-purple-700" dir="ltr">{doc.returned_amount > 0 ? doc.returned_amount.toLocaleString() : '—'}</td>
                                              <td className="py-3 px-4 font-medium text-success" dir="ltr">{doc.paid_to_date > 0 ? doc.paid_to_date.toLocaleString() : '0'}</td>
                                              <td className="py-3 px-4 font-bold text-danger" dir="ltr">{doc.amount.toLocaleString()}</td>
                                              <td className="py-3 px-4">
                                                  <input
                                                      type="number"
                                                      min="0"
                                                      step="0.01"
                                                      max={doc.amount}
                                                      value={allocations[doc.id] || ''}
                                                      onChange={(e) => handleAllocationChange(doc.id, e.target.value)}
                                                      className="w-full rounded border border-primary/30 px-2 py-1.5 text-left font-semibold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:bg-primary/5 transition-all"
                                                      dir="ltr"
                                                      placeholder="0.00"
                                                  />
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                                  <tfoot className="bg-background/80 border-t border-border">
                                      <tr>
                                          <td colSpan={7} className="py-3 px-4 text-left font-bold text-text-secondary">إجمالي ما تم توزيعه لمعادلة الدفعة:</td>
                                          <td className="py-3 px-4 font-bold text-primary text-base" dir="ltr">
                                              {Object.values(allocations).reduce((s, v) => s + (Number(v)||0), 0).toLocaleString()} EGP
                                          </td>
                                      </tr>
                                  </tfoot>
                              </table>
                          </div>
                      )}
                  </div>
              )}
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-background-secondary/50 shrink-0">
          <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-text-secondary hover:bg-black/5 transition-colors border border-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.05)_inset]"
          >
              إلغاء التوجيه
          </button>
          <button
              type="submit"
              form="globalPaymentForm"
              disabled={loading || !formData.party_id}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin block"></span>
              ) : 'إصدار أمر الدفع وتوجيهه للخزينة'}
          </button>
        </div>
      </div>
    </div>
  )
}
