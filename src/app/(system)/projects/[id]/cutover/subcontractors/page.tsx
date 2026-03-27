'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { saveOpeningSubcontractorPositions } from '@/actions/cutover'

interface Props {
  params: { id: string }
}

export default function CutoverSubcontractorsPage({ params }: Props) {
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

      // Load all parties to use as subcontractors
      const { data: pts } = await supabase.from('parties').select('id, arabic_name')
      if (pts) setParties(pts)
      
      const { data: positions } = await supabase
        .from('cutover_subcontractor_positions')
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
      party_id: '', 
      work_item_name: '', 
      unit: 'مقطوعية', 
      previous_qty: 0, 
      cumulative_qty: 0, 
      agreed_rate: 0,
      gross_certified_amount: 0,
      retention_balance: 0,
      other_deductions_balance: 0,
      advance_balance: 0,
      paid_to_date: 0,
      outstanding_balance: 0,
      notes: '' 
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
        party_id: r.party_id,
        work_item_name: r.work_item_name || null,
        unit: r.unit || null,
        previous_qty: Number(r.previous_qty) || 0,
        cumulative_qty: Number(r.cumulative_qty) || 0,
        agreed_rate: Number(r.agreed_rate) || 0,
        gross_certified_amount: Number(r.gross_certified_amount) || 0,
        retention_balance: Number(r.retention_balance) || 0,
        other_deductions_balance: Number(r.other_deductions_balance) || 0,
        advance_balance: Number(r.advance_balance) || 0,
        paid_to_date: Number(r.paid_to_date) || 0,
        outstanding_balance: Number(r.outstanding_balance) || 0,
        notes: r.notes || null
      }))
      
      await saveOpeningSubcontractorPositions(batchId, params.id, cleanRows)
      router.push(`/projects/${params.id}/cutover/suppliers`)
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
          <h2 className="text-xl font-bold text-text-primary">أرصدة مقاولي الباطن</h2>
          <p className="mt-1 text-sm text-text-secondary">
            أدخل المواقف المالية والتشغيلية المفتوحة لمقاولي الباطن كما هي مسجلة في آخر مستخلص قبل القطع.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg bg-background-secondary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
        >
          + إضافة مقاول
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
            لا توجد مواقف لمقاولي الباطن. اضغط على "إضافة مقاول" للبدء أو تخطى هذه الخطوة.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto hide-scrollbar">
            <table className="w-full text-right text-sm whitespace-nowrap">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold text-text-secondary w-48">المقاول</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">بند الأعمال</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">الوحدة</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">الكمية السابقة</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">الكمية التراكمية</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">الفئة</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-navy">إجمالي الأعمال</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-amber-600">رصيد التعلية</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-amber-600">استقطاعات أخرى</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-danger">رصيد الدفعات (سلف)</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-danger">مدفوعات أخرى سابقة</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-success">الرصيد المستحق</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">ملاحظات</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="px-4 py-2">
                      <select
                        required
                        value={row.party_id}
                        onChange={e => updateRow(row.id, 'party_id', e.target.value)}
                        className="w-full min-w-[150px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                      >
                        <option value="" disabled>اختر...</option>
                        {parties.map(p => <option key={p.id} value={p.id}>{p.arabic_name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={row.work_item_name}
                        onChange={e => updateRow(row.id, 'work_item_name', e.target.value)}
                        className="w-full min-w-[120px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                        placeholder="أعمال الحفر..."
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={row.unit}
                        onChange={e => updateRow(row.id, 'unit', e.target.value)}
                        className="w-full min-w-[80px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={row.previous_qty} onChange={e => updateRow(row.id, 'previous_qty', e.target.value)} className="w-full min-w-[80px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={row.cumulative_qty} onChange={e => updateRow(row.id, 'cumulative_qty', e.target.value)} className="w-full min-w-[80px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={row.agreed_rate} onChange={e => updateRow(row.id, 'agreed_rate', e.target.value)} className="w-full min-w-[80px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={row.gross_certified_amount} onChange={e => updateRow(row.id, 'gross_certified_amount', e.target.value)} className="w-full min-w-[100px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary text-navy font-semibold" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={row.retention_balance} onChange={e => updateRow(row.id, 'retention_balance', e.target.value)} className="w-full min-w-[100px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={row.other_deductions_balance} onChange={e => updateRow(row.id, 'other_deductions_balance', e.target.value)} className="w-full min-w-[100px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={row.advance_balance} onChange={e => updateRow(row.id, 'advance_balance', e.target.value)} className="w-full min-w-[100px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={row.paid_to_date} onChange={e => updateRow(row.id, 'paid_to_date', e.target.value)} className="w-full min-w-[100px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={row.outstanding_balance} onChange={e => updateRow(row.id, 'outstanding_balance', e.target.value)} className="w-full min-w-[100px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary text-success font-semibold" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={row.notes}
                        onChange={e => updateRow(row.id, 'notes', e.target.value)}
                        className="w-full min-w-[150px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                        placeholder="رقم المستخلص..."
                      />
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
            onClick={() => router.push(`/projects/${params.id}/cutover/financials`)}
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            السابق
          </button>
        </div>
      </form>
    </div>
  )
}
