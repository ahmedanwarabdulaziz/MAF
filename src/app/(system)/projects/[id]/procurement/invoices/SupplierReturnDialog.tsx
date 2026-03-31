'use client'

import { useState, useTransition } from 'react'
import { createSupplierReturn, postSupplierReturn } from '@/actions/procurement'
import { useRouter } from 'next/navigation'

export default function SupplierReturnDialog({ 
  invoice, 
  projectId,
  onClose,
  onSuccess 
}: { 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoice: any
  projectId: string
  onClose: () => void
  onSuccess?: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  // States for system popups
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  // State for line return quantities
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')

  // Calculate totals based on return quantities
  let totalGross = 0
  let totalTax = 0
  let totalDiscount = 0
  let totalNet = 0

  const linesToReturn = invoice.lines.filter((l: any) => (l.invoiced_quantity - (l.returned_quantity || 0)) > 0)

  linesToReturn.forEach((line: any) => {
    const qty = returnQtys[line.id] || 0
    if (qty > 0) {
      const lineNet = qty * Number(line.unit_price) // Note: simple net without tax/discount per line for now.
      totalNet += lineNet
      totalGross += lineNet
    }
  })

  // To properly proportion tax and discount:
  if (totalGross > 0 && invoice.gross_amount > 0) {
    const ratio = totalGross / invoice.gross_amount
    totalTax = invoice.tax_amount * ratio
    totalDiscount = invoice.discount_amount * ratio
    totalNet = totalGross + totalTax - totalDiscount
  }

  const handleQtyChange = (lineId: string, val: string, max: number) => {
    let num = Number(val)
    if (isNaN(num) || num < 0) num = 0
    if (num > max) num = max
    setReturnQtys(prev => ({ ...prev, [lineId]: num }))
  }

  const handleSubmit = async () => {
    const lines = linesToReturn
      .filter((l: any) => (returnQtys[l.id] || 0) > 0)
      .map((l: any) => ({
        original_line_id: l.id,
        item_id: l.item_id,
        return_quantity: returnQtys[l.id],
        unit_price: Number(l.unit_price),
        line_gross: returnQtys[l.id] * Number(l.unit_price),
        line_net: returnQtys[l.id] * Number(l.unit_price) // without complex tax distributing per line
      }))

    if (lines.length === 0) {
      setErrorMsg('يجب تحديد كمية لمرتجع واحد على الأقل.')
      return
    }

    if (!invoice.receipt_confirmation?.warehouse_id) {
       setErrorMsg('لا يمكن عمل مرتجع لفاتورة ليس لها مخزن محدد في مستند الاستلام.')
       return
    }

    startTransition(async () => {
      try {
        const returnNo = 'RET-' + invoice.invoice_no + '-' + Math.floor(Math.random() * 1000)
        
        const returnId = await createSupplierReturn({
          project_id: projectId,
          company_id: invoice.company_id,
          warehouse_id: invoice.receipt_confirmation.warehouse_id,
          supplier_party_id: invoice.supplier_party_id,
          original_invoice_id: invoice.id,
          return_no: returnNo,
          return_date: new Date().toISOString().split('T')[0],
          gross_amount: totalGross,
          tax_amount: totalTax,
          discount_amount: totalDiscount,
          net_amount: totalNet,
          notes,
          lines
        })

        await postSupplierReturn(returnId)
        
        if (onSuccess) onSuccess()
        onClose()
        router.refresh()
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ')
      }
    })
  }

  const fmt = (n: number) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-border" dir="rtl">
        <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
          <div className="block w-full text-right">
            <h2 className="text-xl font-bold text-white">
              إنشاء إشعار خصم / مرتجع للفاتورة: {invoice.invoice_no}
            </h2>
            <p className="mt-1 text-sm text-white/80">
              قيمة المرتجع سيتم خصمها من رصيد المورد، وسيتم خصم الكميات من المخزون الذي تم توريد البضاعة عليه.
            </p>
          </div>
          <button type="button" onClick={onClose} className="absolute left-6 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col gap-6">
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden text-right">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-border text-gray-600">
                <tr>
                  <th className="py-3 px-4 text-right">الصنف (المادة)</th>
                  <th className="py-3 px-4 text-right w-24">الكمية الكلية</th>
                  <th className="py-3 px-4 text-right w-24">تم إرجاعه</th>
                  <th className="py-3 px-4 text-right w-24">سعر الوحدة</th>
                  <th className="py-3 px-4 flex justify-between items-center bg-blue-50/50">
                    <span>كمية المرتجع الآن</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {linesToReturn.map((l: any) => {
                  const available = l.invoiced_quantity - (l.returned_quantity || 0)
                  const item = Array.isArray(l.item) ? l.item[0] : l.item
                  return (
                    <tr key={l.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-gray-900 font-medium">{item?.item_code} - {item?.arabic_name || '---'}</td>
                      <td className="py-3 px-4 text-gray-500">{fmt(l.invoiced_quantity)}</td>
                      <td className="py-3 px-4 text-gray-500">{fmt(l.returned_quantity || 0)}</td>
                      <td className="py-3 px-4 text-gray-500">{fmt(l.unit_price)}</td>
                      <td className="py-2 px-4 bg-blue-50/30">
                        <input 
                          type="number"
                          min="0"
                          max={available}
                          step="any"
                          value={returnQtys[l.id] || ''}
                          onChange={e => handleQtyChange(l.id, e.target.value, available)}
                          className="w-full p-2 text-left rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  )
                })}
                {linesToReturn.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      لا يوجد كميات متبقية لعمل مرتجع عليها
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white p-4 border border-border rounded-xl shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات المرتجع (اختياري)</label>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full p-3 rounded-xl border border-border focus:ring-2 focus:ring-primary shadow-sm outline-none"
                rows={4}
                placeholder="أسباب الارتجاع أو عرض تفاصيل أخرى..."
              />
            </div>
            
            <div className="bg-white p-4 border border-border rounded-xl shadow-sm flex flex-col justify-center space-y-3">
              <div className="flex justify-between text-sm" dir="ltr">
                <span className="font-semibold">{fmt(totalGross)}</span>
                <span className="text-gray-500" dir="rtl">قيمة الأصناف المرتجعة</span>
              </div>
              <div className="flex justify-between text-sm" dir="ltr">
                <span className="font-semibold text-red-600">{fmt(totalDiscount)}</span>
                <span className="text-gray-500" dir="rtl">نسبة الخصم المرتجع</span>
              </div>
              <div className="flex justify-between text-sm" dir="ltr">
                <span className="font-semibold text-blue-600">{fmt(totalTax)}</span>
                <span className="text-gray-500" dir="rtl">نسبة الضريبة المرتجعة</span>
              </div>
              <div className="flex justify-between border-t pt-3 mt-1" dir="ltr">
                <span className="font-bold text-lg text-primary">{fmt(totalNet)}</span>
                <span className="font-bold text-gray-700" dir="rtl">صافي قيمة المرتجع</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-navy/10 p-4 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            className="px-6 py-2.5 rounded-xl border border-border bg-white text-gray-700 hover:bg-gray-100 transition shadow-sm"
            onClick={onClose}
            disabled={isPending}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold disabled:opacity-50 transition shadow-sm"
            onClick={handleSubmit}
            disabled={isPending || totalNet <= 0}
          >
            {isPending ? 'جاري التنفيذ...' : 'تسجيل المرتجع'}
          </button>
        </div>
      </div>

      {/* Error / Validation Dialog */}
      {errorMsg && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setErrorMsg(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-danger animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-8 w-8 text-danger">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3.L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-center text-navy mb-2">تنبيه</h3>
            <p className="text-center text-text-secondary mb-6">{errorMsg}</p>
            <div className="flex justify-center">
              <button
                onClick={() => setErrorMsg(null)}
                className="w-full rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-danger/90 transition-colors"
                type="button"
              >
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
