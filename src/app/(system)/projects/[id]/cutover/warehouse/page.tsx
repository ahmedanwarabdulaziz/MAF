'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { saveOpeningStock } from '@/actions/cutover'

interface Props {
  params: { id: string }
}

export default function CutoverWarehousePage({ params }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [batchId, setBatchId] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: batch } = await supabase
        .from('cutover_batches')
        .select('id, company_id')
        .eq('project_id', params.id)
        .single()
        
      if (!batch) {
        router.push(`/projects/${params.id}/cutover`)
        return
      }
      
      setBatchId(batch.id)

      // Load related project warehouses
      const { data: whs } = await supabase.from('warehouses')
        .select('id, arabic_name')
        .eq('project_id', params.id)
        
      if (whs) setWarehouses(whs)

      // Load items
      const { data: itms } = await supabase.from('items').select('id, arabic_name, primary_unit')
      if (itms) setItems(itms)
      
      const { data: positions } = await supabase
        .from('cutover_warehouse_stock')
        .select('*')
        .eq('batch_id', batch.id)
        
      if (positions && positions.length > 0) {
        setRows(positions)
      }
      setLoading(false)
    }
    load()
  }, [params.id, router])

  function addRow() {
    setRows([...rows, { 
      id: 'new-' + Date.now(), 
      warehouse_id: '', 
      item_id: '', 
      opening_quantity: 0, 
      unit_cost: 0, 
      opening_value: 0
    }])
  }

  function removeRow(id: string) {
    setRows(rows.filter(r => r.id !== id))
  }

  function updateRow(id: string, field: string, value: any) {
    setRows(rows => rows.map(r => {
      if (r.id !== id) return r
      const newRow = { ...r, [field]: value }
      
      // Auto-calculate value if qty or cost changes
      if (field === 'opening_quantity' || field === 'unit_cost') {
        const qty = field === 'opening_quantity' ? Number(value) : Number(newRow.opening_quantity)
        const cost = field === 'unit_cost' ? Number(value) : Number(newRow.unit_cost)
        newRow.opening_value = qty * cost
      }
      return newRow
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!batchId) return
    setSaving(true)
    setError(null)
    
    try {
      const cleanRows = rows.map(r => ({
        warehouse_id: r.warehouse_id,
        item_id: r.item_id,
        opening_quantity: Number(r.opening_quantity) || 0,
        unit_cost: Number(r.unit_cost) || 0,
        opening_value: Number(r.opening_value) || 0
      }))
      
      await saveOpeningStock(batchId, params.id, cleanRows)
      router.push(`/projects/${params.id}/cutover/custody`)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-text-secondary">جاري التحميل...</div>

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">مخزون المستودعات</h2>
          <p className="mt-1 text-sm text-text-secondary">
            أدخل أرصدة المخزون الموجودة فعلياً في المستودعات التابعة للمشروع بتاريخ الترحيل.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg bg-background-secondary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
        >
          + إضافة صنف
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-text-secondary">
            لا يوجد مخزون مسجل للترحيل. اضغط على "إضافة صنف" للبدء أو تخطى إذا لم تكن هناك مستودعات.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto hide-scrollbar">
            <table className="w-full text-right text-sm">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold text-text-secondary w-48">المستودع</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary w-48">الصنف</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">الكمية</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">متوسط التكلفة للوحدة</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-navy">القيمة الإجمالية</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="px-4 py-2">
                      <select
                        required
                        value={row.warehouse_id}
                        onChange={e => updateRow(row.id, 'warehouse_id', e.target.value)}
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                      >
                        <option value="" disabled>اختر المستودع...</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.arabic_name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        required
                        value={row.item_id}
                        onChange={e => updateRow(row.id, 'item_id', e.target.value)}
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                      >
                        <option value="" disabled>اختر الصنف...</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.arabic_name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.0001" required value={row.opening_quantity} onChange={e => updateRow(row.id, 'opening_quantity', e.target.value)} className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" required value={row.unit_cost} onChange={e => updateRow(row.id, 'unit_cost', e.target.value)} className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" required value={row.opening_value} onChange={e => updateRow(row.id, 'opening_value', e.target.value)} className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary font-semibold text-navy bg-background-secondary" dir="ltr" />
                    </td>
                    <td className="px-4 py-2 text-left">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="text-text-tertiary hover:text-danger transition-colors p-1"
                        title="حذف"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-3 pt-4">
          <button
            type="submit"
            disabled={saving || warehouses.length === 0}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ ومتابعة'}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/projects/${params.id}/cutover/owner`)}
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            السابق
          </button>
        </div>
      </form>
    </div>
  )
}
