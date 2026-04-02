'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { depositFunds, getAccountDetails } from '@/actions/treasury'
import DatePicker from '@/components/DatePicker'
import CustomSelect from '@/components/CustomSelect'
import { createClient } from '@/lib/supabase'
import { useEffect } from 'react'

export default function DepositPage() {
  const router = useRouter()
  const params = useParams()
  const accountId = params.account_id as string

  const [account, setAccount] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    amount: '',
    transaction_date: today,
    notes: '',
    counterpart_name: '',
  })
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [attachments, setAttachments] = useState<File[]>([])

  useEffect(() => {
    getAccountDetails(accountId).then(setAccount)
    const db = createClient()
    db.from('projects').select('id, arabic_name').eq('is_active', true).then(res => {
      setProjects(res.data || [])
    })
  }, [accountId])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) {
      setError('يجب إدخال مبلغ صحيح أكبر من الصفر')
      return
    }
    setLoading(true)
    setError(null)
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

      await depositFunds({
        account_id: accountId,
        amount: Number(form.amount),
        transaction_date: form.transaction_date,
        notes: form.notes.trim() || undefined,
        project_id: projectId || undefined,
        attachment_urls: uploadedUrls,
        counterpart_name: form.counterpart_name.trim() || undefined,
      })
      router.push(`/company/treasury/${accountId}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-text-secondary">
        <Link href="/company/treasury" className="hover:text-primary transition-colors">الخزينة والحسابات</Link>
        <span>←</span>
        <Link href={`/company/treasury/${accountId}`} className="hover:text-primary transition-colors">
          {account?.arabic_name ?? '...'}
        </Link>
        <span>←</span>
        <span className="text-text-primary font-medium">إيداع</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">إيداع أموال</h1>
        <p className="mt-1 text-sm text-text-secondary">
          تسجيل إيداع يدوي في حساب{account ? ` "${account.arabic_name}"` : ''}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-white p-6 shadow-sm">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {/* Amount */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">
            المبلغ <span className="text-danger">*</span>
          </label>
          <div className="flex items-center overflow-hidden rounded-lg border border-border bg-background-secondary focus-within:border-primary focus-within:bg-white">
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
              placeholder="0.00"
              dir="ltr"
            />
            <span className="border-r border-border bg-background-secondary px-3 py-2.5 text-xs font-medium text-text-secondary">
              {account?.currency ?? 'EGP'}
            </span>
          </div>
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1.5:">
          <label className="text-sm font-medium text-text-primary">
            تاريخ الإيداع <span className="text-danger">*</span>
          </label>
          <DatePicker
            value={form.transaction_date}
            onChange={val => set('transaction_date', val)}
          />
        </div>

        {/* Project Selection */}
        <div className="flex flex-col gap-1.5 focus-within:text-primary">
          <label className="text-sm font-medium text-text-primary">
            المشروع المرتبط <span className="text-text-secondary font-normal text-xs">(اختياري)</span>
          </label>
          <CustomSelect
            value={projectId || ''}
            onChange={val => setProjectId(val)}
            options={projects.map(p => ({ value: p.id, label: p.arabic_name }))}
            placeholder="اختر المشروع (إن وجد)..."
            searchable={true}
          />
        </div>

        {/* Counterpart Name */}
        <div className="flex flex-col gap-1.5 focus-within:text-primary">
          <label className="text-sm font-medium text-text-primary">
            الجهة المودعة / المصدر <span className="text-text-secondary font-normal text-xs">(اختياري)</span>
          </label>
          <input
            type="text"
            value={form.counterpart_name}
            onChange={e => set('counterpart_name', e.target.value)}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
            placeholder="مثال: إيراد خارجي، بيع خردة، الخ..."
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">
            البيان / ملاحظات <span className="text-text-secondary font-normal text-xs">(اختياري)</span>
          </label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white resize-none"
            placeholder="مثال: إيداع إيراد مشروع الخليج"
          />
        </div>

        {/* Attachments */}
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
            className="rounded-lg border border-border bg-white p-1 text-sm outline-none transition-colors file:ml-4 file:py-2 file:px-4 file:border-0 file:font-semibold file:bg-primary/5 file:text-primary hover:file:bg-primary/10 file:rounded-md file:cursor-pointer text-text-secondary cursor-pointer"
          />
          
          {attachments.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2">
              {attachments.map((file, i) => (
                <div key={i} className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-sm shadow-sm">
                  <span className="truncate text-primary max-w-[80%]" dir="ltr">{file.name}</span>
                  <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-danger hover:text-white p-1.5 rounded hover:bg-danger transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`/company/treasury/${accountId}`}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'جارٍ الحفظ...' : '+ تسجيل الإيداع'}
          </button>
        </div>
      </form>
    </div>
  )
}
