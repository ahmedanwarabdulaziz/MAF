'use client'

import { useState, useTransition } from 'react'

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
)
const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
)
const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
)
import { createExpenseCategory } from '../actions'

type Category = { id: string; arabic_name: string; category_code: string; parent_id: string | null; is_active: boolean }

interface Props { categories: Category[] }

export default function ExpenseCategoriesClient({ categories }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [form, setForm] = useState({ category_code: '', arabic_name: '', english_name: '', parent_id: '' })

  const roots    = categories.filter(c => !c.parent_id)
  const children = (pid: string) => categories.filter(c => c.parent_id === pid)
  const toggle   = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const handleCreate = () => {
    setError(null)
    if (!form.category_code || !form.arabic_name) { setError('الكود والاسم مطلوبان'); return }
    startTransition(async () => {
      try {
        await createExpenseCategory({
          category_code: form.category_code,
          arabic_name:   form.arabic_name,
          english_name:  form.english_name || undefined,
          parent_id:     form.parent_id || null,
        })
        setForm({ category_code: '', arabic_name: '', english_name: '', parent_id: '' })
        setShowForm(false)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'خطأ')
      }
    })
  }

  const CategoryRow = ({ cat, depth }: { cat: Category; depth: number }) => {
    const kids = children(cat.id)
    const open  = expanded[cat.id]
    return (
      <>
        <tr className="hover:bg-gray-50 transition border-b">
          <td className="px-4 py-3" style={{ paddingRight: `${16 + depth * 24}px` }}>
            <div className="flex items-center gap-2">
              {kids.length > 0
                ? <button onClick={() => toggle(cat.id)} className="text-gray-400">
                    {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
                  </button>
                : <span className="w-4 h-4 inline-block" />
              }
              <span className="font-medium text-gray-800">{cat.arabic_name}</span>
            </div>
          </td>
          <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cat.category_code}</td>
          <td className="px-4 py-3">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
              cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {cat.is_active ? 'فعّال' : 'غير فعّال'}
            </span>
          </td>
        </tr>
        {open && kids.map(k => <CategoryRow key={k.id} cat={k} depth={depth + 1} />)}
      </>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Add Category Form */}
      {showForm ? (
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <h3 className="font-medium text-gray-800">إضافة قسم جديد</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">الكود *</label>
              <input
                value={form.category_code}
                onChange={e => setForm(p => ({ ...p, category_code: e.target.value }))}
                placeholder="مثال: EXP-ADM-01"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">الاسم بالعربي *</label>
              <input
                value={form.arabic_name}
                onChange={e => setForm(p => ({ ...p, arabic_name: e.target.value }))}
                placeholder="إيجار مكاتب"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">القسم الأب</label>
              <select
                value={form.parent_id}
                onChange={e => setForm(p => ({ ...p, parent_id: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- قسم رئيسي --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.arabic_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowForm(false); setError(null) }}
              className="px-4 py-1.5 text-sm rounded-lg border text-gray-600 hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'جارٍ الحفظ...' : 'إضافة'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          <PlusIcon />
          إضافة قسم
        </button>
      )}

      {/* Categories Tree Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {categories.length === 0 ? (
          <p className="text-center py-10 text-gray-400 text-sm">لا يوجد أقسام بعد</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-gray-600">اسم القسم</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">الكود</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {roots.map(r => <CategoryRow key={r.id} cat={r} depth={0} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
