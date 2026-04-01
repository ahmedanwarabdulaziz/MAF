'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createItem, updateItem, createUnit } from '@/actions/warehouse'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'

interface ItemGroup {
  id: string
  arabic_name: string
  group_code: string
  parent_group_id: string | null
}

interface ItemFormProps {
  companyId: string
  itemGroups: ItemGroup[]
  units: { id: string; arabic_name: string }[]
  initialData?: any
}

/* ─── Hierarchical Group Picker ─── */
function GroupPicker({
  groups,
  value,
  onChange,
}: {
  groups: ItemGroup[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Auto-focus search when opening
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
    else setQuery('')
  }, [open])

  const q = query.trim().toLowerCase()

  // When searching: flat list of all groups matching the query
  // When not searching: hierarchical root/child structure
  const allMatching = q
    ? groups.filter(g =>
        g.arabic_name.toLowerCase().includes(q) ||
        g.group_code.toLowerCase().includes(q)
      )
    : null

  const roots = allMatching
    ? allMatching.filter(g => !g.parent_group_id)
    : groups.filter(g => !g.parent_group_id)

  const childMap = groups.reduce<Record<string, ItemGroup[]>>((acc, g) => {
    if (g.parent_group_id) {
      acc[g.parent_group_id] = [...(acc[g.parent_group_id] ?? []), g]
    }
    return acc
  }, {})

  // When searching, also include subcategory matches under a root header
  const matchingChildren = q
    ? groups.filter(g =>
        g.parent_group_id &&
        (g.arabic_name.toLowerCase().includes(q) || g.group_code.toLowerCase().includes(q))
      )
    : []

  const selected = groups.find(g => g.id === value)
  const parent = selected?.parent_group_id ? groups.find(g => g.id === selected.parent_group_id) : null

  function select(g: ItemGroup) {
    onChange(g.id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between rounded-lg border px-4 py-2 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
          open ? 'border-primary ring-1 ring-primary' : 'border-border'
        } bg-white`}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary shrink-0" dir="ltr">
              {selected.group_code}
            </span>
            <span className="text-text-primary truncate">
              {parent ? (
                <>
                  <span className="text-text-secondary">{parent.arabic_name}</span>
                  <span className="mx-1.5 text-text-secondary">›</span>
                  <span className="font-medium">{selected.arabic_name}</span>
                </>
              ) : (
                selected.arabic_name
              )}
            </span>
          </span>
        ) : (
          <span className="text-text-secondary">اختر المجموعة</span>
        )}
        <svg
          className={`h-4 w-4 text-text-secondary transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-white shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background-secondary/50 px-3 py-1.5">
              <svg className="h-3.5 w-3.5 text-text-secondary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="ابحث باسم المجموعة أو الكود..."
                className="flex-1 bg-transparent text-sm outline-none text-text-primary placeholder:text-text-secondary"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="text-text-secondary hover:text-text-primary">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-2 space-y-0.5">
            {roots.length === 0 && matchingChildren.length === 0 && (
              <div className="py-6 text-center text-sm text-text-secondary">
                {query ? 'لا توجد نتائج' : 'لا توجد مجموعات'}
              </div>
            )}
            {/* Root groups (or matching roots when searching) */}
            {roots.map(root => {
              const children = q ? [] : (childMap[root.id] ?? [])
              const isRootSelected = value === root.id
              return (
                <div key={root.id}>
                  {/* Parent category row */}
                  <button
                    type="button"
                    onClick={() => select(root)}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-right transition-colors ${
                      isRootSelected
                        ? 'bg-primary text-white'
                        : 'hover:bg-primary/5 text-text-primary'
                    }`}
                  >
                    <span className="text-base">📁</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                        isRootSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                      }`}
                      dir="ltr"
                    >
                      {root.group_code}
                    </span>
                    <span className="flex-1 font-semibold text-sm truncate">{root.arabic_name}</span>
                    {children.length > 0 && (
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 ${
                          isRootSelected ? 'bg-white/20 text-white' : 'bg-background-secondary text-text-secondary'
                        }`}
                      >
                        {children.length}
                      </span>
                    )}
                  </button>

                  {/* Subcategory rows */}
                  {children.map(child => {
                    const isChildSelected = value === child.id
                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => select(child)}
                        className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-right transition-colors mr-4 ${
                          isChildSelected
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-background-secondary text-text-secondary hover:text-text-primary'
                        }`}
                        style={{ paddingRight: '2rem' }}
                      >
                        <span className="text-sm opacity-60">↳</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                            isChildSelected ? 'bg-primary/15 text-primary' : 'bg-border/60 text-text-secondary'
                          }`}
                          dir="ltr"
                        >
                          {child.group_code}
                        </span>
                        <span className="flex-1 text-sm truncate">{child.arabic_name}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
            {/* Subcategory-only matches when searching */}
            {matchingChildren.map(child => {
              const parentGroup = groups.find(g => g.id === child.parent_group_id)
              const isChildSelected = value === child.id
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => select(child)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-right transition-colors ${
                    isChildSelected
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-background-secondary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span className="text-xs text-text-secondary truncate">{parentGroup?.arabic_name} ›</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                    isChildSelected ? 'bg-primary/15 text-primary' : 'bg-border/60 text-text-secondary'
                  }`} dir="ltr">{child.group_code}</span>
                  <span className="flex-1 text-sm truncate">{child.arabic_name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Quick-Add Unit Modal ─── */
function QuickAddUnitModal({
  companyId,
  onCreated,
  onClose,
}: {
  companyId: string
  onCreated: (unit: { id: string; arabic_name: string }) => void
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setErr('')
    const fd = new FormData(e.currentTarget)
    try {
      const unit = await createUnit({
        company_id: companyId,
        arabic_name: fd.get('arabic_name') as string,
        english_name: (fd.get('english_name') as string) || undefined,
      })
      onCreated(unit)
    } catch (ex: any) {
      setErr(ex.message || 'حدث خطأ')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-text-primary">إضافة وحدة جديدة</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-background-secondary transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {err && <div className="mb-4 rounded-lg bg-danger/10 p-3 text-xs text-danger">{err}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-primary">
              الاسم (عربي) <span className="text-danger">*</span>
            </label>
            <input
              name="arabic_name"
              required
              autoFocus
              placeholder="مثال: متر مكعب"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-primary">الاسم (إنجليزي)</label>
              <input
                name="english_name"
                dir="ltr"
                placeholder="Cubic Meter"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ...' : 'إضافة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ItemForm({ companyId, itemGroups, units, initialData }: ItemFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [autoCode, setAutoCode] = useState(initialData?.item_code ?? 'جاري التوليد...')
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialData?.item_group_id ?? '')
  const [groupError, setGroupError] = useState(false)
  const [unitList, setUnitList] = useState<{ id: string; arabic_name: string }[]>(units)
  const [unitModal, setUnitModal] = useState<null | 'primary' | 'purchase'>(null)
  const [isActive, setIsActive] = useState<boolean>(initialData?.is_active ?? true)
  const [isStocked, setIsStocked] = useState<boolean>(initialData?.is_stocked ?? true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image_url ?? null)

  useEffect(() => {
    if (initialData?.item_code) return
    async function generate() {
      const supabase = createClient()
      const { count } = await supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
      setAutoCode(`ITM-${String((count ?? 0) + 1).padStart(3, '0')}`)
    }
    generate()
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!selectedGroupId) {
      setGroupError(true)
      return
    }
    setGroupError(false)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    
    try {
      let image_url = initialData?.image_url ?? null
      
      if (imageFile) {
        const supabase = createClient()
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${companyId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('items')
          .upload(fileName, imageFile, {
            cacheControl: '3600',
            upsert: false
          })
          
        if (uploadError) {
          throw new Error('فشل رفع الصورة: ' + uploadError.message)
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('items')
          .getPublicUrl(fileName)
          
        image_url = publicUrl
      } else if (!imagePreview && image_url) {
        // user removed the image
        image_url = null
      }

      const data = {
        company_id: companyId,
        item_group_id: selectedGroupId,
        primary_unit_id: formData.get('primary_unit_id') as string,
        item_code: autoCode,
        arabic_name: formData.get('arabic_name') as string,
        english_name: formData.get('english_name') as string,
        is_stocked: initialData ? isStocked : true,
        is_active: initialData ? isActive : true,
        min_stock_level: null,
        notes: null,
        image_url: image_url
      }

      if (initialData?.id) {
        await updateItem(initialData.id, data)
      } else {
        await createItem(data)
      }

      router.push('/company/main_warehouse/items')
      router.refresh()
    } catch (err: any) {
      console.error('Error saving item:', err)
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

      <form onSubmit={onSubmit} className="space-y-8">
        {/* Basic Info */}
        <div>
          <h3 className="text-sm font-bold text-text-primary mb-4 pb-2 border-b border-border">البيانات الأساسية</h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Item Code — auto-generated read-only */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">كود الصنف</label>
                  <div className="flex items-center rounded-lg border border-border bg-background-secondary/60 px-4 py-2" dir="ltr">
                    <span className="text-sm font-bold text-primary tracking-widest">{autoCode}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">
                    المجموعة <span className="text-danger">*</span>
                  </label>
                  <GroupPicker
                    groups={itemGroups}
                    value={selectedGroupId}
                    onChange={id => { setSelectedGroupId(id); setGroupError(false) }}
                  />
                  {groupError && (
                    <p className="text-xs text-danger">يرجى اختيار مجموعة الصنف</p>
                  )}
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="arabic_name" className="text-sm font-medium text-text-primary">
                    الاسم (عربي) <span className="text-danger">*</span>
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
                    الاسم (إنجليزي)
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
            </div>

            <div className="space-y-2 h-full">
              <label className="text-sm font-medium text-text-primary block">صورة الصنف</label>
              <div className="h-[148px] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center p-2 relative overflow-hidden bg-background-secondary/30 hover:bg-background-secondary/60 transition-colors group">
                {imagePreview ? (
                  <>
                    <Image src={imagePreview} alt="Preview" fill className="object-contain p-1" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white text-xs font-medium">تغيير الصورة</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-text-secondary flex flex-col items-center">
                    <svg className="w-8 h-8 mb-2 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs">اضغط لرفع صورة</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setImageFile(file)
                      setImagePreview(URL.createObjectURL(file))
                    }
                  }}
                />
              </div>
              {imagePreview && (
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null) }}
                  className="text-xs text-danger w-full text-center mt-1 hover:underline font-medium"
                >
                  إزالة الصورة
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status — edit mode only */}
        {initialData && (
          <div>
            <h3 className="text-sm font-bold text-text-primary mb-4 pb-2 border-b border-border">الحالة</h3>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setIsActive(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isActive ? 'bg-success' : 'bg-border'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    isActive ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </div>
                <span className="text-sm font-medium text-text-primary">
                  {isActive ? 'صنف نشط' : 'موقوف'}
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setIsStocked(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isStocked ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    isStocked ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </div>
                <span className="text-sm font-medium text-text-primary">
                  {isStocked ? 'صنف مخزني' : 'غير مخزني'}
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Units Setup */}
        <div>
          <h3 className="text-sm font-bold text-text-primary mb-4 pb-2 border-b border-border">إعدادات الوحدات</h3>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Primary unit */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <label htmlFor="primary_unit_id" className="text-sm font-medium text-text-primary">
                  الوحدة الأساسية (للمخزن) <span className="text-danger">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setUnitModal('primary')}
                  title="إضافة وحدة جديدة"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors text-sm font-bold"
                >
                  +
                </button>
              </div>
              <select
                id="primary_unit_id"
                name="primary_unit_id"
                required
                defaultValue={initialData?.primary_unit_id || ''}
                className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">اختر الوحدة</option>
                {unitList.map(u => (
                  <option key={u.id} value={u.id}>{u.arabic_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>


        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Link
            href="/company/main_warehouse/items"
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'جاري الحفظ...' : 'حفظ الصنف'}
          </button>
        </div>
      </form>

      {/* Quick-add unit modal — rendered OUTSIDE the form to avoid nested-form issues */}
      {unitModal && (
        <QuickAddUnitModal
          companyId={companyId}
          onCreated={(unit) => {
            setUnitList(prev => [...prev, unit])
            setTimeout(() => {
              const selectId = 'primary_unit_id'
              const el = document.getElementById(selectId) as HTMLSelectElement | null
              if (el) el.value = unit.id
            }, 50)
            setUnitModal(null)
          }}
          onClose={() => setUnitModal(null)}
        />
      )}
    </div>
  )
}
