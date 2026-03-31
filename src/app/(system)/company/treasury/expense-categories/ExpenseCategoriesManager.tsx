'use client'

import React, { useState } from 'react'
import { createExpenseGroup, createExpenseItem } from '@/actions/expense_categories'

export default function ExpenseCategoriesManager({ 
    initialGroups, 
    initialItems 
}: { 
    initialGroups: any[], 
    initialItems: any[] 
}) {
    const [groups, setGroups] = useState(initialGroups)
    const [items, setItems] = useState(initialItems)

    const [isAddingGroup, setIsAddingGroup] = useState(false)
    const [newGroupCode, setNewGroupCode] = useState('')
    const [newGroupName, setNewGroupName] = useState('')

    const [isAddingItemForGroup, setIsAddingItemForGroup] = useState<string | null>(null)
    const [newItemCode, setNewItemCode] = useState('')
    const [newItemName, setNewItemName] = useState('')

    const [searchQuery, setSearchQuery] = useState('')
    const [expandedGroups, setExpandedGroups] = useState<string[]>([])

    const [errorMsg, setErrorMsg] = useState('')

    async function handleAddGroup(e: React.FormEvent) {
        e.preventDefault()
        setErrorMsg('')
        try {
            const added = await createExpenseGroup({ arabic_name: newGroupName, group_code: newGroupCode })
            setGroups(prev => [...prev, added])
            setIsAddingGroup(false)
            setNewGroupCode('')
            setNewGroupName('')
        } catch (err: any) {
            setErrorMsg(err.message)
        }
    }

    async function handleAddItem(e: React.FormEvent, groupId: string) {
        e.preventDefault()
        setErrorMsg('')
        try {
            const added = await createExpenseItem({ expense_group_id: groupId, arabic_name: newItemName, item_code: newItemCode })
            setItems(prev => [...prev, added])
            setIsAddingItemForGroup(null)
            setNewItemCode('')
            setNewItemName('')
        } catch (err: any) {
            setErrorMsg(err.message)
        }
    }

    const filteredGroups = groups.filter(g => {
        if (!searchQuery) return true;
        const lowerQ = searchQuery.toLowerCase();
        const matchesGroup = g.arabic_name?.toLowerCase().includes(lowerQ) || g.group_code?.toLowerCase().includes(lowerQ);
        const hasMatchingItems = items.some(i => i.expense_group_id === g.id && (i.arabic_name?.toLowerCase().includes(lowerQ) || i.item_code?.toLowerCase().includes(lowerQ)));
        return matchesGroup || hasMatchingItems;
    });

    const toggleGroup = (id: string) => {
        setExpandedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
    };

    return (
        <div className="space-y-6">
            {errorMsg && (
                <div className="bg-red-50 text-red-700 p-4 rounded-md text-sm">
                    {errorMsg}
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/30 p-4 rounded-md border">
                <div>
                    <h2 className="text-lg font-bold">مجموعات المصروفات (التصنيفات الرئيسية)</h2>
                    <p className="text-sm text-muted-foreground">قم بإضافة وتصنيف المجموعات المحاسبية للنثريات.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <input 
                        type="search" 
                        placeholder="ابحث بالاسم أو الكود..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="flex-1 md:w-64 h-9 rounded-md border px-3 text-sm shadow-sm"
                    />
                    {!isAddingGroup && (
                        <button onClick={() => {
                            setIsAddingGroup(true)
                            let maxNum = 0;
                            groups.forEach(g => {
                                if (g.group_code?.startsWith('EXP-')) {
                                    const num = parseInt(g.group_code.replace('EXP-', ''), 10);
                                    if (!isNaN(num) && num > maxNum) maxNum = num;
                                }
                            });
                            setNewGroupCode(`EXP-${String(maxNum + 1).padStart(3, '0')}`);
                        }} className="bg-primary text-primary-foreground text-sm px-4 h-9 rounded-md font-medium hover:bg-primary/90 whitespace-nowrap">
                            + مجموعة جديدة
                        </button>
                    )}
                </div>
            </div>

            {isAddingGroup && (
                <form onSubmit={handleAddGroup} className="p-4 bg-muted/10 border rounded-md grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold">كود المجموعة</label>
                        <input type="text" value={newGroupCode} readOnly className="w-full flex h-9 rounded-md border px-3 py-1 text-sm shadow-sm bg-muted text-muted-foreground cursor-not-allowed" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold">الاسم بالعربية</label>
                        <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} required className="w-full flex h-9 rounded-md border px-3 py-1 text-sm shadow-sm" />
                    </div>
                    <div className="flex items-end gap-2">
                        <button type="submit" className="bg-primary text-primary-foreground text-sm px-4 h-9 rounded-md">حفظ</button>
                        <button type="button" onClick={() => setIsAddingGroup(false)} className="bg-secondary text-secondary-foreground border text-sm px-4 h-9 rounded-md">إلغاء</button>
                    </div>
                </form>
            )}

            <div className="border rounded-xl shadow-sm bg-card divide-y overflow-hidden">
                {filteredGroups.length > 0 ? filteredGroups.map(group => {
                    const isExpanded = expandedGroups.includes(group.id) || searchQuery.length > 0;
                    
                    const groupItems = items.filter(i => i.expense_group_id === group.id).filter(i => {
                        if (!searchQuery) return true;
                        const lowerQ = searchQuery.toLowerCase();
                        // If group matches, show all its items. If group doesn't match, only show matching items.
                        if (group.arabic_name?.toLowerCase().includes(lowerQ) || group.group_code?.toLowerCase().includes(lowerQ)) return true;
                        return i.arabic_name?.toLowerCase().includes(lowerQ) || i.item_code?.toLowerCase().includes(lowerQ);
                    });

                    return (
                        <div key={group.id} className="flex flex-col">
                            <div 
                                onClick={() => toggleGroup(group.id)} 
                                className="flex justify-between items-center p-4 hover:bg-muted/30 cursor-pointer transition-colors select-none group"
                            >
                                <div className="flex items-center gap-3">
                                    <svg className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                    <div>
                                        <div className="text-xs font-mono text-muted-foreground">{group.group_code}</div>
                                        <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">{group.arabic_name}</h3>
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                                    {groupItems.length} بنود
                                </div>
                            </div>
                            
                            {isExpanded && (
                                <div className="bg-muted/5 border-t p-4 pl-4 pr-12 md:pr-14">
                                    <div className="rounded-lg border bg-card overflow-hidden">
                                        <table className="w-full text-sm text-right">
                                            <thead className="bg-muted/30 text-muted-foreground">
                                                <tr>
                                                    <th className="font-semibold p-3 w-32 border-b">كود البند</th>
                                                    <th className="font-semibold p-3 border-b">اسم البند</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {groupItems.length > 0 ? groupItems.map((item) => (
                                                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                                                        <td className="p-3 font-mono text-xs text-muted-foreground">{item.item_code}</td>
                                                        <td className="p-3 font-medium">{item.arabic_name}</td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={2} className="p-6 text-center text-muted-foreground text-sm">
                                                            لا يوجد بنود مسجلة هنا.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    <div className="mt-4">
                                        {isAddingItemForGroup === group.id ? (
                                            <form onSubmit={(e) => handleAddItem(e, group.id)} className="flex flex-col md:flex-row items-start md:items-center gap-2 p-3 bg-muted/20 border rounded-lg">
                                                <input type="text" placeholder="كود البند" value={newItemCode} readOnly className="w-full md:w-32 h-9 text-xs px-3 border rounded-md bg-muted text-muted-foreground cursor-not-allowed" />
                                                <input type="text" placeholder="اسم البند بالعربية" value={newItemName} onChange={e => setNewItemName(e.target.value)} required className="w-full h-9 text-sm px-3 border rounded-md font-medium" />
                                                <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                                                    <button type="submit" className="flex-1 md:flex-none bg-primary text-primary-foreground text-sm px-4 h-9 rounded-md">حفظ</button>
                                                    <button type="button" onClick={() => setIsAddingItemForGroup(null)} className="flex-1 md:flex-none bg-secondary border text-secondary-foreground text-sm px-4 h-9 rounded-md">إلغاء</button>
                                                </div>
                                            </form>
                                        ) : (
                                            <button onClick={() => {
                                                setIsAddingItemForGroup(group.id)
                                                let maxTotalNum = 0;
                                                items.forEach(i => {
                                                    if (i.item_code?.startsWith('ITM-')) {
                                                        const num = parseInt(i.item_code.replace('ITM-', ''), 10);
                                                        if (!isNaN(num) && num > maxTotalNum) maxTotalNum = num;
                                                    }
                                                });
                                                setNewItemCode(`ITM-${String(maxTotalNum + 1).padStart(3, '0')}`);
                                                setNewItemName('')
                                            }} className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                                إضافة بند جديد لـ {group.arabic_name}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }) : (
                    <div className="text-center py-16 text-muted-foreground">
                        {searchQuery ? 'لا توجد نتائج مطابقة للبحث.' : 'لا توجد أي مجموعات حالياً. أضف المجموعة الأولى لبدء تكوين التبويبات.'}
                    </div>
                )}
            </div>
        </div>
    )
}
