'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { draftPaymentVoucher } from '@/actions/payments'
import DatePicker from '@/components/DatePicker'

export default function PaymentWizard({ projectId, accounts, payablesQueue }: { 
    projectId: string, 
    accounts: any[], 
    payablesQueue: any 
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extract unique parties that have unallocated balances
  const uniqueParties = useMemo(() => {
    const map = new Map<string, { id: string, name: string, type: 'supplier' | 'subcontractor' }>()
    payablesQueue.supplier_invoices.forEach((inv: any) => {
        if (!map.has(inv.supplier.id)) {
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
    party_id: '',
    financial_account_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    total_amount: '',
    receipt_reference_no: '',
    notes: ''
  })

  // Track manual allocations per document ID
  const [allocations, setAllocations] = useState<Record<string, string>>({})

  // Find the selected party and their open documents
  const selectedParty = uniqueParties.find(p => p.id === formData.party_id)
  
  const selectedPartyDocs = useMemo(() => {
    if (!selectedParty) return []
    if (selectedParty.type === 'supplier') {
        return payablesQueue.supplier_invoices
            .filter((inv: any) => inv.supplier?.id === selectedParty.id)
            .map((inv: any) => {
                // Use payable_limit if present (3-Way Match Guard), otherwise full outstanding
                const outstanding     = Number(inv.net_amount) - Number(inv.paid_to_date || 0)
                const payable_limit   = inv.payable_limit !== undefined ? Number(inv.payable_limit) : outstanding
                return {
                    id: inv.id,
                    type: 'supplier_invoice',
                    no: inv.invoice_no,
                    date: inv.invoice_date,
                    amount: payable_limit,            // ← الحد المسموح بسداده
                    full_outstanding: outstanding,     // ← الإجمالي الكامل (للعرض)
                    advance_amount: inv.advance_amount || 0,
                    has_partial_receipt: !!inv.has_partial_receipt,
                    is_legacy: !!inv.is_legacy,
                }
            })
    } else {
         return payablesQueue.subcontractor_certificates
            .filter((cert: any) => cert.subcontractor_agreement?.subcontractor?.id === selectedParty.id)
            .map((cert: any) => ({
                id: cert.id,
                type: 'subcontractor_certificate',
                no: cert.certificate_no,
                date: cert.certificate_date,
                amount: Number(cert.outstanding_amount || 0),
                full_outstanding: Number(cert.outstanding_amount || 0),
                advance_amount: 0,
                has_partial_receipt: false,
                is_legacy: true,
            }))
    }
  }, [selectedParty, payablesQueue])

  // Helpers
  const selectedAccount = accounts.find(a => a.financial_account_id === formData.financial_account_id)
  
  // Handlers
  const handleAutoAllocate = () => {
    const totalToAllocate = Number(formData.total_amount) || 0
    if (totalToAllocate <= 0) return

    let remaining = totalToAllocate
    const newAllocations: Record<string, string> = {}

    for (const doc of selectedPartyDocs) {
        if (remaining <= 0) break
        const take = Math.min(remaining, doc.amount)
        newAllocations[doc.id] = take.toString()
        remaining -= take
    }

    setAllocations(newAllocations)
  }

  const handleAllocationChange = (docId: string, val: string) => {
    setAllocations(prev => ({ ...prev, [docId]: val }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    const totalVoucherAmount = Number(formData.total_amount)
    if (totalVoucherAmount <= 0) {
        setError('مبلغ السند غير صالح')
        return
    }

    if (selectedAccount && totalVoucherAmount > Number(selectedAccount.current_balance)) {
        setError('رصيد حساب الخزينة المختار غير كاف لتغطية السند.')
        return
    }

    const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + (Number(val) || 0), 0)
    
    // We allow under allocation but NOT over allocation
    if (totalAllocated > totalVoucherAmount) {
        setError('مجموع المبالغ الموزعة يتجاوز قيمة السند الإجمالية.')
        return
    }

    // Build Payload
    const allocArray = Object.entries(allocations)
        .map(([id, val]) => {
            const doc = selectedPartyDocs.find((d: any) => d.id === id)
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
            project_id: projectId,
            company_id: selectedAccount?.company_id, // Ensure we pass the company derived from the account pool
            ...formData,
            party_id: formData.party_id,
            total_amount: totalVoucherAmount,
            allocations: allocArray
        })
        router.push(`/projects/${projectId}/payments`)
    } catch (err: any) {
        setError(err.message || 'فشل توليد السند او الترحيل')
        setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
        <Link href={`/projects/${projectId}/payments`} className="hover:text-primary">سجلات الدفع</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">سند صرف جديد</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">إصدار وتخصيص سند صرف مدفوعات</h1>
        <p className="mt-1 text-sm text-text-secondary">
          اكتب قيمة الدفعة من خزينة المشروع، واخصم من المستخلصات أو الفواتير المستحقة.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
            <div className="rounded-md bg-danger/10 p-4 text-sm text-danger border border-danger/20">
                {error}
            </div>
        )}

        {/* First Group: Metadata */}
        <div className="rounded-xl border border-border bg-white shadow-sm p-6 space-y-6">
            <h2 className="text-lg font-bold text-navy border-b border-border pb-3">البيانات الأساسية</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">المستفيد (مقاول / مورد) *</label>
                    <select
                        required
                        value={formData.party_id}
                        onChange={(e) => {
                            setFormData(prev => ({ ...prev, party_id: e.target.value }))
                            setAllocations({})
                        }}
                        className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="">-- اختر من قائمة أصحاب المستحقات المعلقة --</option>
                        {uniqueParties.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.type === 'subcontractor' ? '[مقاول]' : '[مورد]'} {p.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">مصدر التمويل (حساب الخزينة) *</label>
                    <select
                        required
                        value={formData.financial_account_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, financial_account_id: e.target.value }))}
                        className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="">-- اختر الحساب --</option>
                        {accounts.filter(a => a.is_active).map(acc => (
                            <option key={acc.financial_account_id} value={acc.financial_account_id}>
                                {acc.arabic_name} {acc.project_id ? '(خزنة الموقع)' : '(حساب رئيسي)'} - المتاح: {Number(acc.current_balance).toLocaleString()} {acc.currency}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">تاريخ الدفع *</label>
                    <DatePicker
                        value={formData.payment_date}
                        onChange={val => setFormData(prev => ({ ...prev, payment_date: val }))}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">وسيلة الدفع *</label>
                    <select
                        required
                        value={formData.payment_method}
                        onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                        className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="cash">نقداً (نقدية بالصندوق)</option>
                        <option value="cheque">شيك بنكي</option>
                        <option value="bank_transfer">تحويل بنكي مستندي</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">مبلغ السند الكلي *</label>
                     <div className="relative">
                        <input
                            type="number"
                            required
                            min="1"
                            step="0.01"
                            value={formData.total_amount}
                            onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                            className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-left text-lg font-bold"
                            dir="ltr"
                        />
                        <span className="absolute right-3 top-2.5 text-sm text-text-secondary">EGP</span>
                    </div>
                </div>

                 <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">الرقم المرجعي (شيك / حوالة)</label>
                    <input
                        type="text"
                        value={formData.receipt_reference_no}
                        onChange={(e) => setFormData(prev => ({ ...prev, receipt_reference_no: e.target.value }))}
                        className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-left"
                        dir="ltr"
                        placeholder="e.g #CHQ-1002"
                    />
                </div>
            </div>
            
             <div>
                <label className="block text-sm font-medium text-text-primary mb-1">البيان / ملاحظات</label>
                <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="ملاحظات توضيحية للسند وحركة الدفع..."
                />
            </div>
        </div>

        {/* Second Group: Allocations */}
        {selectedParty && (
            <div className="rounded-xl border border-border bg-white shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <h2 className="text-lg font-bold text-navy">تخصيص الدفعة على المستحقات المفتوحة</h2>
                    <button 
                        type="button" 
                        onClick={handleAutoAllocate}
                        className="text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors px-3 py-1.5 rounded-full"
                    >
                        توزيع تلقائي (الأقدم فالأحدث)
                    </button>
                </div>
                
                {selectedPartyDocs.length === 0 ? (
                    <p className="text-text-secondary text-sm">تبدو ذمة المورد/المقاول خالية من الاستحقاقات المفتوحة.</p>
                ) : (
                    <table className="w-full text-sm text-right mt-4">
                        <thead className="bg-background-secondary border-b border-border">
                            <tr>
                                <th className="py-3 px-4 font-semibold text-text-secondary">المستند</th>
                                <th className="py-3 px-4 font-semibold text-text-secondary">التاريخ</th>
                                <th className="py-3 px-4 font-semibold text-text-secondary">الحد المسموح بسداده</th>
                                <th className="py-3 px-4 w-40 font-semibold text-text-secondary">قيمة الخصم / السداد</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {selectedPartyDocs.map((doc: any) => (
                                <tr key={doc.id} className={`hover:bg-black/5 transition-colors ${doc.has_partial_receipt ? 'bg-amber-50/40' : ''}`}>
                                    <td className="py-3 px-4 font-medium text-text-primary" dir="ltr">
                                        <div className="flex flex-col gap-0.5">
                                            <span>{doc.no}</span>
                                            {doc.has_partial_receipt && (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 w-fit">
                                                    ⚠️ استلام جزئي
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-text-secondary" dir="ltr">{doc.date}</td>
                                    <td className="py-3 px-4" dir="ltr">
                                        <div className="flex flex-col gap-0.5">
                                            <span className={`font-bold ${doc.has_partial_receipt ? 'text-amber-700' : 'text-danger'}`}>
                                                {doc.amount.toLocaleString()}
                                            </span>
                                            {doc.has_partial_receipt && doc.advance_amount > 0 && (
                                                <span className="text-xs text-blue-600">
                                                    + {doc.advance_amount.toLocaleString()} كدفعة مقدمة
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            max={doc.amount}
                                            value={allocations[doc.id] || ''}
                                            onChange={(e) => handleAllocationChange(doc.id, e.target.value)}
                                            className="w-full rounded border border-border px-2 py-1 text-left"
                                            dir="ltr"
                                            placeholder="0.00"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-background border-t border-border">
                            <tr>
                                <td colSpan={3} className="py-3 px-4 text-left font-bold text-text-secondary">الإجمالي الموزع:</td>
                                <td className="py-3 px-4 font-bold text-primary" dir="ltr">
                                    {Object.values(allocations).reduce((s, v) => s + (Number(v)||0), 0).toLocaleString()} EGP
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
            <Link
                href={`/projects/${projectId}/payments`}
                className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-black/5"
            >
                إلغاء
            </Link>
            <button
                type="submit"
                disabled={loading || !formData.party_id}
                className="rounded-md bg-primary px-8 py-2 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 disabled:opacity-50"
            >
                {loading ? 'جاري الترحيل...' : 'اعتماد وترحيل الدفعة'}
            </button>
        </div>
      </form>
    </div>
  )
}
