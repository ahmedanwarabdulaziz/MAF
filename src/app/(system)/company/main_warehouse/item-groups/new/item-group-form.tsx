'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createItemGroup, updateItemGroup } from '@/actions/warehouse'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

interface ItemGroupFormProps {
  companyId: string
  parentGroups: { id: string; arabic_name: string }[]
  initialData?: any
}

export default function ItemGroupForm({ companyId, parentGroups, initialData }: ItemGroupFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [autoCode, setAutoCode] = useState(initialData?.group_code ?? 'جاري التوليد...')

  useEffect(() => {
    if (initialData?.group_code) return // edit mode — keep existing
    async function generate() {
      const supabase = createClient()
      const { count } = await supabase
        .from('item_groups')
        .select('id', { count: 'exact', head: true })
      const next = (count ?? 0) + 1
      setAutoCode(`GRP-${String(next).padStart(3, '0')}`)
    }
    generate()
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    
    try {
      const data = {
        company_id: companyId,
        group_code: autoCode,
        arabic_name: formData.get('arabic_name') as string,
        english_name: formData.get('english_name') as string,
        parent_group_id: formData.get('parent_group_id') as string || null,
        is_active: formData.get('is_active') === 'on',
        notes: (formData.get('notes') as string) || null,
      }

      if (initialData?.id) {
        await updateItemGroup(initialData.id, data)
      } else {
        await createItemGroup(data)
      }

      router.push('/company/main_warehouse/item-groups')
      router.refresh()
    } catch (err: any) {
      console.error('Error saving item group:', err)
      setError(err.message || 'حدث خطأ أثناء الحفظ')
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      {error && (
        <div className="mb-6 rounded-lg bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Group Code — auto-generated read-only */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">كود المجموعة</label>
            <div className="flex items-center rounded-lg border border-border bg-background-secondary/60 px-4 py-2" dir="ltr">
              <span className="text-sm font-bold text-primary tracking-widest">{autoCode}</span>
            </div>
          </div>

          {/* Parent Group */}
          <div className="space-y-2">
            <label htmlFor="parent_group_id" className="text-sm font-medium text-text-primary">
              المجموعة الرئيسية (اختياري)
            </label>
            <select
              id="parent_group_id"
              name="parent_group_id"
              defaultValue={initialData?.parent_group_id || ''}
              className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">بدون مستوى رئيسي (مستوى أول)</option>
              {parentGroups.map(p => (
                <option key={p.id} value={p.id}>
                  {p.arabic_name}
                </option>
              ))}
            </select>
          </div>

          {/* Arabic Name */}
          <div className="space-y-2">
            <label htmlFor="arabic_name" className="text-sm font-medium text-text-primary">
              اسم المجموعة (عربي) <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              id="arabic_name"
              name="arabic_name"
              required
              defaultValue={initialData?.arabic_name}
              className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* English Name */}
          <div className="space-y-2">
            <label htmlFor="english_name" className="text-sm font-medium text-text-primary">
              اسم المجموعة (إنجليزي)
            </label>
            <input
              type="text"
              id="english_name"
              name="english_name"
              defaultValue={initialData?.english_name}
              className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              dir="ltr"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label htmlFor="notes" className="text-sm font-medium text-text-primary">
            ملاحظات
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initialData?.notes || ''}
            className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Is Active */}
        <div className="flex items-center gap-3 border-t border-border pt-6">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            defaultChecked={initialData ? initialData.is_active : true}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-text-primary">
            مجموعة نشطة
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/company/main_warehouse/item-groups"
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'جاري الحفظ...' : 'حفظ المجموعة'}
          </button>
        </div>
      </form>
    </div>
  )
}
