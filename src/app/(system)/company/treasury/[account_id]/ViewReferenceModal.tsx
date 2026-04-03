'use client'

import { useState, useEffect } from 'react'
import AttachmentsViewer from '@/components/AttachmentsViewer'
import { getTransactionOriginLinks } from '@/actions/treasury'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const SupplierInvoiceView = dynamic(() => import('@/components/procurement/SupplierInvoiceView'))

export default function ViewReferenceModal({ tx, label }: { tx: any, label: string }) {
  const [open, setOpen] = useState(false)
  const [links, setLinks] = useState<{ label: string; url: string; id: string; type: string }[]>([])
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<{ id: string; type: string; url: string; label: string } | null>(null)

  useEffect(() => {
    if (open && tx.reference_id) {
      setLoadingLinks(true)
      getTransactionOriginLinks(tx.reference_type, tx.reference_id, tx.project_id)
        .then(res => {
          setLinks(res)
          setLoadingLinks(false)
          // Automatically open the actual source document if one is linked!
          if (res && res.length === 1) {
             setSelectedDoc(res[0])
          } else if (res && res.length > 1) {
             // If multiple, maybe open the most relevant one, or let them choose.
             // We'll auto-open the first one for speed.
             setSelectedDoc(res[0])
          }
        })
        .catch(() => setLoadingLinks(false))
    }
  }, [open, tx.reference_id, tx.reference_type, tx.project_id])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 py-1.5 px-3 text-xs font-bold text-primary bg-primary/5 rounded-lg border border-primary/10 hover:bg-primary/10 hover:border-primary/30 transition-all group"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span>{label}</span>
      </button>
    )
  }

  const isDeposit = tx.transaction_type === 'deposit'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 py-1.5 px-3 text-xs font-bold text-primary bg-primary/5 rounded-lg border border-primary/10 hover:bg-primary/10 hover:border-primary/30 transition-all group opacity-50"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span>{label}</span>
      </button>

      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" dir="rtl">
        <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm transition-opacity" onClick={() => setOpen(false)}></div>
        
        <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-full animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className={`p-6 border-b flex items-start justify-between ${isDeposit ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'}`}>
            <div className="flex gap-4 items-center">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isDeposit ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-black text-navy">{label}</h2>
                <div className="mt-1 flex items-center gap-3 text-sm font-medium text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {tx.transaction_date}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span className="flex items-center gap-1.5" dir="ltr">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {new Date(tx.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors bg-white shadow-sm border border-slate-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto w-full flex flex-col gap-6 text-right">
            
            {(links.length > 0 || loadingLinks) && (
              <div className="p-5 rounded-xl border border-blue-100 bg-blue-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
                <span className="block text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-3">المستندات الأساسية (الصلة)</span>
                
                {loadingLinks ? (
                  <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    جاري جلب المستندات المرتبطة...
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3 relative z-10">
                    {links.map(link => (
                      <button 
                        key={link.url}
                        onClick={() => setSelectedDoc(link)}
                        className="inline-flex flex-col gap-1 items-start justify-center p-3 rounded-lg border border-blue-200 bg-white hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all font-bold text-blue-700 shadow-sm group"
                      >
                        <div className="flex items-center gap-2">
                           <svg className="w-5 h-5 group-hover:animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                           <span className="text-sm">فتح المستند: {link.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">المبلغ الإجمالي</span>
                <span className={`block text-2xl font-black tabular-nums tracking-tight ${isDeposit ? 'text-emerald-600' : 'text-rose-600'}`} dir="ltr">
                  {isDeposit ? '+' : '-'}{Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">الرقم المرجعي (ID)</span>
                <span className="block text-sm font-bold text-navy truncate" dir="ltr">{tx.reference_id || 'N/A'}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">الجهة / المستفيد / الدائن</span>
                <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm font-bold text-navy">
                  {tx.counterpart_name || '-'}
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">البيان والتفاصيل</span>
                <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm font-medium text-slate-700 leading-relaxed min-h-[80px]">
                  {tx.notes || 'لا يوجد بيان إضافي لهذه الحركة'}
                </div>
              </div>

              {tx.project_id && (
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">المشروع المرتبط</span>
                  <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm font-bold text-navy flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>
                    {tx.project?.arabic_name || 'مشروع محذوف'}
                  </div>
                </div>
              )}

              {tx.attachment_urls && tx.attachment_urls.length > 0 && (
                <div className="pt-2">
                  <span className="block text-sm font-bold text-navy mb-3 border-b border-slate-100 pb-2">المرفقات والمستندات الأصلية</span>
                  <div className="flex flex-wrap gap-2">
                    <AttachmentsViewer urls={tx.attachment_urls} />
                  </div>
                </div>
              )}
            </div>
            
          </div>
          
          <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-sm font-medium text-slate-500">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                {(tx.created_by_user?.display_name || 'S')[0].toUpperCase()}
              </div>
              المُدخل: <span className="font-bold text-slate-700">{tx.created_by_user?.display_name || 'System'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Document Dialog */}
      {selectedDoc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-6" dir="rtl">
          <div className="absolute inset-0 bg-navy/90 backdrop-blur-md transition-opacity" onClick={() => setSelectedDoc(null)} />
          <div className="relative w-full h-full max-w-[1400px] flex flex-col bg-[#f8fafc] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.4)] overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Toolbar Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0 shadow-sm z-10">
               <div className="flex items-center gap-4">
                 <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 </div>
                 <div>
                   <h2 className="text-xl font-black text-navy">{selectedDoc.label}</h2>
                   <div className="flex items-center gap-2 mt-0.5">
                     <span className="font-mono text-xs text-slate-500">ID: {selectedDoc.id}</span>
                     <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">معاينة مباشرة</span>
                   </div>
                 </div>
               </div>
               
               <div className="flex items-center gap-3">
                 <Link href={selectedDoc.url} target="_blank" className="text-sm font-bold text-primary hover:text-navy transition-colors flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200">
                   فتح في نافذة مستقلة
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                 </Link>
                 <div className="w-px h-8 bg-slate-200"></div>
                 <button onClick={() => setSelectedDoc(null)} className="p-2 bg-slate-50 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-xl transition-colors border border-slate-200 hover:border-rose-200" title="إغلاق المعاينة">
                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
               </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 relative">
               {selectedDoc.type === 'supplier_invoice' || selectedDoc.type === 'company_purchase_invoice' ? (
                 <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 sm:p-6 min-h-full">
                   <SupplierInvoiceView invoiceId={selectedDoc.id} projectId={tx.project_id || ''} hideBreadcrumbs={true} />
                 </div>
               ) : (
                 <div className="w-full h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative min-h-[80vh]">
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="text-slate-400 font-medium animate-pulse flex items-center gap-2">
                       <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                       جاري تحميل المستند الأصلي...
                     </span>
                   </div>
                   <iframe 
                     src={selectedDoc.url + (selectedDoc.url.includes('?') ? '&' : '?') + 'hideNav=true'} 
                     className="relative z-10 w-full h-full border-0 bg-transparent"
                     title="Document Preview"
                   />
                 </div>
               )}
            </div>

          </div>
        </div>
      )}
    </>
  )
}
