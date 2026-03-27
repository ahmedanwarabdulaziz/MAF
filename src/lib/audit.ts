import { createClient } from '@/lib/supabase-server'

export interface AuditPayload {
  action: string          // e.g. 'grant_scope', 'revoke_scope', 'save_permissions'
  entity_type?: string    // e.g. 'user_access_scope', 'permission_group'
  entity_id?: string
  description: string     // Arabic human-readable summary
  metadata?: Record<string, unknown>
}

/**
 * Write one audit log entry.
 * Call inside any server action after a successful DB change.
 * Failures are silently swallowed so auditing never breaks the main flow.
 */
export async function writeAuditLog(payload: AuditPayload): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    await supabase.from('audit_logs').insert({
      performed_by: authUser?.id ?? null,
      action: payload.action,
      entity_type: payload.entity_type ?? null,
      entity_id: payload.entity_id ?? null,
      description: payload.description,
      metadata: payload.metadata ?? null,
    })
  } catch {
    // Audit failures must never crash the application
  }
}
