'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { saveOpeningSupplierPositions } from '@/actions/cutover'
import DatePicker from '@/components/DatePicker'

interface Props {
  params: { id: string }
}

export default function CutoverSuppliersPage({ params }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [batchId, setBatchId] = useState<string | null>(null)
  const [parties, setParties] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: batch } = await supabase
        .from('cutover_batches')
        .select('id')
        .eq('project_id', params.id)
        .single()
        
      if (!batch) {
        router.push(`/projects/${params.id}/cutover`)
        return
      }
      
      setBatchId(batch.id)

      // Load all parties to use as suppliers
      const { data: pts } = await supabase.from('parties').select('id, arabic_name')
      if (pts) setParties(pts)
      
      const { data: positions } = await supabase
        .from('cutover_supplier_positions')
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
      supplier_id: '', 
      open_invoice_number: '', 
      invoice_date: '', 
      gross_invoice_amount: 0, 
      paid_amount: 0, 
      remaining_amount: 0,
      advance_paid: 0
    }])
  }

  function removeRow(id: string) {
    setRows(rows.filter(r => r.id !== id))
  }

  function updateRow(id: string, field: string, value: any) {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!batchId) return
    setSaving(true)
    setError(null)
    
    try {
      const cleanRows = rows.map(r => ({
        supplier_id: r.supplier_id,
        open_invoice_number: r.open_invoice_number || null,
        invoice_date: r.invoice_date || null,
        gross_invoice_amount: Number(r.gross_invoice_amount) || 0,
        paid_amount: Number(r.paid_amount) || 0,
        remaining_amount: Number(r.remaining_amount) || 0,
        advance_paid: Number(r.advance_paid) || 0
      }))
      
      await saveOpeningSupplierPositions(batchId, params.id, cleanRows)
      router.push(`/projects/${params.id}/cutover/owner`)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-text-secondary">جاري التحميل...</div>

  return (
    <div className="max-w-full">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">أرصدة الموردين</h2>
          <p className="mt-1 text-sm text-text-secondary">
            أدخل فواتير الموردين المفتوحة غير المسددة بالكامل وأرصدة الدفعات المقدمة (السلف).
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg bg-background-secondary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
        >
          + إضافة مورد
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
            لا توجد مواقف للموردين. اضغط على "إضافة مورد" للبدء أو تخطى هذه الخطوة.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto hide-scrollbar">
            <table className="w-full text-right text-sm whitespace-nowrap">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold text-text-secondary w-48">المورد</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">رقم الفاتورة المفتوحة</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">تاريخ الفاتورة</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-navy">الإجمالي</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-success">المسدد منها</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-danger">المتبقي (المديونية)</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-amber-600">دفعات مقدمة (سلف)</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="px-4 py-2">
                      <select
                        required
                        value={row.supplier_id}
                        onChange={e => updateRow(row.id, 'supplier_id', e.target.value)}
                        className="w-full min-w-[150px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                      >
                        <option value="" disabled>اختر...</option>
                        {parties.map(p => <option key={p.id} value={p.id}>{p.arabic_name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={row.open_invoice_number}
                        onChange={e => updateRow(row.id, 'open_invoice_number', e.target.value)}
                        className="w-full min-w-[120px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                        placeholder="INV-001..."
                      />
                    </td>
                    <td className="px-4 py-2">
                      <DatePicker
                        value={row.invoice_date}
                        onChange={val => updateRow(row.id, 'invoice_date', val)}
                        className="min-w-[160px]"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={row.gross_invoice_amount} onChange={e => updateRow(row.id, 'gross_invoice_amount', e.target.value)} className="w-full min-w-[100px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary font-semibold text-navy" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={row.paid_amount} onChange={e => updateRow(row.id, 'paid_amount', e.target.value)} className="w-full min-w-[100px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={row.remaining_amount} onChange={e => updateRow(row.id, 'remaining_amount', e.target.value)} className="w-full min-w-[100px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary font-semibold text-danger" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={row.advance_paid} onChange={e => updateRow(row.id, 'advance_paid', e.target.value)} className="w-full min-w-[100px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" dir="ltr" />
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
            disabled={saving}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ ومتابعة'}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/projects/${params.id}/cutover/subcontractors`)}
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            السابق
          </button>
        </div>
      </form>
    </div>
  )
}
