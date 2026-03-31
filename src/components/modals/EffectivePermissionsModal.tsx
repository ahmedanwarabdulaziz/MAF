'use client'

import { useState, useTransition } from 'react'
import { fetchUserPermissionsMatrix } from '@/app/(system)/company/settings/access-scopes/actions'

interface PermissionModule {
  key: string
  label: string
  actions: { key: string; label: string }[]
}

interface Props {
  userId: string
  userName: string
  projects: { id: string; arabic_name: string }[]
  isOpen: boolean
  onClose: () => void
}

export default function EffectivePermissionsModal({ userId, userName, projects, isOpen, onClose }: Props) {
  const [contextType, setContextType] = useState<'global' | 'project'>('global')
  const [projectId, setProjectId] = useState<string>('')
  const [matrix, setMatrix] = useState<PermissionModule[] | null>(null)
  const [isPending, startTransition] = useTransition()
  const [hasFetched, setHasFetched] = useState(false)

  const handleFetch = () => {
    if (contextType === 'project' && !projectId) return
    startTransition(async () => {
      const result = await fetchUserPermissionsMatrix(userId, contextType === 'project' ? projectId : undefined)
      setMatrix(result)
      setHasFetched(true)
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-background-secondary px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">الصلاحيات الفعلية للموظف</h2>
            <p className="text-xs text-text-secondary mt-1">
              عرض الصلاحيات النهائية الممنوحة للموظف <span className="font-semibold text-primary">{userName}</span> بناءً على القوالب والنطاقات.
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-text-secondary hover:bg-black/5 hover:text-text-primary transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 p-5 border-b border-border bg-white">
          <div className="flex-1 flex items-end gap-3">
            <div className="space-y-1.5 flex-1 max-w-[200px]">
              <label className="text-xs font-semibold text-text-secondary">سياق الاستعلام <span className="text-danger">*</span></label>
              <select
                value={contextType}
                onChange={e => {
                  setContextType(e.target.value as 'global' | 'project')
                  setMatrix(null)
                  setHasFetched(false)
                }}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="global">الشركة (كل المشاريع، الشركة الرئيسية)</option>
                <option value="project">مشروع محدد</option>
              </select>
            </div>

            {contextType === 'project' && (
              <div className="space-y-1.5 flex-1 max-w-[300px]">
                <label className="text-xs font-semibold text-text-secondary">المشروع <span className="text-danger">*</span></label>
                <select
                  value={projectId}
                  onChange={e => {
                    setProjectId(e.target.value)
                    setMatrix(null)
                    setHasFetched(false)
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="">— اختر المشروع —</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.arabic_name}</option>
                  ))}
                </select>
              </div>
            )}
            
            <button
              onClick={handleFetch}
              disabled={isPending || (contextType === 'project' && !projectId)}
              className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy/90 disabled:opacity-50 h-[38px]"
            >
              {isPending ? 'جاري الفحص...' : 'عرض الصلاحيات'}
            </button>
          </div>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30">
          {!hasFetched ? (
            <div className="h-40 flex items-center justify-center text-sm text-text-secondary">
              اضغط على عرض الصلاحيات لاستعراض المصفوفة النهائية
            </div>
          ) : matrix && matrix.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-border bg-white text-center">
              <svg className="h-10 w-10 text-danger/60 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V4m0 0l-2 2m2-2l2 2" />
              </svg>
              <h3 className="text-base font-semibold text-text-primary">لا يوجد صلاحيات</h3>
              <p className="mt-1 text-sm text-text-secondary">هذا الموظف لا يمتلك أي صلاحيات في هذا السياق.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matrix?.map(module => (
                <div key={module.key} className="rounded-xl border border-border bg-white overflow-hidden shadow-sm flex flex-col sm:flex-row">
                  <div className="bg-background-secondary/30 px-5 py-4 font-semibold text-text-primary border-b sm:border-b-0 sm:border-l border-border/50 sm:w-1/3 md:w-1/4 flex items-center">
                    {module.label}
                  </div>
                  <div className="p-4 flex-1 flex flex-wrap gap-2">
                    {module.actions.map(a => (
                      <span key={a.key} className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        <svg className="ml-1 h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {a.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
