'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { executeTreasuryPayment, getPaymentVoucherDetails } from '@/actions/payments'
import { createClient } from '@/lib/supabase'

export default function ExecutePaymentDialog({ 
  voucher, 
  accounts 
}: { 
  voucher: any,
  accounts: any[]
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState(voucher.financial_account_id || '')
  const [executedAmount, setExecutedAmount] = useState<number | ''>(voucher.total_amount || '')
  const [notes, setNotes] = useState(voucher.notes || '')
  const [filesToUpload, setFilesToUpload] = useState<File[]>([])
  const [attachments, setAttachments] = useState<string[]>(voucher.attachment_urls || [])
  const [fullVoucher, setFullVoucher] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleOpen = async () => {
    setIsOpen(true)
    if (!fullVoucher) {
      setFetching(true)
      try {
        const details = await getPaymentVoucherDetails(voucher.id)
        setFullVoucher(details)
      } catch (err) {
        console.error(err)
      } finally {
        setFetching(false)
      }
    }
  }

  const handleExecute = async () => {
    setError(null)
    if (!selectedAccountId) {
      setError('يجب اختيار الحساب المالي للمصروف!')
      return
    }
    if (executedAmount === '' || Number(executedAmount) <= 0) {
      setError('يجب تحديد مبلغ صحيح أكبر من صفر!')
      return
    }
    if (Number(executedAmount) > voucher.total_amount) {
      setError('لا يمكن أن يكون المبلغ المنفذ أكبر من المبلغ المطلوب!')
      return
    }

    setLoading(true)
    try {
      const db = createClient()
      let uploadedUrls: string[] = [...attachments]

      if (filesToUpload.length > 0) {
        for (const file of filesToUpload) {
          const ext = file.name.split('.').pop() || 'tmp'
          const path = `payment_proofs/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
          
          const { error: uploadErr } = await db.storage.from('maf-documents').upload(path, file)
          
          if (!uploadErr) {
            const { data } = db.storage.from('maf-documents').getPublicUrl(path)
            uploadedUrls.push(data.publicUrl)
          } else {
            setError('تعذر رفع المرفقات: ' + uploadErr.message)
            setLoading(false)
            return
          }
        }
      }

      await executeTreasuryPayment(voucher.id, {
        financial_account_id: selectedAccountId,
        notes,
        attachment_urls: uploadedUrls,
        executed_amount: Number(executedAmount)
      })
      setIsOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء التنفيذ')
    } finally {
      setLoading(false)
    }
  }

  const partyRecord = fullVoucher?.parties ? (Array.isArray(fullVoucher.parties) ? fullVoucher.parties[0] : fullVoucher.parties) : null

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded hover:bg-primary/90 transition-colors inline-block w-full text-center"
      >
        تنفيذ الصرف
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => !loading && setIsOpen(false)} />
          
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" dir="rtl">
            <div className="p-4 border-b border-border bg-background-secondary/50 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-navy flex items-center gap-2">
                <span className="text-2xl">⚡</span> تنفيذ الدفعة <span className="font-mono text-sm text-text-secondary">{voucher.voucher_no}</span>
              </h2>
              <button onClick={() => !loading && setIsOpen(false)} className="text-text-secondary hover:text-danger p-1">
                 ✕ 
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 text-right">
              {fetching ? (
                 <div className="py-8 text-center text-text-secondary animate-pulse">جاري جلب التفاصيل...</div>
              ) : (
                <div className="space-y-6">
                  {error && (
                    <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger text-right">
                      {error}
                    </div>
                  )}

                  {/* Summary Box */}
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex flex-wrap gap-4 justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-text-secondary uppercase mb-1">جهة الصرف / المستفيد</p>
                      <p className="font-bold text-primary">{partyRecord?.party?.arabic_name || voucher.parties?.[0]?.party?.arabic_name || 'غير معروف'}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-text-secondary uppercase mb-1">الطلب الأصلي</p>
                      <p className="text-xl font-black text-navy dir-ltr">{Number(voucher.total_amount).toLocaleString()} EGP</p>
                    </div>
                  </div>

                  {/* Executed Amount Selector */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-amber-900 mb-1">المبلغ المعتمد للتنفيذ <span className="text-danger">*</span></label>
                    <p className="text-xs text-amber-700/80 mb-3">يمكنك تنفيذ مبلغ أقل من المطلوب إذا لم تتوفر سيولة كافية.</p>
                    <div className="relative w-full max-w-xs">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        max={voucher.total_amount}
                        value={executedAmount}
                        onChange={(e) => setExecutedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={loading}
                        className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-lg font-bold text-navy shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 dir-ltr text-right pr-12"
                      />
                      <span className="absolute inset-y-0 right-3 flex items-center text-sm font-bold text-text-secondary pointer-events-none">EGP</span>
                    </div>
                  </div>

                  {/* Account Selector */}
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1">مصدر الأموال الفعلي (تأكيد الخزينة/البنك) <span className="text-danger">*</span></label>
                    <p className="text-xs text-text-secondary mb-2">اختر الحساب الذي سيتم الخصم منه فعلياً (بدلاً من الحساب المقترح إن لزم الأمر).</p>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      disabled={loading}
                    >
                      <option value="">-- اختر الحساب/الخزينة --</option>
                      {accounts.map(acc => (
                        <option key={acc.financial_account_id} value={acc.financial_account_id}>
                           {acc.arabic_name} {acc.project ? `(مشروع: ${acc.project.arabic_name})` : '(إدارة عامة)'} - رصيد متاح: {Number(acc.current_balance).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Proof Uploads */}
                  <div className="pb-2 pt-2 border-t border-border">
                    <label className="text-sm font-semibold text-text-primary flex items-center justify-between mb-1">
                      <span>إيصال البنك أو إثبات التحويل (اختياري)</span>
                    </label>
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => {
                        const selected = Array.from(e.target.files || [])
                        setFilesToUpload(prev => [...prev, ...selected])
                        e.target.value = '' // reset
                      }}
                      className="w-full rounded-lg border border-border bg-white text-sm outline-none transition-colors file:ml-4 file:py-2 file:px-4 file:border-0 file:font-semibold file:bg-primary/5 file:text-primary hover:file:bg-primary/10 file:rounded-md file:cursor-pointer text-text-secondary cursor-pointer mt-1"
                    />
                    
                    {filesToUpload.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {filesToUpload.map((file, idx) => (
                          <div key={`new-${idx}`} className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-sm shadow-sm">
                            <span className="truncate text-primary max-w-[150px]" dir="ltr">{file.name}</span>
                            <button type="button" onClick={() => setFilesToUpload(prev => prev.filter((_, i) => i !== idx))} className="text-danger hover:text-white p-1 rounded hover:bg-danger transition-colors">
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1">ملاحظات أمين الخزينة (اختياري)</label>
                    <textarea 
                      value={notes} 
                      onChange={e => setNotes(e.target.value)}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[80px]"
                      placeholder="رقم الشيك، إيصال، أو أي ملاحظات حول السداد ومطابقتها..."
                      disabled={loading}
                    />
                  </div>

                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-background-secondary/30 flex gap-3 justify-end shrink-0">
              <button 
                type="button" 
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 border border-border text-text-secondary font-medium rounded-lg hover:bg-black/5"
                disabled={loading}
              >
                إلغاء
              </button>
              <button 
                onClick={handleExecute}
                disabled={loading || fetching || !selectedAccountId}
                className="px-6 py-2 bg-success text-white font-bold rounded-lg hover:bg-success/90 disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                {loading ? (
                    <span className="block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                ) : 'تنفيذ واعتماد الصرف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
