'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createWarehouse, updateWarehouse } from '@/actions/warehouse'
import { peekNextCompanyDocumentNo } from '@/actions/sequences'

interface WarehouseFormProps {
  companyId: string
  projects: { id: string; arabic_name: string }[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: any
  onSuccess?: () => void
  onCancel?: () => void
  cancelText?: string
}

export default function WarehouseForm({ companyId, projects, initialData, onSuccess, onCancel, cancelText = 'إلغاء' }: WarehouseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [type, setType] = useState(initialData?.warehouse_type || 'project')
  const [warehouseCode, setWarehouseCode] = useState(initialData?.warehouse_code || 'تلقائي')

  useEffect(() => {
    if (initialData?.id || type !== 'project') return
    peekNextCompanyDocumentNo('warehouses', 'WH')
      .then(setWarehouseCode)
      .catch((e) => console.error('Error fetching sequence', e))
  }, [initialData, type])

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

      if (onSuccess) {
        onSuccess()
      } else {
        router.refresh()
      }
    } catch (err: unknown) {
      console.error('Error saving warehouse:', err)
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-b-2xl">
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6 text-right" dir="rtl">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Main Info */}
          <div className="space-y-2">
            <label htmlFor="warehouse_code" className="text-sm font-medium text-gray-700">
              كود المخزن <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="warehouse_code"
              name="warehouse_code"
              required
              readOnly
              value={warehouseCode}
              onChange={(e) => setWarehouseCode(e.target.value)}
              className="w-full rounded-xl border border-border bg-gray-50 px-4 py-2.5 text-sm focus:border-navy focus:outline-none shadow-sm cursor-not-allowed text-gray-500 font-medium"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="warehouse_type" className="text-sm font-medium text-gray-700">
              نوع المخزن <span className="text-red-500">*</span>
            </label>
            <select
              id="warehouse_type"
              name="warehouse_type"
              required
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy shadow-sm"
            >
              <option value="main_company">مخزن شركة (رئيسي)</option>
              <option value="project">مخزن مشروع</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="arabic_name" className="text-sm font-medium text-gray-700">
              اسم المخزن (عربي) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="arabic_name"
              name="arabic_name"
              required
              defaultValue={initialData?.arabic_name}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy shadow-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="english_name" className="text-sm font-medium text-gray-700">
              اسم المخزن (إنجليزي)
            </label>
            <input
              type="text"
              id="english_name"
              name="english_name"
              defaultValue={initialData?.english_name}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy shadow-sm"
              dir="ltr"
            />
          </div>

          {type === 'project' && (
            <div className="space-y-2 md:col-span-2">
              <label htmlFor="project_id" className="text-sm font-medium text-gray-700">
                المشروع المرتبط <span className="text-red-500">*</span>
              </label>
              <select
                id="project_id"
                name="project_id"
                required
                defaultValue={initialData?.project_id || ''}
                className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy shadow-sm"
              >
                <option value="">اختر المشروع...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.arabic_name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="location" className="text-sm font-medium text-gray-700">
              موقع المخزن / العنوان
            </label>
            <input
              type="text"
              id="location"
              name="location"
              defaultValue={initialData?.location || ''}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy shadow-sm"
              placeholder="وصف أو عنوان الموقع"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="notes" className="text-sm font-medium text-gray-700">
              ملاحظات
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={initialData?.notes || ''}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy shadow-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            defaultChecked={initialData?.is_active ?? true}
            className="h-4 w-4 rounded border-border text-navy focus:ring-navy"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
            مخزن نشط (متاح للاستخدام)
          </label>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-8 flex items-center justify-between border-t border-navy/10 bg-gray-50/80 px-6 py-4 backdrop-blur rounded-b-2xl">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm"
          >
            {cancelText}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-navy px-8 py-2.5 text-sm font-bold text-white hover:bg-navy/90 transition disabled:opacity-50 shadow-sm"
          >
            {loading ? 'جاري الحفظ...' : initialData?.id ? 'حفظ التعديلات' : 'إضافة المخزن'}
          </button>
        </div>
      </form>
    </div>
  )
}
