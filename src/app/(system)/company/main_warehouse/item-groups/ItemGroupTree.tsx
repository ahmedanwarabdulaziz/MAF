'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Group {
  id: string
  group_code: string
  arabic_name: string
  english_name: string | null
  is_active: boolean
  parent_group_id: string | null
}

function GroupRow({ group, children, depth = 0 }: { group: Group; children: Group[]; depth?: number }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = children.length > 0

  return (
    <>
      <div
        className={`flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 ${
          depth === 0 ? 'border-l-4 border-l-primary/40' : 'border-l-4 border-l-border ml-8'
        }`}
        style={{ marginRight: depth * 32 }}
      >
        {/* Expand/collapse toggle */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-secondary transition-colors ${
            hasChildren ? 'hover:bg-border/50 cursor-pointer' : 'opacity-0 pointer-events-none'
          }`}
        >
          <span className="text-xs">{expanded ? '▼' : '▶'}</span>
        </button>

        {/* Group icon */}
        <span className="text-lg">{depth === 0 ? '📁' : '📂'}</span>

        {/* Code badge */}
        <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary" dir="ltr">
          {group.group_code}
        </span>

        {/* Names */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-text-primary text-sm truncate">{group.arabic_name}</div>
          {group.english_name && (
            <div className="text-xs text-text-secondary truncate" dir="ltr">{group.english_name}</div>
          )}
        </div>

        {/* Children count */}
        {hasChildren && (
          <span className="shrink-0 rounded-full bg-background-secondary px-2.5 py-0.5 text-xs text-text-secondary">
            {children.length} فئة فرعية
          </span>
        )}

        {/* Status */}
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          group.is_active ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
        }`}>
          {group.is_active ? 'نشط' : 'موقوف'}
        </span>

        {/* Edit link */}
        <Link
          href={`/company/main_warehouse/item-groups/${group.id}`}
          className="shrink-0 rounded-lg border border-border px-3 py-1 text-xs font-medium text-text-secondary hover:border-primary hover:text-primary transition-colors"
        >
          تعديل
        </Link>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {children.map(child => (
            <GroupRow key={child.id} group={child} children={[]} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  )
}

export default function ItemGroupTree({ groups }: { groups: Group[] }) {
  const roots    = groups.filter(g => !g.parent_group_id)
  const childMap = groups.reduce<Record<string, Group[]>>((acc, g) => {
    if (g.parent_group_id) {
      acc[g.parent_group_id] = [...(acc[g.parent_group_id] ?? []), g]
    }
    return acc
  }, {})

  return (
    <div className="space-y-1.5">
      {roots.map(root => (
        <GroupRow key={root.id} group={root} children={childMap[root.id] ?? []} depth={0} />
      ))}
      {/* Orphaned children (parent deleted) shown at root */}
      {groups
        .filter(g => g.parent_group_id && !groups.find(p => p.id === g.parent_group_id))
        .map(g => (
          <GroupRow key={g.id} group={g} children={[]} depth={0} />
        ))}
    </div>
  )
}
