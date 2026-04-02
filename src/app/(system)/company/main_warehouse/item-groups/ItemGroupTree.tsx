'use client'

import React, { useState } from 'react'
import { createItemGroup } from '@/actions/warehouse'
import Link from 'next/link'
import DeleteItemGroupButton from './DeleteItemGroupButton'

interface Group {
  id: string
  group_code: string
  arabic_name: string
  english_name: string | null
  is_active: boolean
  parent_group_id: string | null
}

export default function ItemGroupTree({ 
    initialGroups,
    companyId
}: { 
    initialGroups: Group[],
    companyId: string
}) {
    const [allGroups, setAllGroups] = useState<Group[]>(initialGroups)

    const [isAddingGroup, setIsAddingGroup] = useState(false)
    const [newGroupCode, setNewGroupCode] = useState('')
    const [newGroupName, setNewGroupName] = useState('')

    const [isAddingItemForGroup, setIsAddingItemForGroup] = useState<string | null>(null)
    const [newItemCode, setNewItemCode] = useState('')
    const [newItemName, setNewItemName] = useState('')

    const [searchQuery, setSearchQuery] = useState('')
    const [expandedGroups, setExpandedGroups] = useState<string[]>([])

    const [errorMsg, setErrorMsg] = useState('')

    const mainGroups = allGroups.filter(g => !g.parent_group_id)
    const subGroups = allGroups.filter(g => g.parent_group_id)

    async function handleAddGroup(e: React.FormEvent) {
        e.preventDefault()
        setErrorMsg('')
        try {
            const added = await createItemGroup({ 
                company_id: companyId,
                arabic_name: newGroupName, 
                group_code: newGroupCode,
                is_active: true
            })
            setAllGroups(prev => [...prev, added])
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
            const added = await createItemGroup({ 
                company_id: companyId,
                parent_group_id: groupId, 
                arabic_name: newItemName, 
                group_code: newItemCode,
                is_active: true
            })
            setAllGroups(prev => [...prev, added])
            setIsAddingItemForGroup(null)
            setNewItemCode('')
            setNewItemName('')
        } catch (err: any) {
            setErrorMsg(err.message)
        }
    }

    const filteredGroups = mainGroups.filter(g => {
        if (!searchQuery) return true;
        const lowerQ = searchQuery.toLowerCase();
        const matchesGroup = g.arabic_name?.toLowerCase().includes(lowerQ) || g.group_code?.toLowerCase().includes(lowerQ);
        const hasMatchingItems = subGroups.some(i => i.parent_group_id === g.id && (i.arabic_name?.toLowerCase().includes(lowerQ) || i.group_code?.toLowerCase().includes(lowerQ)));
        return matchesGroup || hasMatchingItems;
    });

    const toggleGroup = (id: string) => {
        setExpandedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
    };

    return (
        <div className="space-y-6">
            {errorMsg && (
                <div className="bg-danger/10 text-danger p-4 rounded-md text-sm">
                    {errorMsg}
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-background-secondary/30 p-4 rounded-md border border-border">
                <div>
                    <h2 className="text-lg font-bold text-text-primary">مجموعات الأصناف الرئيسية</h2>
                    <p className="text-sm text-text-secondary">قم بإضافة وتصنيف المجموعات المحاسبية والمخزنية.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <input 
                        type="search" 
                        placeholder="ابحث بالاسم أو الكود..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="flex-1 md:w-64 h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:border-primary"
                    />
                    {!isAddingGroup && (
                        <button onClick={() => {
                            setIsAddingGroup(true)
                            let maxNum = 0;
                            allGroups.forEach(g => {
                                if (g.group_code?.startsWith('GRP-')) {
                                    const num = parseInt(g.group_code.replace('GRP-', ''), 10);
                                    if (!isNaN(num) && num > maxNum) maxNum = num;
                                }
                            });
                            setNewGroupCode(`GRP-${String(maxNum + 1).padStart(3, '0')}`);
                        }} className="bg-primary hover:bg-primary/90 text-white text-sm px-4 h-9 rounded-md font-medium transition-colors whitespace-nowrap">
                            + مجموعة جديدة
                        </button>
                    )}
                </div>
            </div>

            {isAddingGroup && (
                <form onSubmit={handleAddGroup} className="p-4 bg-background-secondary/10 border border-border rounded-md grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-text-primary">كود المجموعة</label>
                        <input type="text" value={newGroupCode} readOnly className="w-full h-9 rounded-md border border-border px-3 text-sm bg-background-secondary text-text-secondary cursor-not-allowed" dir="ltr" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-text-primary">الاسم بالعربية</label>
                        <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} required placeholder="مثال: أدوات ومعدات" className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                    </div>
                    <div className="flex items-end gap-2">
                        <button type="submit" className="bg-primary hover:bg-primary/90 text-white text-sm px-4 h-9 rounded-md transition-colors">حفظ</button>
                        <button type="button" onClick={() => setIsAddingGroup(false)} className="bg-background-secondary hover:bg-background-tertiary text-text-secondary border border-border text-sm px-4 h-9 rounded-md transition-colors">إلغاء</button>
                    </div>
                </form>
            )}

            <div className="border border-border rounded-xl shadow-sm bg-white divide-y divide-border overflow-hidden">
                {filteredGroups.length > 0 ? filteredGroups.map(group => {
                    const isExpanded = expandedGroups.includes(group.id) || searchQuery.length > 0;
                    
                    const groupItems = subGroups.filter(i => i.parent_group_id === group.id).filter(i => {
                        if (!searchQuery) return true;
                        const lowerQ = searchQuery.toLowerCase();
                        if (group.arabic_name?.toLowerCase().includes(lowerQ) || group.group_code?.toLowerCase().includes(lowerQ)) return true;
                        return i.arabic_name?.toLowerCase().includes(lowerQ) || i.group_code?.toLowerCase().includes(lowerQ);
                    });

                    return (
                        <div key={group.id} className="flex flex-col">
                            <div 
                                onClick={() => toggleGroup(group.id)} 
                                className="flex justify-between items-center p-4 hover:bg-background-secondary/30 cursor-pointer transition-colors select-none group/item"
                            >
                                <div className="flex items-center gap-3">
                                    <svg className={`w-5 h-5 text-text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                    <div>
                                        <div className="text-xs font-mono text-text-secondary" dir="ltr">{group.group_code}</div>
                                        <h3 className="font-bold text-base text-text-primary group-hover/item:text-primary transition-colors flex items-center gap-2">
                                            {group.arabic_name}
                                            {!group.is_active && <span className="text-[10px] bg-danger/10 text-danger px-2 rounded-full font-normal">موقوف</span>}
                                        </h3>
                                    </div>
                                </div>
                                <div className="flex flex-row items-center gap-3">
                                    <Link 
                                        href={`/company/main_warehouse/item-groups/${group.id}`} 
                                        className="text-xs text-primary hover:text-primary/80"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        تعديل
                                    </Link>
                                    <DeleteItemGroupButton groupId={group.id} groupName={group.arabic_name as string} />
                                    <div className="text-xs text-text-secondary bg-background-secondary px-2 py-1 rounded-full">
                                        {groupItems.length} فئة فرعية
                                    </div>
                                </div>
                            </div>
                            
                            {isExpanded && (
                                <div className="bg-background-secondary/10 border-t border-border p-4 pl-4 pr-12 md:pr-14">
                                    <div className="rounded-lg border border-border bg-white overflow-hidden">
                                        <table className="w-full text-sm text-right">
                                            <thead className="bg-background-secondary/30 text-text-secondary">
                                                <tr>
                                                    <th className="font-semibold p-3 w-32 border-b border-border">كود الفئة</th>
                                                    <th className="font-semibold p-3 border-b border-border">اسم الفئة الفرعية</th>
                                                    <th className="font-semibold p-3 w-20 border-b border-border text-center">الإجراء</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {groupItems.length > 0 ? groupItems.map((item) => (
                                                    <tr key={item.id} className="hover:bg-background-secondary/20 transition-colors">
                                                        <td className="p-3 font-mono text-xs text-text-secondary" dir="ltr">{item.group_code}</td>
                                                        <td className="p-3 font-medium text-text-primary flex items-center gap-2">
                                                            {item.arabic_name}
                                                            {!item.is_active && <span className="text-[10px] bg-danger/10 text-danger px-2 rounded-full font-normal">موقوف</span>}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <Link 
                                                                href={`/company/main_warehouse/item-groups/${item.id}`} 
                                                                className="text-xs text-primary hover:text-primary/80"
                                                            >
                                                                تعديل
                                                            </Link>
                                                            <div className="mx-2 inline-block"></div>
                                                            <DeleteItemGroupButton groupId={item.id} groupName={item.arabic_name as string} />
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={3} className="p-6 text-center text-text-secondary text-sm">
                                                            لا توجد فئات فرعية مسجلة هنا.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    <div className="mt-4">
                                        {isAddingItemForGroup === group.id ? (
                                            <form onSubmit={(e) => handleAddItem(e, group.id)} className="flex flex-col md:flex-row items-start md:items-center gap-2 p-3 bg-background-secondary/20 border border-border rounded-lg">
                                                <input type="text" value={newItemCode} readOnly className="w-full md:w-32 h-9 text-xs px-3 border border-border rounded-md bg-background-secondary text-text-secondary cursor-not-allowed" dir="ltr" />
                                                <input type="text" placeholder="اسم الفئة الفرعية بالعربية" value={newItemName} onChange={e => setNewItemName(e.target.value)} required className="w-full h-9 text-sm px-3 border border-border rounded-md font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                                                <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                                                    <button type="submit" className="flex-1 md:flex-none bg-primary hover:bg-primary/90 text-white text-sm px-4 h-9 rounded-md transition-colors">حفظ</button>
                                                    <button type="button" onClick={() => setIsAddingItemForGroup(null)} className="flex-1 md:flex-none bg-background-secondary hover:bg-background-tertiary border border-border text-text-secondary text-sm px-4 h-9 rounded-md transition-colors">إلغاء</button>
                                                </div>
                                            </form>
                                        ) : (
                                            <button onClick={() => {
                                                setIsAddingItemForGroup(group.id)
                                                let maxTotalNum = 0;
                                                allGroups.forEach(i => {
                                                    if (i.group_code?.startsWith('GRP-')) {
                                                        const num = parseInt(i.group_code.replace('GRP-', ''), 10);
                                                        if (!isNaN(num) && num > maxTotalNum) maxTotalNum = num;
                                                    }
                                                });
                                                setNewItemCode(`GRP-${String(maxTotalNum + 1).padStart(3, '0')}`);
                                                setNewItemName('')
                                            }} className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                                إضافة فئة فرعية لـ {group.arabic_name}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }) : (
                    <div className="text-center py-16 text-text-secondary">
                        {searchQuery ? 'لا توجد نتائج مطابقة للبحث.' : 'لا توجد أي مجموعات حالياً. أضف المجموعة الأولى لبدء تكوين شجرة الأصناف.'}
                    </div>
                )}
            </div>
        </div>
    )
}
