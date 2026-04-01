'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getOwnerCollections } from '@/actions/owner_billing'
import NewCollectionModal from './NewCollectionModal'

export default function CollectionsDashboard({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [collections, setCollections] = useState<any[]>([])
  const [summary,     setSummary]     = useState({ billed: 0, collected: 0, outstanding: 0 })
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)

  useEffect(() => { loadData() }, [params.id])

  async function loadData() {
    setLoading(true)
    try {
      const db = createClient()

      // 1. Totals from owner_billing_documents (approved)
      const { data: docs } = await db
        .from('owner_billing_documents')
        .select('net_amount, status')
        .eq('project_id', params.id)
        .in('status', ['approved', 'paid'])

      const totalBilled = (docs || []).reduce((s, d) => s + Number(d.net_amount || 0), 0)

      // 2. Collections
      const cols = await getOwnerCollections(params.id)
      const totalCollected = (cols || []).reduce((s, c) => s + Number(c.received_amount || 0), 0)

      setCollections(cols || [])
      setSummary({
        billed:      totalBilled,
        collected:   totalCollected,
        outstanding: totalBilled - totalCollected,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleModalClose = () => {
    setShowModal(false)
    startTransition(() => { loadData() })
  }

  const totalCollected = summary.collected

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">التحصيلات النقدية والبنكية</h1>
          <p className="mt-1 text-sm text-text-secondary">متابعة الموقف المالي وحركة التحصيل لمديونية المالك.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-primary/90 hover:-translate-y-0.5 transition-all flex items-center gap-2"
        >
          <span className="text-lg font-bold">+</span> تسجيل تحصيل جديد
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-text-secondary mb-1">إجمالي الفواتير المعتمدة</p>
          <div className="text-2xl font-bold text-navy dir-ltr text-right">
            {summary.billed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-text-secondary mb-1">المُحصَّل الفعلي</p>
          <div className="text-2xl font-bold text-success dir-ltr text-right">
            {totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className={`rounded-xl border p-6 shadow-sm ${summary.outstanding > 0 ? 'bg-amber-50 border-amber-200' : 'bg-success/5 border-success/20'}`}>
          <p className={`text-sm font-medium mb-1 ${summary.outstanding > 0 ? 'text-amber-800' : 'text-success'}`}>المستحق / المديونية</p>
          <div className={`text-2xl font-bold dir-ltr text-right ${summary.outstanding > 0 ? 'text-amber-700' : 'text-success'}`}>
            {summary.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Ledger History */}
      <div>
        <h2 className="text-lg font-bold text-text-primary mb-3">سجل حركة التحصيلات</h2>
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
              <p className="text-text-secondary text-sm">جاري التحميل...</p>
            </div>
          ) : collections.length === 0 ? (
            <div className="py-12 text-center text-text-secondary">لا توجد عمليات تحصيل مسجلة بعد.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-background-secondary border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-text-secondary">تاريخ الحركة</th>
                    <th className="px-4 py-3 font-semibold text-text-secondary">المبلغ المُحصَّل</th>
                    <th className="px-4 py-3 font-semibold text-text-secondary">طريقة الدفع</th>
                    <th className="px-4 py-3 font-semibold text-text-secondary">المرجع</th>
                    <th className="px-4 py-3 font-semibold text-text-secondary">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {collections.map((col) => {
                    const doc = Array.isArray(col.document) ? col.document[0] : col.document
                    const isAdvance = col.collection_type === 'advance'
                    return (
                      <tr key={col.id} className="hover:bg-background-secondary/40 transition-colors">
                        <td className="px-4 py-3 text-text-secondary dir-ltr text-right">{col.received_date}</td>
                        <td className="px-4 py-3 dir-ltr text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isAdvance && (
                              <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full border border-amber-300">
                                دفعة مقدمة
                              </span>
                            )}
                            <span className={`font-bold ${isAdvance ? 'text-amber-600' : 'text-success'}`}>
                              {Number(col.received_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-primary">
                          {col.payment_method === 'bank_transfer' ? 'حوالة بنكية' :
                           col.payment_method === 'cash'          ? 'نقدي' :
                           col.payment_method === 'cheque'        ? 'شيك بنكي' : col.payment_method}
                        </td>
                        <td className="px-4 py-3 text-text-secondary dir-ltr">{col.reference_no || '—'}</td>
                        <td className="px-4 py-3 text-text-secondary text-xs max-w-xs truncate">{col.notes || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <NewCollectionModal
        projectId={params.id}
        isOpen={showModal}
        onClose={handleModalClose}
      />
    </div>
  )
}
