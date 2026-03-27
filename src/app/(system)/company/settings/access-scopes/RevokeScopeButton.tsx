'use client'

import { useState } from 'react'
import { revokeAccessScopeAction } from './actions'

export default function RevokeScopeButton({ scopeId }: { scopeId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleRevoke() {
    if (!confirm('هل أنت متأكد من إيقاف هذا النطاق؟')) return

    setLoading(true)
    const result = await revokeAccessScopeAction(scopeId)
    
    if (result.error) {
      alert(result.error)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleRevoke}
      disabled={loading}
      className="text-xs text-danger hover:underline disabled:opacity-50"
    >
      {loading ? 'جاري الإيقاف...' : 'إيقاف النطاق'}
    </button>
  )
}
