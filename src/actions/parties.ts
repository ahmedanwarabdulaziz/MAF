'use server'

import { createClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/auth'
import { logClientAction } from '@/actions/audit'
import { revalidatePath } from 'next/cache'

/**
 * Checks whether a party is referenced in any business-critical table.
 * Returns a list of human-readable reasons if deletion is blocked.
 */
async function getBlockingReferences(partyId: string): Promise<string[]> {
  const supabase = createClient()
  const blocks: string[] = []

  const checks: Array<{ table: string; column: string; label: string }> = [
    { table: 'project_parties',             column: 'party_id',              label: 'مشروعات مرتبطة' },
    { table: 'subcontractor_agreements',    column: 'subcontractor_party_id', label: 'عقود مقاولي الباطن' },
    { table: 'subcontractor_certificates',  column: 'subcontractor_party_id', label: 'مستخلصات مقاولي الباطن' },
    { table: 'supplier_invoices',           column: 'supplier_party_id',      label: 'فواتير موردين' },
    { table: 'purchase_requests',           column: 'supplier_party_id',      label: 'طلبات شراء' },
    { table: 'owner_invoices',              column: 'owner_party_id',         label: 'فواتير مالك' },
    { table: 'owner_collections',          column: 'owner_party_id',         label: 'تحصيلات مالك' },
    { table: 'payment_voucher_parties',     column: 'party_id',              label: 'سندات صرف' },
    { table: 'advance_payments',            column: 'party_id',              label: 'دفعات مقدمة' },
    { table: 'company_purchases',          column: 'supplier_party_id',      label: 'مشتريات شركة' },
    { table: 'stock_movements',            column: 'supplier_party_id',      label: 'حركات مخزن' },
  ]

  await Promise.all(
    checks.map(async ({ table, column, label }) => {
      const { count } = await supabase
        .from(table as any)
        .select('id', { count: 'exact', head: true })
        .eq(column, partyId)

      if ((count ?? 0) > 0) {
        blocks.push(`${label} (${count})`)
      }
    })
  )

  return blocks
}

export async function deleteParty(partyId: string): Promise<{ success: boolean; error?: string }> {
  await requirePermission('party_masters', 'edit')

  const supabase = createClient()

  // 1. Verify the party exists
  const { data: party, error: fetchErr } = await supabase
    .from('parties')
    .select('id, arabic_name')
    .eq('id', partyId)
    .single()

  if (fetchErr || !party) {
    return { success: false, error: 'جهة التعامل غير موجودة' }
  }

  // 2. Safety check — block if any business data references this party
  const blocks = await getBlockingReferences(partyId)
  if (blocks.length > 0) {
    return {
      success: false,
      error: `لا يمكن حذف هذه الجهة لأنها مرتبطة ببيانات:\n• ${blocks.join('\n• ')}`,
    }
  }

  // 3. Safe to delete — cascade will clean up party_roles, party_contacts,
  //    party_role_accounts, project_party_contacts automatically
  const { error: deleteErr } = await supabase
    .from('parties')
    .delete()
    .eq('id', partyId)

  if (deleteErr) {
    // Postgres FK violation — something we missed
    return {
      success: false,
      error: `فشل الحذف: ${deleteErr.message}`,
    }
  }

  await logClientAction({
    action: 'DELETE',
    entity_type: 'parties',
    entity_id: partyId,
    description: `تم حذف جهة التعامل: ${party.arabic_name}`,
  })

  revalidatePath('/company/parties')
  return { success: true }
}
