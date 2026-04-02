'use server'

import { createClient } from '@/lib/supabase-server'
import { WorkInboxItem, WorkInboxPriority, WorkInboxItemType } from '@/lib/work-inbox-types'
import { getWorkInboxData } from '@/actions/work-inbox'

// The raw format representing the DB row
export type SystemNotificationRecord = {
  id: string
  user_id: string | null
  role_id: string | null
  item_type: WorkInboxItemType
  source_id: string
  project_id: string | null
  title: string
  message: string | null
  priority: WorkInboxPriority
  is_read: boolean
  read_at: string | null
  action_url: string | null
  created_at: string
}

export type FetchNotificationsResult = {
  items: WorkInboxItem[]
  counts: {
    total: number
    critical: number
    high: number
    normal: number
    byType: Partial<Record<WorkInboxItemType, number>>
  }
}

/**
 * Helper to create a single notification row in the database
 */
export async function createSystemNotification(params: {
  userId?: string
  roleId?: string
  itemType: WorkInboxItemType
  sourceId: string
  projectId?: string
  title: string
  message?: string
  priority?: WorkInboxPriority
  actionUrl?: string
}) {
  const supabase = createClient()
  
  if (!params.userId && !params.roleId) {
    throw new Error('Notification must target either a userId or a roleId')
  }

  const { error } = await supabase.from('system_notifications').insert({
    user_id: params.userId || null,
    role_id: params.roleId || null,
    item_type: params.itemType,
    source_id: params.sourceId,
    project_id: params.projectId || null,
    title: params.title,
    message: params.message || null,
    priority: params.priority || 'normal',
    action_url: params.actionUrl || null,
  })

  if (error) {
    console.error('[createSystemNotification] failed:', error)
  }
}

/**
 * Mark a specific notification read state
 */
export async function markNotificationAsRead(id: string, isRead = true) {
  const supabase = createClient()
  const { error } = await supabase
    .from('system_notifications')
    .update({ 
      is_read: isRead,
      read_at: isRead ? new Date().toISOString() : null
    })
    .eq('id', id)

  if (error) {
    console.error('[markNotificationAsRead] failed:', error)
  }
}

/**
 * Mark all user notifications as read
 */
export async function markAllUserNotificationsAsRead() {
  const supabase = createClient()
  
  // Gets current user context implicitly from the RLS session constraint if we simply update
  // But to be explicit and safe we get the user ID
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('system_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) {
    console.error('[markAllUserNotificationsAsRead] failed:', error)
  }
}

/**
 * Main unification logic
 * For V1, we still want the "Inbox" dynamic items alongside "Notifications".
 * But if we fully migrate, this function returns items from `system_notifications`.
 */
export async function getUserNotifications(projectId?: string): Promise<FetchNotificationsResult> {
  const supabase = createClient()

  // 1. Fetch from persisted table
  let q = supabase
    .from('system_notifications')
    .select('*')
    .order('created_at', { ascending: false })

  if (projectId) {
    q = q.eq('project_id', projectId)
  }

  const { data: records, error } = await q
  
  let DBItems: WorkInboxItem[] = []
  if (!error && records) {
    DBItems = records.map((rec: SystemNotificationRecord) => ({
      id: rec.id, // we map notification.id directly here
      type: rec.item_type,
      sourceId: rec.source_id,
      projectId: rec.project_id,
      projectName: null, // Depending on if we joined projects. Arabic_name
      projectCode: null,
      title: rec.title,
      subtitle: rec.message,
      amount: null,
      currency: null,
      statusLabel: rec.is_read ? 'مقروء' : 'غير مقروء',
      actionLabel: 'استعراض',
      createdAt: rec.created_at,
      dueAt: null,
      ageDays: 0, 
      priority: rec.priority,
      href: rec.action_url || `/company/critical-actions`,
      badges: [],
      metadata: { is_read: rec.is_read }
    }))
  }

  // 2. Fetch the dynamic aggregate logic (The older WI sources)
  // For V1 integration, we can merge them or just rely on notifications.
  // The implementation plan says "keeping the Live Query Aggregation alongside the notifications might be smarter"
  const dynamicInbox = await getWorkInboxData(projectId);

  // We tag dynamic ones as unread theoretically or ignore is_read tracking for them?
  // We'll mark them unread for the UI representation.
  const dynamicMapped = dynamicInbox.items.map(item => ({
    ...item,
    metadata: { ...item.metadata, is_read: false }
  }))

  const merged = [...DBItems, ...dynamicMapped]

  // Re-sort merged: critical first, then newest first
  merged.sort((a, b) => {
    const pOrder: Record<string, number> = { critical: 0, high: 1, normal: 2 }
    const pDiff = pOrder[a.priority] - pOrder[b.priority]
    if (pDiff !== 0) return pDiff
    
    // Fallback sort by recency
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return db - da; 
  })

  // Recalculate totals
  let critical = 0, high = 0, normal = 0
  const byType: Partial<Record<WorkInboxItemType, number>> = {}

  for (const item of merged) {
    byType[item.type] = (byType[item.type] ?? 0) + 1
    if (item.priority === 'critical') critical++
    else if (item.priority === 'high') high++
    else normal++
  }

  return {
    items: merged,
    counts: { total: merged.length, critical, high, normal, byType },
  }
}
