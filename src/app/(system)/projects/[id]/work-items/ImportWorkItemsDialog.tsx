'use client'

import { useState, useEffect } from 'react'
import { getOtherProjects, getProjectWorkItems, importWorkItems } from '@/actions/agreements'

export default function ImportWorkItemsDialog({ projectId, onSuccess }: { projectId: string, onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  
  const [items, setItems] = useState<any[]>([])
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadProjects()
      // reset state on open
      setSelectedProjectId('')
      setItems([])
      setSelectedItemIds([])
      setError(null)
    }
  }, [isOpen])

  async function loadProjects() {
    setLoadingProjects(true)
    try {
      const data = await getOtherProjects(projectId)
      setProjects(data || [])
    } catch (err: any) {
      setError(err.message || 'فشل تحميل المشاريع')
    } finally {
      setLoadingProjects(false)
    }
  }

  async function handleProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setSelectedProjectId(val)
    setSelectedItemIds([])
    
    if (!val) {
      setItems([])
      return
    }

    setLoadingItems(true)
    setError(null)
    try {
      const data = await getProjectWorkItems(val)
      setItems(data || [])
    } catch (err: any) {
      setError(err.message || 'فشل تحميل البنود')
    } finally {
      setLoadingItems(false)
    }
  }

  function handleSelectAll() {
    if (selectedItemIds.length === items.length) {
      setSelectedItemIds([]) // deselect all
    } else {
      setSelectedItemIds(items.map(i => i.id)) // select all
    }
  }

  function toggleItem(id: string) {
    if (selectedItemIds.includes(id)) {
      setSelectedItemIds(selectedItemIds.filter(i => i !== id))
    } else {
      setSelectedItemIds([...selectedItemIds, id])
    }
  }

  async function handleImport() {
    if (selectedItemIds.length === 0) {
      setError('يرجى اختيار بند واحد على الأقل للاستيراد')
      return
    }

    setImporting(true)
    setError(null)
    try {
      await importWorkItems(projectId, selectedItemIds)
      setIsOpen(false)
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الاستيراد')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-navy/5 text-navy border border-navy/20 px-4 py-2 text-sm font-semibold hover:bg-navy/10 transition-colors flex items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        استيراد من مشروع آخر
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => !importing && setIsOpen(false)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-xl overflow-hidden">
            
            {/* Header */}
            <div className="bg-navy px-6 py-4 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-white">استيراد بنود أعمال</h2>
              <button disabled={importing} onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 bg-background-secondary/30 flex flex-col gap-4">
              
              {error && (
                <div className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-sm text-danger font-bold text-center">
                  {error}
                </div>
              )}

              {/* Step 1: Select Project */}
              <div className="flex flex-col gap-2 relative z-20">
                <label className="text-sm font-medium text-text-primary">١. اختر المشروع المصدر</label>
                <select
                  value={selectedProjectId}
                  onChange={handleProjectChange}
                  disabled={loadingProjects || importing}
                  className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
                >
                  <option value="">-- اختر مشروع --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.arabic_name} ({p.project_code})</option>
                  ))}
                </select>
                {loadingProjects && <span className="text-xs text-text-tertiary">جاري تحميل قائمة المشاريع...</span>}
              </div>

              {/* Step 2: Select Items */}
              {selectedProjectId && (
                <div className="flex flex-col gap-2 flex-1 min-h-[300px] mt-2 relative z-10">
                  <div className="flex justify-between items-end">
                    <label className="text-sm font-medium text-text-primary">٢. حدد البنود المراد استيرادها</label>
                    <button 
                      onClick={handleSelectAll} 
                      className="text-primary text-xs font-semibold hover:underline bg-primary/5 px-2 py-1 rounded"
                    >
                      {selectedItemIds.length === items.length && items.length > 0 ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                    </button>
                  </div>
                  
                  <div className="flex-1 rounded-xl border border-border bg-white overflow-y-auto">
                    {loadingItems ? (
                      <div className="p-8 text-center text-sm text-text-secondary">جاري تحميل البنود...</div>
                    ) : items.length === 0 ? (
                      <div className="p-8 text-center text-sm text-text-secondary">لا توجد بنود أعمال في هذا المشروع.</div>
                    ) : (
                      <table className="w-full text-right text-sm">
                        <thead className="bg-background-secondary border-b border-border sticky top-0">
                          <tr>
                            <th className="w-12 px-4 py-3 text-center">
                              <input 
                                type="checkbox" 
                                checked={selectedItemIds.length === items.length && items.length > 0}
                                onChange={handleSelectAll}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                              />
                            </th>
                            <th className="px-4 py-3 font-semibold text-text-secondary text-xs">الكود</th>
                            <th className="px-4 py-3 font-semibold text-text-secondary text-xs">وصف البند</th>
                            <th className="px-4 py-3 font-semibold text-text-secondary text-center text-xs">سعر المالك</th>
                            <th className="px-4 py-3 font-semibold text-text-secondary text-center text-xs">سعر الباطن</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {items.map(item => (
                            <tr key={item.id} className="hover:bg-background-secondary/50 transition-colors">
                              <td className="px-4 py-2.5 text-center">
                                <input 
                                  type="checkbox" 
                                  checked={selectedItemIds.includes(item.id)}
                                  onChange={() => toggleItem(item.id)}
                                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-2.5 font-medium text-text-primary">{item.item_code}</td>
                              <td className="px-4 py-2.5 text-text-primary">{item.arabic_description}</td>
                              <td className="px-4 py-2.5 text-center dir-ltr text-text-secondary">{Number(item.owner_price || 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-center dir-ltr text-text-secondary">{Number(item.subcontractor_price || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="text-xs text-text-tertiary">
                    تم تحديد {selectedItemIds.length} من أصل {items.length} بند
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-background px-6 py-4 border-t border-border flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={importing}
                className="rounded-lg px-6 py-2 text-sm font-semibold text-text-secondary hover:bg-background-secondary transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || selectedItemIds.length === 0}
                className="rounded-lg bg-primary px-8 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center min-w-[120px]"
              >
                {importing ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  'استيراد البنود المحددة'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
