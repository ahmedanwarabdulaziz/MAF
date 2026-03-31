'use server'

import { writeAuditLog, AuditPayload } from '@/lib/audit'

// Exposes audit logging to client components
export async function logClientAction(payload: AuditPayload) {
  await writeAuditLog(payload)
}
