'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  getCertificateDetails, 
  getCertificateBOQGrid, 
  saveCertificateLines,
  submitCertificateForApproval,
  approveCertificate
} from '@/actions/certificates'

export default function CertificateDetailsPage({ params }: { params: { id: string, cert_id: string } }) {
  const router = useRouter()

  const [cert, setCert] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [params.cert_id])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const c = await getCertificateDetails(params.cert_id)
      setCert(c)
      
      const boqGrid = await getCertificateBOQGrid(c.subcontract_agreement_id, c.id)
      setLines(boqGrid || [])
    } catch (err: any) {
      setError('خطأ في تحميل بيانات المستخلص: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveLines() {
    setSaving(true)
    setError(null)
    try {
      await saveCertificateLines(cert.id, cert.subcontract_agreement_id, lines)
      alert('تم حفظ الكميات وإعادة حساب إجماليات المستخلص بنجاح.')
      await load() // refresh to sync calculated totals
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ البنود')
    } finally {
      setSaving(false)
    }
  }

  async function handleAction(action: 'submit' | 'approve') {
    if (!confirm(action === 'submit' ? 'هل أنت متأكد من تقديم المستخلص للاعتماد؟ لا يمكن تعديل الكميات بعد ذلك.' : 'هل أنت متأكد من الاعتماد النهائي للمستخلص؟')) return

    setSaving(true)
    setError(null)
    try {
      if (action === 'submit') {
        await submitCertificateForApproval(cert.id, params.id)
      } else if (action === 'approve') {
        await approveCertificate(cert.id, params.id)
      }
      await load()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تنفيذ الإجراء')
    } finally {
      setSaving(false)
    }
  }

  function updateQuantity(index: number, qty: number) {
    const list = [...lines]
    list[index].current_quantity = qty
    setLines(list)
  }

  function updateTotalLineOverrides(index: number, field: string, val: any) {
    const list = [...lines]
    list[index][field] = val
    setLines(list)
  }

  if (loading) return <div className="text-sm text-text-secondary">جاري تحميل المستخلص...</div>
  if (!cert) return <div className="text-sm text-danger">المستخلص غير موجود.</div>

  const isEditable = cert.status === 'draft'
  const canApprove = (cert.status === 'pending_approval' || cert.status === 'draft')

  return (
    <div className="space-y-6 pb-24">
      {/* HEADER NAV */}
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <Link href={`/projects/${params.id}/certificates`} className="hover:text-primary transition-colors">مستخلصات مقاولي الباطن</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">{cert.certificate_no}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            مستخلص رقم: <span className="font-mono text-navy">{cert.certificate_no}</span>
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            المقاول: {Array.isArray(cert.subcontractor) ? cert.subcontractor[0]?.arabic_name : cert.subcontractor?.arabic_name} | 
            العقد: {Array.isArray(cert.agreement) ? cert.agreement[0]?.agreement_code : cert.agreement?.agreement_code}
          </p>
        </div>
        
        {/* ACTIONS */}
        <div className="flex items-center gap-3">
          {cert.status === 'draft' && (
            <button
              onClick={() => handleAction('submit')}
              disabled={saving}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              تقديم للاعتماد
            </button>
          )}
          {canApprove && (
            <button
              onClick={() => handleAction('approve')}
              disabled={saving}
              className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90 transition-colors disabled:opacity-50"
            >
              اعتماد نهائي (Approve)
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* DASHBOARD WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">حالة المستخلص</p>
          <p className="text-lg font-bold text-text-primary">
            {cert.status === 'draft' ? 'مسودة (Draft)' : 
             cert.status === 'pending_approval' ? 'بانتظار الاعتماد' : 
             cert.status === 'approved' ? 'معتمد' : 'مغلق'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">الإجمالي (Gross)</p>
          <p className="text-xl font-bold text-navy dir-ltr text-right">{Number(cert.gross_amount).toLocaleString()} ج.م</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1 cursor-help" title="إجمالي الاستقطاعات والتعليات">الخصومات (Ta'liya & Deds)</p>
          <p className="text-xl font-bold text-danger dir-ltr text-right">
            {(Number(cert.taaliya_amount) + Number(cert.other_deductions_amount)).toLocaleString()} ج.م
          </p>
        </div>
        <div className="rounded-xl border border-success bg-success/5 p-5 shadow-sm">
          <p className="text-xs font-semibold text-success mb-1">الصافي للدفع (Net Payable)</p>
          <p className="text-2xl font-black text-success dir-ltr text-right">{Number(cert.net_amount).toLocaleString()} ج.م</p>
        </div>
      </div>

      {/* BOQ GRID */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">دفتر حصر الكميات (B.O.Q Ledger)</h2>
          <div className="text-sm text-text-tertiary">
            فترة التنفيذ: <span className="dir-ltr inline-block">{cert.period_from || '---'} : {cert.period_to || '---'}</span>
          </div>
        </div>

        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-background-secondary border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold text-text-secondary"># الكود</th>
                <th className="px-4 py-3 font-semibold text-text-secondary min-w-[200px]">وصف البند</th>
                <th className="px-4 py-3 font-semibold text-text-secondary">الوحدة</th>
                <th className="px-4 py-3 font-semibold text-text-secondary">فئة (السعر)</th>
                <th className="px-4 py-3 font-semibold text-text-secondary border-r border-border bg-green-50/50">كمية سابقة</th>
                <th className="px-4 py-3 font-semibold text-navy border-r border-border bg-blue-50/50">الكمية الحالية</th>
                <th className="px-4 py-3 font-semibold text-text-primary border-r border-border bg-slate-50">الإجمالي التراكمي</th>
                <th className="px-4 py-3 font-semibold text-amber-600 border-r border-border">تعلية الخط (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-background-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-text-secondary">{line.item_code || '---'}</td>
                  <td className="px-4 py-3 whitespace-normal min-w-[200px] text-text-primary">{line.item_desc}</td>
                  <td className="px-4 py-3 text-text-secondary">{line.unit_name}</td>
                  <td className="px-4 py-3 font-bold text-navy dir-ltr text-right">{line.agreed_rate.toLocaleString()}</td>
                  
                  {/* Previous */}
                  <td className="px-4 py-3 text-text-secondary border-r border-border bg-green-50/30 font-medium dir-ltr text-right">
                    {line.previous_quantity}
                  </td>
                  
                  {/* Current Entry */}
                  <td className="px-4 py-2 border-r border-border bg-blue-50/30">
                    <input
                      type="number"
                      step="0.01"
                      disabled={!isEditable}
                      value={line.current_quantity === 0 ? '' : line.current_quantity}
                      onChange={e => updateQuantity(idx, Number(e.target.value))}
                      placeholder="0"
                      className="w-24 rounded border border-border/50 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary font-bold text-navy disabled:bg-transparent disabled:border-transparent text-right dir-ltr"
                    />
                  </td>
                  
                  {/* Cumulative */}
                  <td className="px-4 py-3 font-bold text-text-primary border-r border-border bg-slate-50/50 dir-ltr text-right">
                    {(Number(line.previous_quantity) + Number(line.current_quantity)).toFixed(2)}
                  </td>

                  {/* Settings Override */}
                  <td className="px-4 py-2 border-r border-border">
                    <div className="flex items-center gap-1 w-24">
                      <input
                        type="number"
                        step="0.01"
                        disabled={!isEditable}
                        value={line.taaliya_value}
                        onChange={e => updateTotalLineOverrides(idx, 'taaliya_value', Number(e.target.value))}
                        className="w-full rounded border border-border/50 bg-transparent px-2 py-1 text-xs outline-none focus:border-amber-500 text-amber-700 disabled:border-transparent dir-ltr text-right"
                      />
                      <span className="text-xs text-amber-700">
                        {line.taaliya_type === 'percentage' ? '%' : 'ثابت'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isEditable && (
          <div className="p-4 bg-background-secondary/50 border-t border-border flex justify-end">
            <button
              onClick={handleSaveLines}
              disabled={saving}
              className="rounded-lg bg-primary px-8 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ الكميات وحساب المستخلص'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
