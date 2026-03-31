'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createWarehouseTransfer, getAvailableStock } from '@/actions/warehouse'
import { peekNextDocumentNo } from '@/actions/sequences'
import DatePicker from '@/components/DatePicker'
import CustomSelect from '@/components/CustomSelect'

export default function NewTransferDialog({ warehouses, items, itemGroups, companyId, projectId }: {
  warehouses: any[],
  items: any[],
  itemGroups: any[],
  companyId: string,
  projectId?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const [docNo, setDocNo] = useState('تلقائي')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0])
  const [sourceWarehouseId, setSourceWarehouseId] = useState('')
  const [destWarehouseId, setDestWarehouseId] = useState('')
  const [notes, setNotes] = useState('')
  
  const [selectedItem, setSelectedItem] = useState('')
  const [quantity, setQuantity] = useState('')
  const [availableQty, setAvailableQty] = useState<number | null>(null)

  useEffect(() => {
    if (sourceWarehouseId && selectedItem) {
      getAvailableStock(sourceWarehouseId, selectedItem).then(setAvailableQty)
    } else {
      setAvailableQty(null)
    }
  }, [sourceWarehouseId, selectedItem])

  useEffect(() => {
    if (isOpen) {
      peekNextDocumentNo(companyId, 'warehouse_transfers', 'TRF')
        .then(setDocNo)
        .catch(() => {})
        
      // Reset form
      setSourceWarehouseId('')
      setDestWarehouseId('')
      setSelectedItem('')
      setQuantity('')
      setNotes('')
      setError('')
    }
  }, [isOpen, companyId])

  const itemOptions = (() => {
    const result: any[] = []
    const getChildren = (parentId: string | null, depth: number) => {
      const subGroups = itemGroups.filter(g => g.parent_group_id === parentId)
      subGroups.sort((a,b) => a.arabic_name.localeCompare(b.arabic_name)).forEach(g => {
        result.push({ 
          value: `group-${g.id}`, 
          label: '\u00a0'.repeat(depth * 3) + (depth > 0 ? '└ ' : '') + g.arabic_name, 
          isHeader: true 
        })
        const gItems = items.filter(it => it.item_group_id === g.id || it.item_group?.id === g.id)
        gItems.sort((a,b) => a.arabic_name.localeCompare(b.arabic_name)).forEach(it => {
          result.push({ 
            value: it.id, 
            label: '\u00a0'.repeat((depth + 1) * 3) + '└ ' + it.item_code + ' - ' + it.arabic_name 
          })
        })
        getChildren(g.id, depth + 1)
      })
    }
    getChildren(null, 0)
    const ungrouped = items.filter(it => !it.item_group_id && !it.item_group?.id)
    if (ungrouped.length > 0) {
      result.push({ value: 'header-ungrouped', label: 'أصناف غير مصنفة', isHeader: true })
      ungrouped.sort((a,b) => a.arabic_name.localeCompare(b.arabic_name)).forEach(it => {
        result.push({ value: it.id, label: `\u00a0\u00a0└ ${it.item_code} - ${it.arabic_name}` })
      })
    }
    return result
  })()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    
    if (sourceWarehouseId === destWarehouseId) {
      return setError('لا يمكن التحويل لنفس المخزن')
    }
    if (!selectedItem || !quantity || Number(quantity) <= 0) {
      return setError('رجاء إدخال صنف وكمية صحيحة')
    }
    if (availableQty !== null && Number(quantity) > availableQty) {
      return setError(`الكمية المطلوبة أكبر من الرصيد المتاح (${availableQty}) بالمخزن المختار!`)
    }

    setLoading(true)

    startTransition(async () => {
      try {
        const itemInfo = items.find(i => i.id === selectedItem)
        const headerData = {
          company_id: companyId,
          project_id: projectId || null,
          source_warehouse_id: sourceWarehouseId,
          destination_warehouse_id: destWarehouseId,
          document_no: docNo,
          transfer_date: transferDate,
          notes: notes || null,
          status: 'draft'
        }

        const lineData = [{
          item_id: selectedItem,
          unit_id: itemInfo?.primary_unit_id,
          quantity: Number(quantity),
          unit_cost: 0
        }]

        await createWarehouseTransfer({ header: headerData, lines: lineData })

        setIsOpen(false)
        router.refresh()
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء الحفظ')
      } finally {
        setLoading(false)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition font-bold shadow-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        إضافة إذن تحويل
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />

          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border text-right">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
              <div className="text-right w-full">
                <h2 className="text-xl font-bold text-white">إذن تحويل مخزني جديد</h2>
                <p className="mt-1 text-sm text-white/80">نقل أرصدة من مخزن إلى آخر وإصدار سند تحويل</p>
              </div>
              <button 
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute left-6 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                title="إغلاق"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30">
              <form onSubmit={onSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {error}
                  </div>
                )}

                {/* Basic Info Section */}
                <div className="bg-white rounded-xl border p-5 space-y-4 shadow-sm">
                  <h2 className="font-semibold text-gray-800">بيانات الإذن الأساسية</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">رقم الإذن المستندي</label>
                      <input
                        type="text"
                        value={docNo}
                        readOnly
                        className="w-full border rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ التحويل <span className="text-red-500">*</span></label>
                      <DatePicker
                        value={transferDate}
                        onChange={setTransferDate}
                        className="w-full *"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">من المخزن (المرسل) <span className="text-red-500">*</span></label>
                      <select
                        value={sourceWarehouseId}
                        onChange={e => setSourceWarehouseId(e.target.value)}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">اختر المخزن...</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.arabic_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">إلى المخزن (المستلم) <span className="text-red-500">*</span></label>
                      <select
                        value={destWarehouseId}
                        onChange={e => setDestWarehouseId(e.target.value)}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">اختر المخزن...</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.arabic_name}</option>)}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Items Section */}
                <div className="bg-white rounded-xl border p-5 space-y-4 shadow-sm">
                  <h2 className="font-semibold text-gray-800">الأصناف المحولة</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-gray-50 border border-gray-200 p-4 rounded-xl items-start">
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">الصنف <span className="text-red-500">*</span></label>
                      <CustomSelect
                        value={selectedItem}
                        onChange={setSelectedItem}
                        options={itemOptions}
                        placeholder="-- ابحث عن صنف --"
                        searchable={true}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <div className="flex justify-between items-end mb-1">
                        <label className="block text-xs font-medium text-gray-600">الكمية <span className="text-red-500">*</span></label>
                        {selectedItem && (
                          <span className={`text-[10px] font-bold ${availableQty !== null && availableQty > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            المتاح: {availableQty ?? 0}
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        required
                        placeholder="0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        dir="ltr"
                      />
                      {selectedItem && (
                        <div className="text-[10px] text-gray-500 font-medium mt-1">
                          الوحدة: {Array.isArray(items.find((i:any) => i.id === selectedItem)?.unit) 
                            ? (items.find((i:any) => i.id === selectedItem)?.unit as any)[0]?.arabic_name
                            : (items.find((i:any) => i.id === selectedItem)?.unit as any)?.arabic_name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border mt-6">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition text-sm font-semibold shadow-sm"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={loading || isPending}
                    className="w-full sm:w-auto flex justify-center items-center gap-2 px-8 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition text-sm font-bold shadow-sm"
                  >
                    {(loading || isPending) && (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {loading || isPending ? 'جاري الحفظ...' : 'حفظ الإذن'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
