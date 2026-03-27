'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getProjectWorkItems, deleteProjectWorkItem } from '@/actions/agreements'

export default function ProjectWorkItemsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchItems() {
      try {
        const data = await getProjectWorkItems(params.id)
        setItems(data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchItems()
  }, [params.id])

  async function handleDelete(itemId: string) {
    if (!confirm('هل أنت متأكد من حذف هذا البند؟ لا يمكن التراجع عن هذا الإجراء.')) return
    
    try {
      await deleteProjectWorkItem(itemId, params.id)
      setItems(items.filter(i => i.id !== itemId))
    } catch (err: any) {
      alert(err.message || 'Error deleting work item')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">بنود أعمال المشروع (دليل البنود)</h1>
          <p className="mt-1 text-sm text-text-secondary">
            إدارة البنود الخاصة بالمشروع والمستخدمة في عقود مقاولي الباطن والمستخلصات.
          </p>
        </div>
        <Link
          href={`/projects/${params.id}/work-items/new`}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
        >
          + إضافة بند جديد
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-text-secondary">جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary bg-background-secondary">
            لا توجد بنود أعمال مسجلة لهذا المشروع بعد.
          </div>
        ) : (
          <table className="w-full text-right text-sm">
            <thead className="bg-background-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold text-text-secondary">الكود</th>
                <th className="px-6 py-4 font-semibold text-text-secondary">وصف البند (عربي)</th>
                <th className="px-6 py-4 font-semibold text-text-secondary">الوحدة الافتراضية</th>
                <th className="px-6 py-4 font-semibold text-text-secondary">ملاحظات</th>
                <th className="px-6 py-4 w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-background-secondary transition-colors">
                  <td className="px-6 py-4 font-medium text-text-primary">
                    {item.item_code || '-'}
                  </td>
                  <td className="px-6 py-4">
                    {item.arabic_description}
                  </td>
                  <td className="px-6 py-4 text-text-secondary">
                    {item.units?.arabic_name || '-'}
                  </td>
                  <td className="px-6 py-4 text-text-secondary">
                    {item.notes || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/projects/${params.id}/work-items/${item.id}/edit`}
                        className="text-primary hover:text-primary/80 transition-colors"
                      >
                        تعديل
                      </Link>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-danger hover:text-danger/80 transition-colors"
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
