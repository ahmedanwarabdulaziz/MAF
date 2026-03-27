'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createWarehouse, updateWarehouse } from '@/actions/warehouse'

interface WarehouseFormProps {
  companyId: string
  projects: { id: string; arabic_name: string }[]
  initialData?: any
}

export default function WarehouseForm({ companyId, projects, initialData }: WarehouseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [type, setType] = useState(initialData?.warehouse_type || 'project')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    
    try {
      const data = {
        company_id: companyId,
        warehouse_code: formData.get('warehouse_code') as string,
        arabic_name: formData.get('arabic_name') as string,
        english_name: formData.get('english_name') as string,
        warehouse_type: formData.get('warehouse_type') as string,
        project_id: formData.get('warehouse_type') === 'main_company' ? null : (formData.get('project_id') as string) || null,
        location: (formData.get('location') as string) || null,
        is_active: formData.get('is_active') === 'on',
        notes: (formData.get('notes') as string) || null,
      }

      if (initialData?.id) {
        await updateWarehouse(initialData.id, data)
      } else {
        await createWarehouse(data)
      }

      router.push('/company/main_warehouse/warehouses')
      router.refresh()
    } catch (err: any) {
      console.error('Error saving warehouse:', err)
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
          {/* Main Info */}
          <div className="space-y-2">
            <label htmlFor="warehouse_code" className="text-sm font-medium text-text-primary">
              كود المخزن <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              id="warehouse_code"
              name="warehouse_code"
              required
              defaultValue={initialData?.warehouse_code}
              className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              dir="ltr"
              placeholder="e.g. WH-001"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="warehouse_type" className="text-sm font-medium text-text-primary">
              نوع المخزن <span className="text-danger">*</span>
            </label>
            <select
              id="warehouse_type"
              name="warehouse_type"
              required
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="main_company">مخزن شركة (رئيسي)</option>
              <option value="project">مخزن مشروع</option>
              <option value="temporary">مؤقت</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="arabic_name" className="text-sm font-medium text-text-primary">
              اسم المخزن (عربي) <span className="text-danger">*</span>
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

          <div className="space-y-2">
            <label htmlFor="english_name" className="text-sm font-medium text-text-primary">
              اسم المخزن (إنجليزي)
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

          {(type === 'project' || type === 'temporary') && (
            <div className="space-y-2 md:col-span-2">
              <label htmlFor="project_id" className="text-sm font-medium text-text-primary">
                المشروع المرتبط <span className="text-danger">*</span>
              </label>
              <select
                id="project_id"
                name="project_id"
                required
                defaultValue={initialData?.project_id || ''}
                className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">اختر المشروع...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.arabic_name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="location" className="text-sm font-medium text-text-primary">
              موقع المخزن / العنوان
            </label>
            <input
              type="text"
              id="location"
              name="location"
              defaultValue={initialData?.location || ''}
              className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="وصف أو عنوان الموقع"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
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
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-6">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            defaultChecked={initialData ? initialData.is_active : true}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-text-primary">
            مخزن نشط
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Link
            href="/company/main_warehouse/warehouses"
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'جاري الحفظ...' : 'حفظ المخزن'}
          </button>
        </div>
      </form>
    </div>
  )
}
