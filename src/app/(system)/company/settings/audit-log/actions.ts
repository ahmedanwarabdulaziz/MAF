'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { requireSuperAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

export async function deleteAllAuditLogs(): Promise<{ success: boolean; deleted: number }> {
  await requireSuperAdmin()
  const admin = createAdminClient()

  // Count first so we can report how many were deleted
  const { count, error: countErr } = await admin
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })

  if (countErr) throw new Error(countErr.message)

  // Use admin client to bypass RLS (no DELETE policy exists for regular session)
  const { error } = await admin
    .from('audit_logs')
    .delete()
    .gte('created_at', '1970-01-01') // match all rows

  if (error) throw new Error('فشل الحذف: ' + error.message)

  // Write one fresh log to mark the clearing event
  await writeAuditLog({
    action: 'audit_logs_cleared',
    entity_type: 'audit_logs',
    description: `حذف سجل النشاط بالكامل (${count ?? 0} سجل)`,
    metadata: { deleted_count: count ?? 0 },
  })

  revalidatePath('/company/settings/audit-log')
  return { success: true, deleted: count ?? 0 }
}
