'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { updateCutoverBatchStatus, lockCutoverBatch } from '@/actions/cutover'

interface Props {
  params: { id: string }
}

export default function CutoverReviewPage({ params }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [batch, setBatch] = useState<any>(null)
  const [totals, setTotals] = useState<any>({
    financials: 0,
    subcontractors: 0,
    suppliers: 0,
    owners: 0,
    warehouse: 0,
    custody: 0
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: b } = await supabase
        .from('cutover_batches')
        .select('*')
        .eq('project_id', params.id)
        .single()
        
      if (!b) {
        router.push(`/projects/${params.id}/cutover`)
        return
      }
      setBatch(b)

      // Parallel data fetch
      const [
        { data: fins },
        { data: subs },
        { data: sups },
        { data: owns },
        { data: whs },
        { data: cus }
      ] = await Promise.all([
        supabase.from('cutover_financial_balances').select('opening_amount').eq('batch_id', b.id),
        supabase.from('cutover_subcontractor_positions').select('outstanding_balance').eq('batch_id', b.id),
        supabase.from('cutover_supplier_positions').select('remaining_amount').eq('batch_id', b.id),
        supabase.from('cutover_owner_positions').select('remaining_receivable').eq('batch_id', b.id),
        supabase.from('cutover_warehouse_stock').select('opening_value').eq('batch_id', b.id),
        supabase.from('cutover_employee_custody').select('opening_balance').eq('batch_id', b.id),
      ])

      setTotals({
        financials: (fins || []).reduce((acc, curr) => acc + Number(curr.opening_amount), 0),
        subcontractors: (subs || []).reduce((acc, curr) => acc + Number(curr.outstanding_balance), 0),
        suppliers: (sups || []).reduce((acc, curr) => acc + Number(curr.remaining_amount), 0),
        owners: (owns || []).reduce((acc, curr) => acc + Number(curr.remaining_receivable), 0),
        warehouse: (whs || []).reduce((acc, curr) => acc + Number(curr.opening_value), 0),
        custody: (cus || []).reduce((acc, curr) => acc + Number(curr.opening_balance), 0),
      })

      setLoading(false)
    }
    load()
  }, [params.id, router])

  async function handleLock() {
    if (!batch) return
    if (!confirm('هل أنت متأكد من الاعتماد والقفل؟ لا يمكن التراجع عن هذا الإجراء وسيتم ترحيل البيانات إلى السجلات التشغيلية الحية.')) {
      return
    }

    setSaving(true)
    setError(null)
    
    try {
      // 1. Mark as approved to satisfy RPC constraints
      await updateCutoverBatchStatus(batch.id, params.id, 'approved')
      
      // 2. Lock and cascade via RPC
      await lockCutoverBatch(batch.id, params.id)
      
      // 3. Navigate away
      router.push(`/projects/${params.id}?msg=cutover_locked`)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء قفل الترحيل')
      // Try to revert approval status just in case
      try { await updateCutoverBatchStatus(batch.id, params.id, 'draft') } catch (e) {}
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-text-secondary">جاري تجميع البيانات للمراجعة...</div>

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary">المراجعة والاعتماد النهائي</h2>
        <p className="mt-1 text-sm text-text-secondary">
          يرجى مراجعة إجماليات الأرصدة والمواقف التي تم إدخالها. بمجرد الاعتماد والقفل، ستصبح هذه البيانات جزءاً من الدفاتر المباشرة ولا يمكن تعديلها.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          <strong>خطأ في الاعتماد:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { label: 'إجمالي الأرصدة المالية', value: totals.financials, color: 'text-primary' },
          { label: 'إجمالي الرصيد المستحق لمقاولي الباطن', value: totals.subcontractors, color: 'text-amber-600' },
          { label: 'إجمالي مديونيات الموردين', value: totals.suppliers, color: 'text-danger' },
          { label: 'إجمالي مستحقات المالك', value: totals.owners, color: 'text-success' },
          { label: 'إجمالي قيمة المخزون', value: totals.warehouse, color: 'text-navy' },
          { label: 'إجمالي أرصدة عهد الموظفين', value: totals.custody, color: 'text-primary' },
        ].map((item, i) => (
          <div key={i} className="rounded-xl border border-border bg-background-secondary p-5">
            <div className="text-sm text-text-secondary mb-1">{item.label}</div>
            <div className={`text-2xl font-bold ${item.color}`} dir="ltr">
              {Number(item.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-warning/30 bg-warning/10 p-5 mb-6">
        <h3 className="font-bold text-warning-dark">تأكيد القفل والاعتماد (Lock & Deploy)</h3>
        <p className="mt-2 text-sm text-warning-dark/80">
          بالضغط على "اعتماد وقفل الترحيل"، أنت تؤكد أن جميع البيانات المدرجة أعلاه تطابق الكشوفات والاعتمادات الورقية للمشروع.
          سيقوم النظام بقفل هذه الشاشات نهائياً ونسخ أرصدة المخازن والتشغيل إلى الجداول الأساسية لبدء العمل المباشر.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleLock}
          disabled={saving}
          className="rounded-lg bg-navy px-8 py-3 text-sm font-bold text-white hover:bg-navy/90 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? 'جارٍ القفل والترحيل للدفاتر...' : 'اعتماد وقفل الترحيل'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => router.push(`/projects/${params.id}/cutover/custody`)}
          className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
        >
          مراجعة الخطوة السابقة
        </button>
      </div>
    </div>
  )
}
