'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { updateProject } from '@/actions/projects'

export default function EditProjectOwner({ 
  projectId, 
  currentOwnerId, 
  currentOwnerName 
}: { 
  projectId: string
  currentOwnerId?: string | null
  currentOwnerName?: string
}) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [owners, setOwners] = useState<any[]>([])
  const [selectedOwner, setSelectedOwner] = useState(currentOwnerId || '')

  useEffect(() => {
    if (!isEditing) return
    async function fetchOwners() {
      const supabase = createClient()
      const { data } = await supabase
        .from('parties')
        .select(`id, arabic_name, party_roles!inner(role_type)`)
        .eq('party_roles.role_type', 'owner')
      if (data) setOwners(data)
    }
    fetchOwners()
  }, [isEditing])

  async function handleSave() {
    setLoading(true)
    try {
      await updateProject(projectId, { owner_party_id: selectedOwner || null })
      setIsEditing(false)
      router.refresh()
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء الحفظ')
    } finally {
      setLoading(false)
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <select
          value={selectedOwner}
          onChange={e => setSelectedOwner(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary"
          disabled={loading}
        >
          <option value="">لا يوجد مالك مسجل</option>
          {owners.map(o => (
            <option key={o.id} value={o.id}>{o.arabic_name}</option>
          ))}
        </select>
        <button 
          onClick={handleSave} 
          disabled={loading}
          className="rounded text-xs bg-success/10 text-success font-semibold px-2.5 py-1.5 hover:bg-success/20 transition-colors"
        >
          {loading ? '...' : 'حفظ'}
        </button>
        <button 
          onClick={() => {
            setIsEditing(false)
            setSelectedOwner(currentOwnerId || '')
          }}
          disabled={loading}
          className="rounded text-xs bg-danger/10 text-danger font-semibold px-2.5 py-1.5 hover:bg-danger/20 transition-colors"
        >
          إلغاء
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between group">
      <div className="text-sm font-semibold text-text-primary">
        {currentOwnerName || <span className="text-text-secondary font-normal">لم يتم تعيين جهة مالكة</span>}
      </div>
      <button
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-primary font-medium px-2 py-1 rounded hover:bg-primary/10"
      >
        تعديل
      </button>
    </div>
  )
}
