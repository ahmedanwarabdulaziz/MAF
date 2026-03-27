'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createWarehouseTransfer } from '@/actions/warehouse'
import DatePicker from '@/components/DatePicker'

interface TransferFormProps {
  companyId: string
  warehouses: { id: string; arabic_name: string; warehouse_type: string }[]
  items: { 
    id: string; 
    item_code: string; 
    arabic_name: string; 
    primary_unit_id: string; 
    units: any 
  }[]
  projectId?: string
  returnUrl?: string
}

export default function TransferForm({ companyId, warehouses, items, projectId, returnUrl = '/company/main_warehouse/transfers' }: TransferFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Single line state for simplicity in this phase
  const [selectedItem, setSelectedItem] = useState('')
  const [quantity, setQuantity] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    
    try {
      if (!selectedItem || !quantity || Number(quantity) <= 0) {
        throw new Error('رجاء إدخال صنف وكمية صحيحة')
      }

      const itemInfo = items.find(i => i.id === selectedItem)
      
      const headerData = {
        company_id: companyId,
        project_id: projectId || null,
        source_warehouse_id: formData.get('source_warehouse_id') as string,
        destination_warehouse_id: formData.get('destination_warehouse_id') as string,
        document_no: formData.get('document_no') as string,
        transfer_date: formData.get('transfer_date') as string,
        notes: (formData.get('notes') as string) || null,
        status: 'draft' // Always draft on creation
      }

      if (headerData.source_warehouse_id === headerData.destination_warehouse_id) {
        throw new Error('لا يمكن التحويل لنفس المخزن')
      }

      const lineData = [{
        item_id: selectedItem,
        unit_id: itemInfo?.primary_unit_id,
        quantity: Number(quantity),
        unit_cost: 0 // In real system, this comes from stock_balances or allows edit
      }]

      await createWarehouseTransfer({ header: headerData, lines: lineData })

      router.push(returnUrl)
      router.refresh()
    } catch (err: any) {
      console.error('Error creating transfer:', err)
      setError(err.message || 'حدث خطأ أثناء الحفظ')
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      {error && (
        <div className="mb-6 rounded-lg bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-8">
        {/* Header section */}
        <div>
          <h3 className="text-sm font-bold text-text-primary mb-4 pb-2 border-b border-border">بيانات الإذن الأساسية</h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="document_no" className="text-sm font-medium text-text-primary">
                رقم الإذن المستندي <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="document_no"
                name="document_no"
                required
                className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                dir="ltr"
                placeholder="e.g. TR-2026-001"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="transfer_date" className="text-sm font-medium text-text-primary">
                تاريخ التحويل <span className="text-danger">*</span>
              </label>
              <DatePicker
                name="transfer_date"
                defaultValue={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="source_warehouse_id" className="text-sm font-medium text-text-primary">
                من المخزن (المرسل) <span className="text-danger">*</span>
              </label>
              <select
                id="source_warehouse_id"
                name="source_warehouse_id"
                required
                className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">اختر المخزن...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.arabic_name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="destination_warehouse_id" className="text-sm font-medium text-text-primary">
                إلى المخزن (المستلم) <span className="text-danger">*</span>
              </label>
              <select
                id="destination_warehouse_id"
                name="destination_warehouse_id"
                required
                className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">اختر المخزن...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.arabic_name}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <label htmlFor="notes" className="text-sm font-medium text-text-primary">
                ملاحظات
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Lines section (Simplified for single item) */}
        <div>
          <h3 className="text-sm font-bold text-text-primary mb-4 pb-2 border-b border-border">الأصناف المحولة</h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                الصنف <span className="text-danger">*</span>
              </label>
              <select
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
                required
                className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">اختر الصنف...</option>
                {items.map(i => (
                  <option key={i.id} value={i.id}>{i.item_code} - {i.arabic_name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                الكمية <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                min="0.0001"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                dir="ltr"
              />
              {selectedItem && (
                <div className="text-xs text-text-secondary mt-1">
                  الوحدة: {Array.isArray(items.find(i => i.id === selectedItem)?.units) 
                    ? (items.find(i => i.id === selectedItem)?.units as any)[0]?.arabic_name
                    : (items.find(i => i.id === selectedItem)?.units as any)?.arabic_name}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Link
            href="/company/main_warehouse/transfers"
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'جاري الحفظ...' : 'حفظ كمسودة وإصدار'}
          </button>
        </div>
      </form>
    </div>
  )
}
