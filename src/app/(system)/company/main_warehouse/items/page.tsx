import { createClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/auth'
import Link from 'next/link'
import { Suspense } from 'react'
import ItemDialog from './ItemDialog'
import ItemsFilterBar from './ItemsFilterBar'
import ImagePreviewButton from './ImagePreviewButton'
import { getMainCompanyId } from '@/actions/warehouse'

interface PageProps {
  searchParams: { q?: string; group?: string; status?: string }
}

export default async function ItemsPage({ searchParams }: PageProps) {
  await requirePermission('main_warehouse', 'view')
  const supabase = createClient()
  const companyId = await getMainCompanyId()

  const { q, group, status } = searchParams

  // Build items query with optional filters
  let query = supabase
    .from('items')
    .select(`
      id, item_code, arabic_name, english_name, is_active, is_stocked, image_url, item_group_id, primary_unit_id,
      item_groups ( arabic_name, group_code, parent_group_id, parent:parent_group_id ( arabic_name ) ),
      primary_unit:primary_unit_id ( arabic_name )
    `)
    .order('item_code')

  if (q) {
    query = query.or(`arabic_name.ilike.%${q}%,item_code.ilike.%${q}%,english_name.ilike.%${q}%`)
  }
  if (group) {
    query = query.eq('item_group_id', group)
  }
  if (status === 'active') {
    query = query.eq('is_active', true)
  } else if (status === 'inactive') {
    query = query.eq('is_active', false)
  }

  const { data: items } = await query

  // Fetch groups for the filter bar
  const { data: groups } = await supabase
    .from('item_groups')
    .select('id, arabic_name, group_code, parent_group_id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('arabic_name')

  const { data: units } = await supabase
    .from('units')
    .select('id, arabic_name')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('arabic_name')

  const totalCount = items?.length ?? 0
  const hasFilters = !!(q || group || status)

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">دليل الأصناف</h1>
          <p className="mt-1 text-sm text-text-secondary">
          إدارة وتعريف الأصناف المخزنية والخدمية
          </p>
        </div>
        <ItemDialog companyId={companyId} itemGroups={groups ?? []} units={units ?? []} />
      </div>

      {/* Filter bar */}
      <Suspense>
        <ItemsFilterBar groups={groups ?? []} />
      </Suspense>

      {/* Results summary */}
      <div className="mb-3 flex items-center gap-2 text-sm text-text-secondary">
        <span>
          {hasFilters
            ? `${totalCount} نتيجة مطابقة للفلتر`
            : `${totalCount} صنف إجمالاً`}
        </span>
        {hasFilters && totalCount === 0 && (
          <span className="text-danger">• لا توجد أصناف تطابق معايير البحث</span>
        )}
      </div>

      {/* Items table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-secondary text-right">
              <th className="px-6 py-3 font-semibold text-text-secondary">صورة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">كود الصنف</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الاسم</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">المجموعة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الوحدة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الحالة</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {!items?.length && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-text-secondary">
                    <svg className="h-10 w-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <span>{hasFilters ? 'لا توجد أصناف تطابق الفلتر' : 'لا توجد أصناف مسجلة بعد'}</span>
                  </div>
                </td>
              </tr>
            )}
            {items?.map(item => {
              const grp = Array.isArray(item.item_groups)
                ? (item.item_groups[0] as any)
                : (item.item_groups as any)
              const parentName: string | null = (grp?.parent as any)?.arabic_name ?? null

              return (
                <tr key={item.id} className="border-b border-border/50 hover:bg-primary/[0.02] transition-colors">
                  {/* Image Thumbnail */}
                  <td className="px-6 py-4">
                    {item.image_url ? (
                      <ImagePreviewButton url={item.image_url} title={`صورة ${item.arabic_name}`} />
                    ) : (
                      <div className="w-10 h-10 rounded-lg border border-border bg-background-secondary/50 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-text-secondary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </td>
                  
                  {/* Code */}
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs font-bold text-primary tracking-widest" dir="ltr">
                      {item.item_code}
                    </span>
                  </td>

                  {/* Name */}
                  <td className="px-6 py-4">
                    <div className="font-medium text-text-primary leading-tight">{item.arabic_name}</div>
                    {item.english_name && (
                      <div className="mt-0.5 text-xs text-text-secondary" dir="ltr">{item.english_name}</div>
                    )}
                  </td>

                  {/* Group breadcrumb */}
                  <td className="px-6 py-4">
                    {grp ? (
                      <div className="flex flex-col gap-0.5">
                        {parentName && (
                          <div className="text-xs text-text-secondary">{parentName}</div>
                        )}
                        <div className="flex items-center gap-1.5">
                          {parentName && <span className="text-text-secondary/40 text-xs">↳</span>}
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary" dir="ltr">
                            {grp.group_code}
                          </span>
                          <span className="text-sm text-text-primary">{grp.arabic_name}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-text-secondary">—</span>
                    )}
                  </td>

                  {/* Unit */}
                  <td className="px-6 py-4 text-text-secondary text-sm">
                    {Array.isArray(item.primary_unit)
                      ? (item.primary_unit[0] as any)?.arabic_name
                      : (item.primary_unit as any)?.arabic_name ?? '—'}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      item.is_active
                        ? 'bg-success/10 text-success'
                        : 'bg-danger/10 text-danger'
                    }`}>
                      {item.is_active ? 'نشط' : 'موقوف'}
                    </span>
                  </td>

                  {/* Edit */}
                  <td className="px-6 py-4">
                    <ItemDialog 
                      companyId={companyId} 
                      itemGroups={groups ?? []} 
                      units={units ?? []}
                      initialData={item}
                      trigger={
                        <button
                          title="تعديل"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border text-text-secondary hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      }
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
