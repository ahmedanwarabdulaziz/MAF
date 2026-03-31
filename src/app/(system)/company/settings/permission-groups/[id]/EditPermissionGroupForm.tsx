'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePermissionGroupMatrixAction } from '../actions'

interface Permission {
  module_key: string
  module_name_ar: string
  action_key: string
  action_name_ar: string
}

interface Group {
  id: string
  group_key: string
  arabic_name: string
  is_system_group: boolean
  is_active: boolean
}

const MODULE_GROUPS = [
  {
    label: 'الوحدات المشتركة',
    modules: ['dashboard', 'approvals', 'attachments', 'projects'],
  },
  {
    label: 'الحوكمة والإدارة',
    modules: ['users_and_access', 'approval_workflows', 'settings', 'cutover'],
  },
  {
    label: 'الشركة الرئيسية',
    modules: ['treasury', 'assets', 'item_master', 'main_warehouse', 'party_masters', 'corporate_expenses', 'consolidated_reports'],
  },
  {
    label: 'الموقع والمشروع',
    modules: ['project_profile', 'subcontractor_certificates', 'supplier_procurement', 'project_warehouse', 'employee_custody', 'owner_billing', 'payments', 'project_documents', 'project_reports'],
  },
]

export default function EditPermissionGroupForm({
  group,
  allPermissions,
  initiallyAllowed,
}: {
  group: Group
  allPermissions: Permission[]
  initiallyAllowed: string[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allowedSet, setAllowedSet] = useState<Set<string>>(new Set(initiallyAllowed))

  const disabled = group.is_system_group

  // Build maps
  const moduleNameMap: Record<string, string> = {}
  const actionMap: Record<string, { action_key: string; action_name_ar: string }[]> = {}
  allPermissions.forEach(p => {
    moduleNameMap[p.module_key] = p.module_name_ar
    if (!actionMap[p.module_key]) actionMap[p.module_key] = []
    actionMap[p.module_key].push({ action_key: p.action_key, action_name_ar: p.action_name_ar })
  })

  const toggle = (moduleKey: string, actionKey: string) => {
    if (disabled) return
    const key = `${moduleKey}:${actionKey}`
    setAllowedSet(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Toggle all actions within a section group
  const toggleSection = (modules: string[]) => {
    if (disabled) return
    const allKeys = modules.flatMap(m =>
      (actionMap[m] ?? []).map(a => `${m}:${a.action_key}`)
    )
    const allOn = allKeys.every(k => allowedSet.has(k))
    setAllowedSet(prev => {
      const next = new Set(prev)
      if (allOn) allKeys.forEach(k => next.delete(k))
      else allKeys.forEach(k => next.add(k))
      return next
    })
  }

  const isSectionOn = (modules: string[]) => {
    const allKeys = modules.flatMap(m =>
      (actionMap[m] ?? []).map(a => `${m}:${a.action_key}`)
    )
    return allKeys.length > 0 && allKeys.every(k => allowedSet.has(k))
  }

  async function handleSave() {
    if (disabled) return
    setLoading(true)
    setError(null)

    const result = await updatePermissionGroupMatrixAction(group.id, Array.from(allowedSet))
    setLoading(false)
    if (result.error) setError(result.error)
    else router.push('/company/settings/permission-groups')
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger border border-danger/20">
          {error}
        </div>
      )}

      {MODULE_GROUPS.map(mg => {
        const relevantModules = mg.modules.filter(m => actionMap[m])
        if (!relevantModules.length) return null

        const sectionOn = isSectionOn(relevantModules)

        return (
          <div key={mg.label} className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            {/* Section header — blue background + master toggle */}
            <div className="flex items-center justify-between bg-primary px-5 py-3">
              <h2 className="font-bold text-white text-sm tracking-wide">{mg.label}</h2>
              <div className="flex items-center gap-2">
                <span className="text-white/80 text-xs font-medium">تحديد الكل</span>
                <input
                  type="checkbox"
                  checked={sectionOn}
                  onChange={() => toggleSection(relevantModules)}
                  disabled={disabled}
                  className="w-4 h-4 text-emerald-500 rounded border-white/30 bg-white/10 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>

            {/* Collect all unique action keys for this section for column alignment */}
            {(() => {
              // Build ordered unique action keys across all modules in this section
              const allActionKeys: { key: string; label: string }[] = []
              const seen = new Set<string>()
              relevantModules.forEach(m => {
                (actionMap[m] ?? []).forEach(a => {
                  if (!seen.has(a.action_key)) {
                    seen.add(a.action_key)
                    allActionKeys.push({ key: a.action_key, label: a.action_name_ar })
                  }
                })
              })

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    {/* Column headers */}
                    <thead>
                      <tr className="border-b border-border bg-background-secondary/50">
                        <th className="px-5 py-2.5 text-right text-xs font-semibold text-text-secondary w-56">
                          الوحدة
                        </th>
                        {allActionKeys.map(a => (
                          <th key={a.key} className="px-4 py-2.5 text-center text-xs font-semibold text-text-secondary whitespace-nowrap">
                            {a.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {relevantModules.map(moduleKey => {
                        const moduleActions = actionMap[moduleKey] ?? []
                        const moduleActionKeys = new Set(moduleActions.map(a => a.action_key))
                        return (
                          <tr key={moduleKey} className="hover:bg-background-secondary/30 transition-colors">
                            <td className="px-5 py-3 font-semibold text-text-primary text-sm whitespace-nowrap">
                              {moduleNameMap[moduleKey] ?? moduleKey}
                            </td>
                            {allActionKeys.map(a => {
                              if (!moduleActionKeys.has(a.key)) {
                                return <td key={a.key} className="px-4 py-3 text-center" />
                              }
                              const permKey = `${moduleKey}:${a.key}`
                              const on = allowedSet.has(permKey)
                              return (
                                <td key={a.key} className="px-4 py-3 text-center">
                                  <div className="flex justify-center">
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      onChange={() => toggle(moduleKey, a.key)}
                                      disabled={disabled}
                                      className="w-4 h-4 text-primary rounded border-border focus:ring-primary cursor-pointer disabled:opacity-50 transition-colors"
                                    />
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        )
      })}

      {/* Footer */}
      {!disabled ? (
        <div className="flex items-center justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className="rounded-lg bg-primary px-8 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-primary font-medium">قالب نظام محمي</p>
          <p className="mt-1 text-sm text-text-secondary">
            قوالب النظام لا يمكن تعديل صلاحياتها لضمان سير العمليات الأساسية بشكل صحيح.
          </p>
        </div>
      )}
    </div>
  )
}
