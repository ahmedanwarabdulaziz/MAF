'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { saveOpeningEmployeeCustody } from '@/actions/cutover'

interface Props {
  params: { id: string }
}

export default function CutoverCustodyPage({ params }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [batchId, setBatchId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<any[]>([])
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

      // Only load users scoped to this company or project
      const { data: users } = await supabase.from('users').select('id, full_name, email')
      if (users) setEmployees(users)
      
      const { data: positions } = await supabase
        .from('cutover_employee_custody')
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
      employee_id: '', 
      custody_account_type: 'عهدة مستديمة', 
      allowed_negative_limit: 0, 
      opening_balance: 0, 
      temporary_advance_balance: 0,
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
        employee_id: r.employee_id,
        custody_account_type: r.custody_account_type || null,
        allowed_negative_limit: Number(r.allowed_negative_limit) || 0,
        opening_balance: Number(r.opening_balance) || 0,
        temporary_advance_balance: Number(r.temporary_advance_balance) || 0,
        notes: r.notes || null
      }))
      
      await saveOpeningEmployeeCustody(batchId, params.id, cleanRows)
      router.push(`/projects/${params.id}/cutover/review`)
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
          <h2 className="text-xl font-bold text-text-primary">عهد الموظفين (Custody)</h2>
          <p className="mt-1 text-sm text-text-secondary">
            قم بإدخال أرصدة العهد النقدية للموظفين (المستديمة أو المؤقتة) كما هي في تاريخ الترحيل.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg bg-background-secondary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
        >
          + إضافة عهدة
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
            لا توجد عهد لموظفين للترحيل. اصغط على "إضافة عهدة" أو تخطى إذا لم يكن هناك عهد نقدية.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto hide-scrollbar">
            <table className="w-full text-right text-sm whitespace-nowrap">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold text-text-secondary w-48">الموظف (صاحب العهدة)</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary w-32">نوع الحساب</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">الحد الائتماني المسموح</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-primary">الرصيد الافتتاحي (عهدة قائمة)</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-amber-600">سلف مؤقتة غير مسددة</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">ملاحظات والتسويات المعلقة</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="px-4 py-2">
                      <select
                        required
                        value={row.employee_id}
                        onChange={e => updateRow(row.id, 'employee_id', e.target.value)}
                        className="w-full min-w-[150px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                      >
                        <option value="" disabled>اختر الموظف...</option>
                        {employees.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={row.custody_account_type}
                        onChange={e => updateRow(row.id, 'custody_account_type', e.target.value)}
                        className="w-full min-w-[100px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={row.allowed_negative_limit} onChange={e => updateRow(row.id, 'allowed_negative_limit', e.target.value)} className="w-full min-w-[90px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" required value={row.opening_balance} onChange={e => updateRow(row.id, 'opening_balance', e.target.value)} className="w-full min-w-[90px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary font-semibold text-primary" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" required value={row.temporary_advance_balance} onChange={e => updateRow(row.id, 'temporary_advance_balance', e.target.value)} className="w-full min-w-[90px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary font-semibold text-amber-600 bg-background-secondary" dir="ltr" />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={row.notes}
                        onChange={e => updateRow(row.id, 'notes', e.target.value)}
                        className="w-full min-w-[120px] rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                        placeholder="فواتير لم تُرصد... الخ"
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
            onClick={() => router.push(`/projects/${params.id}/cutover/warehouse`)}
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            السابق
          </button>
        </div>
      </form>
    </div>
  )
}
