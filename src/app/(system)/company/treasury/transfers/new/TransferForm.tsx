'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { transferFunds } from '@/actions/treasury'
import DatePicker from '@/components/DatePicker'
import CustomSelect from '@/components/CustomSelect'
import { createClient } from '@/lib/supabase'
import { useEffect } from 'react'

export default function TransferForm({ accounts, returnPath = '/company/treasury' }: { accounts: any[], returnPath?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: '',
    transfer_date: new Date().toISOString().split('T')[0],
    notes: ''
  })
  
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [attachments, setAttachments] = useState<File[]>([])

  useEffect(() => {
    const db = createClient()
    db.from('projects').select('id, arabic_name').eq('is_active', true).then(res => {
      setProjects(res.data || [])
    })
  }, [])

  // Prevent selecting the same account twice and only show active accounts
  const activeAccounts = accounts.filter(a => a.is_active)
  const availableToAccounts = activeAccounts.filter(a => a.financial_account_id !== formData.from_account_id)

  const selectedFromAccount = activeAccounts.find(a => a.financial_account_id === formData.from_account_id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (Number(formData.amount) <= 0) {
        setError('Amount must be greater than zero')
        setLoading(false)
        return
    }

    if (selectedFromAccount && Number(formData.amount) > Number(selectedFromAccount.current_balance)) {
        setError('الرصيد غير كافٍ لإتمام هذا التحويل من الحساب المصدر.')
        setLoading(false)
        return
    }

    try {
      let uploadedUrls: string[] = []

      if (attachments.length > 0) {
        const db = createClient()
        for (const file of attachments) {
          const ext = file.name.split('.').pop() || 'tmp'
          const path = `financial_transactions/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
          
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

      await transferFunds({
        from_account_id: formData.from_account_id,
        to_account_id: formData.to_account_id,
        amount: Number(formData.amount),
        transfer_date: formData.transfer_date,
        notes: formData.notes,
        project_id: projectId || undefined,
        attachment_urls: uploadedUrls,
      })
      router.push(returnPath)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تنفيذ التحويل')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
        <Link href={returnPath} className="hover:text-primary">الخزينة والحسابات</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">تحويل داخلي</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">إصدار تحويل مالي داخلي</h1>
        <p className="mt-1 text-sm text-text-secondary">
          نقل السيولة بين البنوك وخزائن المشاريع داخل الشركة.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-white shadow-sm p-6 space-y-6">
        {error && (
            <div className="rounded-md bg-danger/10 p-4 text-sm text-danger border border-danger/20">
            {error}
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                    من الحساب (المصدر) *
                </label>
                <select
                    required
                    value={formData.from_account_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, from_account_id: e.target.value, to_account_id: prev.to_account_id === e.target.value ? '' : prev.to_account_id }))}
                    className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                    <option value="">-- اختر الحساب المصدر --</option>
                    {activeAccounts.map(acc => (
                        <option key={acc.financial_account_id} value={acc.financial_account_id}>
                            {acc.arabic_name} {acc.project_id ? `(مشروع: ${acc.project.arabic_name})` : '(رئيسي)'} - متاح: {Number(acc.current_balance).toLocaleString()} {acc.currency}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                    إلى الحساب (المستلم) *
                </label>
                <select
                    required
                    value={formData.to_account_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, to_account_id: e.target.value }))}
                    disabled={!formData.from_account_id}
                    className="w-full rounded-md border border-border px-3 py-2 disabled:bg-background-secondary disabled:cursor-not-allowed focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                    <option value="">-- اختر الحساب المستلم --</option>
                    {availableToAccounts.map(acc => (
                        <option key={acc.financial_account_id} value={acc.financial_account_id}>
                            {acc.arabic_name} {acc.project_id ? `(مشروع: ${acc.project.arabic_name})` : '(رئيسي)'}
                        </option>
                    ))}
                </select>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-text-primary mb-1">مبلغ التحويل *</label>
                <div className="relative">
                    <input
                        type="number"
                        required
                        min="1"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-left"
                        dir="ltr"
                    />
                    <span className="absolute right-3 top-2.5 text-sm text-text-secondary">EGP</span>
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-medium text-text-primary mb-1">تاريخ التحويل *</label>
                <DatePicker
                    value={formData.transfer_date}
                    onChange={val => setFormData({ ...formData, transfer_date: val })}
                />
            </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-text-primary mb-1">البيان / ملاحظات *</label>
            <textarea
                required
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="تفاصيل سبب التحويل واعتمادات الإدارة إن وجدت..."
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">المشروع المرتبط (اختياري)</label>
            <CustomSelect
              value={projectId || ''}
              onChange={val => setProjectId(val)}
              options={projects.map(p => ({ value: p.id, label: p.arabic_name }))}
              placeholder="اختر المشروع (إن وجد)..."
              searchable={true}
            />
          </div>
          <div className="flex flex-col gap-1.5 focus-within:text-primary">
            <label className="text-sm font-medium text-text-primary flex items-center justify-between">
              <span>المرفقات والفواتير (اختياري)</span>
              <span className="text-xs text-text-secondary font-normal">الحد الأقصى 5 ملفات</span>
            </label>
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => {
                const selected = Array.from(e.target.files || [])
                if (selected.length + attachments.length > 5) {
                  setError('يمكنك إرفاق 5 ملفات كحد أقصى.')
                } else {
                  setAttachments(prev => [...prev, ...selected].slice(0, 5))
                }
                e.target.value = '' // reset
              }}
              className="rounded-lg border border-border bg-white p-1 text-sm outline-none transition-colors file:ml-4 file:py-1.5 file:px-4 file:border-0 file:font-semibold file:bg-primary/5 file:text-primary hover:file:bg-primary/10 file:rounded-md file:cursor-pointer text-text-secondary cursor-pointer"
            />
            
            {attachments.length > 0 && (
              <div className="grid grid-cols-1 gap-2 mt-2">
                {attachments.map((file, i) => (
                  <div key={i} className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5 text-sm shadow-sm">
                    <span className="truncate text-primary max-w-[80%]" dir="ltr">{file.name}</span>
                    <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-danger hover:text-white p-1 rounded hover:bg-danger transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-6">
            <Link
                href={returnPath}
                className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-black/5"
            >
                إلغاء
            </Link>
            <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 disabled:opacity-50"
            >
                {loading ? 'جاري التنفيذ...' : 'اعتماد التحويل'}
            </button>
        </div>
      </form>
    </div>
  )
}
