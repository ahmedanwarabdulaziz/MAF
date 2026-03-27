'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { saveOpeningFinancialBalances } from '@/actions/cutover'

interface Props {
  params: { id: string }
}

const ACCOUNT_TYPES = [
  { value: 'petty_cash', label: 'عهدة نقدية (Petty Cash)' },
  { value: 'treasury', label: 'خزينة (Treasury)' },
  { value: 'bank', label: 'بنك (Bank)' },
  { value: 'parent_funding', label: 'تمويل الشركة الأم (Parent Funding)' },
]

export default function CutoverFinancialsPage({ params }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [batchId, setBatchId] = useState<string | null>(null)
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
      
      const { data: balances } = await supabase
        .from('cutover_financial_balances')
        .select('*')
        .eq('batch_id', batch.id)
        
      if (balances && balances.length > 0) {
        setRows(balances)
      } else {
        // Add one empty row by default
        setRows([{ id: 'new-' + Date.now(), account_type: 'petty_cash', currency: 'EGP', opening_amount: '', notes: '' }])
      }
      setLoading(false)
    }
    load()
  }, [params.id, router])

  function addRow() {
    setRows([...rows, { id: 'new-' + Date.now(), account_type: 'petty_cash', currency: 'EGP', opening_amount: '', notes: '' }])
  }

  function removeRow(id: string) {
    setRows(rows.filter(r => r.id !== id))
  }

  function updateRow(id: string, field: string, value: string) {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!batchId) return
    setSaving(true)
    setError(null)
    
    try {
      const cleanRows = rows.map(r => ({
        account_type: r.account_type,
        currency: r.currency,
        opening_amount: Number(r.opening_amount) || 0,
        notes: r.notes || null
      }))
      
      await saveOpeningFinancialBalances(batchId, params.id, cleanRows)
      router.push(`/projects/${params.id}/cutover/subcontractors`)
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
          <h2 className="text-xl font-bold text-text-primary">الأرصدة المالية الافتتاحية</h2>
          <p className="mt-1 text-sm text-text-secondary">
            أدخل أرصدة الخزينة والبنوك والعهد النقدية الخاصة بالمشروع كما هي في تاريخ الترحيل.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg bg-background-secondary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
        >
          + إضافة رصيد
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
            لا توجد أرصدة مضافة. اضغط على "إضافة رصيد" للبدء.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold text-text-secondary w-64">نوع الحساب</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary w-24">العملة</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary w-48">المبلغ الافتتاحي</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">ملاحظات / مرجع</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="px-4 py-2">
                      <select
                        required
                        value={row.account_type}
                        onChange={e => updateRow(row.id, 'account_type', e.target.value)}
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                      >
                        {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        required
                        value={row.currency}
                        onChange={e => updateRow(row.id, 'currency', e.target.value)}
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                      >
                        <option value="EGP">EGP</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={row.opening_amount}
                        onChange={e => updateRow(row.id, 'opening_amount', e.target.value)}
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                        dir="ltr"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={row.notes}
                        onChange={e => updateRow(row.id, 'notes', e.target.value)}
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                        placeholder="رقم حساب بنكي / مرجع..."
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
            onClick={() => router.push(`/projects/${params.id}/cutover`)}
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            السابق
          </button>
        </div>
      </form>
    </div>
  )
}
