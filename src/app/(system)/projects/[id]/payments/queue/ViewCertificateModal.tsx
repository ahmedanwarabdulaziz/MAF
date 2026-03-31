'use client'

import { useState } from 'react'
import { getCertificateDetails, getCertificateBOQGrid } from '@/actions/certificates'

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
)

export default function ViewCertificateModal({ certId, agreementId }: { certId: string, agreementId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [cert, setCert] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const handleOpen = async () => {
    setIsOpen(true)
    if (!cert) {
      setLoading(true)
      try {
        const c = await getCertificateDetails(certId)
        setCert(c)
        const boqData = await getCertificateBOQGrid(agreementId, certId)
        setLines(boqData || [])
      } catch (err: any) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        title="عرض تفاصيل المستخلص"
        className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors border border-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.05)_inset]"
      >
        <EyeIcon />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />
          
          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border text-right" dir="rtl">
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  تفاصيل المستخلص <span className="font-mono text-white/90 text-sm">{cert?.certificate_no || '...'}</span>
                </h2>
              </div>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-2 text-white/80 hover:bg-white/10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30">
              {loading ? (
                <div className="py-12 text-center text-text-secondary animate-pulse">جاري تحميل البيانات...</div>
              ) : !cert ? (
                <div className="text-sm text-danger text-center">تعذر التحميل</div>
              ) : (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold text-text-secondary mb-1">المقاول</p>
                      <p className="text-sm font-bold text-text-primary">
                        {Array.isArray(cert.subcontractor) ? cert.subcontractor[0]?.arabic_name : cert.subcontractor?.arabic_name || 'غير متوفر'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold text-text-secondary mb-1">الإجمالي (Gross)</p>
                      <p className="text-xl font-bold text-navy dir-ltr text-right">{Number(cert.gross_amount).toLocaleString()} ج.م</p>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold text-text-secondary mb-1">إجمالي الخصومات</p>
                      <p className="text-xl font-bold text-danger dir-ltr text-right">
                        {(Number(cert.taaliya_amount) + Number(cert.other_deductions_amount)).toLocaleString()} ج.م
                      </p>
                    </div>
                    <div className="rounded-xl border border-success bg-success/5 p-5 shadow-sm">
                      <p className="text-xs font-semibold text-success mb-1">الصافي (Net Payable)</p>
                      <p className="text-2xl font-black text-success dir-ltr text-right">{Number(cert.net_amount).toLocaleString()} ج.م</p>
                    </div>
                  </div>

                  {/* Lines */}
                  <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-border bg-background-secondary/50">
                      <h3 className="font-bold text-navy">الكميات المدرجة (BOQ)</h3>
                    </div>
                    <div className="overflow-x-auto hide-scrollbar">
                      <table className="w-full text-right text-sm whitespace-nowrap">
                        <thead className="bg-background-secondary border-b border-border">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-text-secondary">بند الأعمال</th>
                            <th className="px-4 py-3 font-semibold text-text-secondary">الوحدة</th>
                            <th className="px-4 py-3 font-semibold text-text-secondary">الفئة (السعر)</th>
                            <th className="px-4 py-3 font-semibold text-text-secondary">سابقة</th>
                            <th className="px-4 py-3 font-semibold text-navy">حالية</th>
                            <th className="px-4 py-3 font-semibold text-text-primary">إجمالي تراكمي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {lines.length === 0 ? (
                            <tr><td colSpan={6} className="py-6 text-center text-text-secondary">لا توجد بنود</td></tr>
                          ) : lines.map((line: any) => (
                            <tr key={line._id} className="hover:bg-black/5">
                              <td className="px-4 py-3 font-medium text-text-primary min-w-[200px] whitespace-normal">{line.item_desc}</td>
                              <td className="px-4 py-3 text-text-secondary">{line.unit_name}</td>
                              <td className="px-4 py-3 font-bold dir-ltr">{line.agreed_rate.toLocaleString()}</td>
                              <td className="px-4 py-3 text-text-secondary dir-ltr">{line.previous_quantity}</td>
                              <td className="px-4 py-3 font-bold text-navy dir-ltr">{line.current_quantity}</td>
                              <td className="px-4 py-3 font-bold text-text-primary dir-ltr bg-slate-50/50">
                                {(Number(line.previous_quantity) + Number(line.current_quantity)).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
