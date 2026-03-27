'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateUserAction } from '../actions'
import Link from 'next/link'

interface PermissionGroup {
  id: string
  group_key: string
  arabic_name: string
}

interface UserData {
  id: string
  display_name: string
  is_active: boolean
  is_super_admin: boolean
}

export default function EditUserForm({
  user,
  permissionGroups,
  assignedGroupIds,
}: {
  user: UserData
  permissionGroups: PermissionGroup[]
  assignedGroupIds: string[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Manage checked state for permission groups locally
  const [selectedGroups, setSelectedGroups] = useState<string[]>(assignedGroupIds)

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    
    // add selected groups manually since we controlled them
    selectedGroups.forEach(id => {
      formData.append('permission_groups', id)
    })

    const result = await updateUserAction(user.id, formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/company/settings/users')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="p-6 space-y-8">
        {error && (
          <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger border border-danger/20">
            {error}
          </div>
        )}

        {/* Section: Basic info */}
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-4 border-b border-border pb-2">البيانات الأساسية</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-text-primary">
                الاسم بالكامل <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                name="display_name"
                defaultValue={user.display_name}
                required
                className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
              />
            </div>
            
            <div className="pt-2 sm:col-span-2 grid grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-background-secondary transition-colors cursor-pointer">
                <input 
                  type="checkbox" 
                  name="is_active" 
                  defaultChecked={user.is_active}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 bg-white"
                />
                <div>
                  <div className="text-sm font-medium text-text-primary">حساب نشط</div>
                  <div className="text-xs text-text-secondary mt-0.5">يمكنه تسجيل الدخول</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-danger/20 bg-danger/5 hover:bg-danger/10 transition-colors cursor-pointer">
                <input 
                  type="checkbox" 
                  name="is_super_admin" 
                  defaultChecked={user.is_super_admin}
                  className="h-4 w-4 rounded border-danger text-danger focus:ring-danger/20 bg-white"
                />
                <div>
                  <div className="text-sm font-medium text-danger">مدير نظام (Super Admin)</div>
                  <div className="text-xs text-danger/70 mt-0.5">تحكم كامل</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Section: Permission Groups */}
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-4 border-b border-border pb-2">مجموعات الصلاحيات</h2>
          
          <div className="grid sm:grid-cols-2 gap-3">
            {permissionGroups.length === 0 ? (
              <p className="text-sm text-text-secondary col-span-2">لا توجد مجموعات صلاحيات متاحة حالياً.</p>
            ) : (
              permissionGroups.map(group => {
                const isSelected = selectedGroups.includes(group.id)
                return (
                  <div 
                    key={group.id}
                    onClick={() => toggleGroup(group.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-background-secondary'
                    }`}
                  >
                    <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-primary bg-primary' : 'border-border bg-white'
                    }`}>
                      {isSelected && (
                        <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 10 10">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text-primary">{group.arabic_name}</div>
                      <div className="text-xs text-text-secondary mt-0.5" dir="ltr">{group.group_key}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>

      <div className="border-t border-border bg-background-secondary px-6 py-4 flex items-center justify-end gap-3">
        <Link
          href="/company/settings/users"
          className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-border/50 transition-colors"
        >
          إلغاء
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>
    </form>
  )
}
