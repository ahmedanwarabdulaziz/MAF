'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createCostCenter, updateCostCenter } from '@/actions/store-issues'

const TYPE_LABELS: Record<string, string> = {
  company: 'شركة',
  department: 'قسم / إدارة',
}

export default function CostCentersClient({ costCenters }: { costCenters: any[] }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // New form state
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'company' | 'department'>('company')
  const [newParent, setNewParent] = useState('')
  const [newNotes, setNewNotes] = useState('')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<'company' | 'department'>('company')
  const [editParent, setEditParent] = useState('')
  const [editActive, setEditActive] = useState(true)

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName) return setError('الاسم مطلوب')
    setError(null)
    startTransition(async () => {
      try {
        await createCostCenter({
          arabic_name: newName,
          center_type: newType,
          parent_center_id: newParent || null,
          notes: newNotes,
        })
        setShowNew(false)
        setNewName(''); setNewType('company'); setNewParent(''); setNewNotes('')
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'خطأ في الحفظ')
      }
    })
  }

  const startEdit = (cc: any) => {
    setEditingId(cc.id)
    setEditName(cc.arabic_name)
    setEditType(cc.center_type)
    setEditParent(cc.parent_center_id || '')
    setEditActive(cc.is_active)
    setError(null)
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setError(null)
    startTransition(async () => {
      try {
        await updateCostCenter(editingId, {
          arabic_name: editName,
          center_type: editType,
          parent_center_id: editParent || null,
          is_active: editActive,
        })
        setEditingId(null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'خطأ في التحديث')
      }
    })
  }

  const activeCenters = costCenters.filter(c => c.is_active)
  const inactiveCenters = costCenters.filter(c => !c.is_active)

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">مراكز التكلفة</h1>
          <p className="text-sm text-text-secondary mt-1">
            حدد مراكز التكلفة لتصنيف المصروفات الداخلية والأصناف المصروفة من المخزن
          </p>
        </div>
        <button
          onClick={() => { setShowNew(true); setError(null) }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          مركز تكلفة جديد
        </button>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger px-4 py-3 rounded-lg border border-danger/20 text-sm">{error}</div>
      )}

      {/* New Cost Center Form */}
      {showNew && (
        <div className="bg-white rounded-xl border border-primary/20 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-primary/5 flex items-center justify-between">
            <h3 className="font-bold text-primary text-sm">إضافة مركز تكلفة جديد</h3>
            <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600 transition">✕</button>
          </div>
          <form onSubmit={handleCreate} className="p-5 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">اسم المركز (عربي) *</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="مثال: الموارد البشرية"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">النوع</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as 'company' | 'department')}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="company">شركة (عام)</option>
                <option value="department">قسم / إدارة</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">تابع لـ (اختياري)</label>
              <select
                value={newParent}
                onChange={e => setNewParent(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">— مستقل —</option>
                {activeCenters.map(cc => (
                  <option key={cc.id} value={cc.id}>{cc.cost_center_code} — {cc.arabic_name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">ملاحظات</label>
              <input
                type="text"
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder="اختياري"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="col-span-2 flex justify-end gap-3 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
              >إلغاء</button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition disabled:opacity-50"
              >{isPending ? 'جاري الحفظ...' : 'حفظ مركز التكلفة'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Cost Centers Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-background-secondary flex items-center justify-between">
          <h2 className="font-bold text-navy text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
            مراكز التكلفة النشطة ({activeCenters.length})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-gray-600 text-xs">
            <tr>
              <th className="px-4 py-3 text-right font-semibold">الكود</th>
              <th className="px-4 py-3 text-right font-semibold">الاسم</th>
              <th className="px-4 py-3 text-right font-semibold">النوع</th>
              <th className="px-4 py-3 text-right font-semibold">تابع لـ</th>
              <th className="px-4 py-3 text-center font-semibold">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activeCenters.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">لا توجد مراكز تكلفة بعد</td></tr>
            )}
            {costCenters.map(cc => (
              editingId === cc.id ? (
                <tr key={cc.id} className="bg-blue-50/30">
                  <td className="px-4 py-3 font-mono text-primary font-bold text-xs">{cc.cost_center_code}</td>
                  <td className="px-4 py-3" colSpan={3}>
                    <form onSubmit={handleUpdate} className="flex gap-3 items-center flex-wrap">
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none min-w-[160px]"
                      />
                      <select
                        value={editType}
                        onChange={e => setEditType(e.target.value as 'company' | 'department')}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                      >
                        <option value="company">شركة</option>
                        <option value="department">قسم</option>
                      </select>
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={editActive}
                          onChange={e => setEditActive(e.target.checked)}
                          className="rounded"
                        />
                        نشط
                      </label>
                      <button
                        type="submit"
                        disabled={isPending}
                        className="px-3 py-1.5 bg-success text-white rounded-lg text-xs font-bold hover:bg-success/90 transition"
                      >حفظ</button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 border border-border rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition"
                      >إلغاء</button>
                    </form>
                  </td>
                  <td></td>
                </tr>
              ) : (
                <tr key={cc.id} className={`hover:bg-gray-50/50 transition-colors ${!cc.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-bold text-primary bg-primary/5 px-2 py-0.5 rounded">{cc.cost_center_code}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{cc.arabic_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{TYPE_LABELS[cc.center_type] || cc.center_type}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {cc.parent ? `${cc.parent.cost_center_code} — ${cc.parent.arabic_name}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center flex items-center justify-center gap-3">
                    <Link
                      href={`/company/cost-centers/${cc.id}`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-2.5 py-1.5 rounded-md hover:bg-blue-100 transition-colors"
                    >
                      كشف الحساب
                    </Link>
                    <button
                      onClick={() => startEdit(cc)}
                      className="text-xs text-primary hover:underline font-medium"
                    >تعديل</button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
        {inactiveCenters.length > 0 && (
          <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-400">
            {inactiveCenters.length} مركز غير نشط مخفي — يمكن تفعيله عبر التعديل
          </div>
        )}
      </div>
    </div>
  )
}
