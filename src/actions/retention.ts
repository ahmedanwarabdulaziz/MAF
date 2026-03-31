'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

export interface RetentionMetric {
  project_id: string
  project_name: string
  total_held: number
  total_released: number
  available_balance: number
}

/**
 * Aggregates all held Ta'liya vs released Ta'liya for a specific party per project
 */
export async function getRetentionMetrics(partyId: string): Promise<RetentionMetric[]> {
  const supabase = createClient()
  
  // 1. Get total held taaliya per project
  const { data: certs, error: certErr } = await supabase
    .from('subcontractor_certificates')
    .select('project_id, taaliya_amount, project:projects(arabic_name)')
    .eq('subcontractor_party_id', partyId)
    .in('status', ['approved', 'paid_in_full'])

  if (certErr) throw new Error(certErr.message)

  // 2. Get total released/requested taaliya per project
  const { data: releases, error: relErr } = await supabase
    .from('subcontractor_retention_releases')
    .select('project_id, released_amount')
    .eq('subcontractor_party_id', partyId)
    // We count any release that is draft, approved, or paid to prevent double requesting
    .in('status', ['draft', 'pending_approval', 'approved', 'paid'])

  if (relErr) throw new Error(relErr.message)

  const map = new Map<string, RetentionMetric>()

  for (const c of certs || []) {
    if (!c.project_id) continue
    if (!map.has(c.project_id)) {
      map.set(c.project_id, {
        project_id: c.project_id,
        project_name: (Array.isArray(c.project) ? c.project[0] : c.project)?.arabic_name || 'غير معروف',
        total_held: 0,
        total_released: 0,
        available_balance: 0
      })
    }
    const m = map.get(c.project_id)!
    m.total_held += Number(c.taaliya_amount || 0)
    m.available_balance += Number(c.taaliya_amount || 0)
  }

  for (const r of releases || []) {
    if (!r.project_id) continue
    if (map.has(r.project_id)) {
      const m = map.get(r.project_id)!
      m.total_released += Number(r.released_amount || 0)
      m.available_balance -= Number(r.released_amount || 0)
    }
  }

  return Array.from(map.values())
}

/**
 * Retrieves all retention refund requests for the party
 */
export async function getRetentionReleases(partyId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('subcontractor_retention_releases')
    .select(`
      *,
      project:projects(arabic_name),
      created_by_user:created_by(display_name),
      approved_by_user:approved_by(display_name)
    `)
    .eq('subcontractor_party_id', partyId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Creates a new retention release request
 */
export async function requestRetentionRelease(partyId: string, projectId: string, payload: { amount: number; release_date: string; notes?: string }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  // Verify balance
  const metrics = await getRetentionMetrics(partyId)
  const projMetric = metrics.find(m => m.project_id === projectId)
  const balance = projMetric ? projMetric.available_balance : 0

  if (payload.amount <= 0) throw new Error('يجب تحديد مبلغ أكبر من الصفر')
  if (payload.amount > balance) {
    throw new Error(`المبلغ المطلوب (${payload.amount}) يتجاوز الرصيد المتاح للاسترداد (${balance}) في هذا المشروع`)
  }

  // Get project company_id
  const { data: p } = await supabase.from('projects').select('company_id').eq('id', projectId).single()

  const { data, error } = await supabase
    .from('subcontractor_retention_releases')
    .insert([{
      project_id: projectId,
      company_id: p?.company_id,
      subcontractor_party_id: partyId,
      release_date: payload.release_date,
      released_amount: payload.amount,
      status: 'pending_approval',
      notes: payload.notes,
      created_by: user.id
    }])
    .select()
    .single()

  if (error) throw new Error(error.message)
  
  await writeAuditLog({
    action: 'CREATE',
    entity_type: 'subcontractor_retention_releases',
    entity_id: data.id,
    description: `تم إنشاء طلب استرداد تعلية للمقاول (${payload.amount} ج.م)`,
    metadata: data
  })
  revalidatePath(`/company/purchases/suppliers/${partyId}`)
  return data
}

/**
 * Approves a pending retention release request
 */
export async function approveRetentionRelease(releaseId: string, partyId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  const { data, error } = await supabase
    .from('subcontractor_retention_releases')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString()
    })
    .eq('id', releaseId)
    .eq('status', 'pending_approval')
    .select()
    .single()

  if (error) throw new Error(error.message)
  
  await writeAuditLog({
    action: 'APPROVE',
    entity_type: 'subcontractor_retention_releases',
    entity_id: releaseId,
    description: `تم اعتماد طلب استرداد تعلية (${data.released_amount} ج.م)`,
    metadata: data
  })
  revalidatePath(`/company/purchases/suppliers/${partyId}`)
  return data
}

/**
 * Pays out an approved retention release request
 */
export async function payRetentionRelease(releaseId: string, partyId: string, payload: {
  amount: number,
  financial_account_id: string,
  payment_method: string,
  payment_date: string,
  reference_no?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  const { data: rel, error: relErr } = await supabase
    .from('subcontractor_retention_releases')
    .select('*')
    .eq('id', releaseId)
    .single()

  if (relErr || !rel) throw new Error('طلب الاسترداد غير موجود')
  if (rel.status !== 'approved') throw new Error('يجب اعتماد الطلب أولاً قبل السداد')
  if (payload.amount !== Number(rel.released_amount)) throw new Error('مبلغ السداد يجب أن يطابق مبلغ الاسترداد المعتمد')

  // Generate Voucher Number
  const voucherNo = 'PV-RET-' + Math.random().toString(36).substring(2, 8).toUpperCase()

  // Create Payment Voucher
  const { data: voucher, error: vErr } = await supabase
    .from('payment_vouchers')
    .insert([{
      company_id: rel.company_id,
      project_id: rel.project_id,
      voucher_no: voucherNo,
      payment_date: payload.payment_date,
      financial_account_id: payload.financial_account_id,
      payment_method: payload.payment_method,
      receipt_reference_no: payload.reference_no,
      total_amount: payload.amount,
      direction: 'outflow',
      status: 'draft',
      notes: `صرف ضمان أعمال (تعلية) لمقاول - مشروع رقم ${rel.project_id.substring(0,8)}`,
      created_by: user.id
    }])
    .select('id')
    .single()

  if (vErr || !voucher) throw new Error(vErr?.message || 'خطأ في إنشاء سند الدفع')

  // Map to Party
  const { data: partyLink, error: pErr } = await supabase
    .from('payment_voucher_parties')
    .insert([{
      payment_voucher_id: voucher.id,
      party_id: partyId,
      paid_amount: payload.amount
    }])
    .select('id')
    .single()
    
  if (pErr || !partyLink) throw new Error(pErr?.message || 'خطأ في ربط المقاول بالدفع')

  // Post Voucher
  const { error: postErr } = await supabase.rpc('post_payment_voucher', {
    p_voucher_id: voucher.id,
    p_user_id: user.id
  })

  if (postErr) throw new Error(postErr.message)

  // Explicitly link the payment_voucher to this specific retention_release explicitly via update 
  const { error: updErr } = await supabase
    .from('subcontractor_retention_releases')
    .update({ status: 'paid' })
    .eq('id', releaseId)
  
  if (updErr) throw new Error(updErr.message)

  await writeAuditLog({
    action: 'PAYMENT',
    entity_type: 'subcontractor_retention_releases',
    entity_id: releaseId,
    description: `تم سداد طلب استرداد تعلية عبر سند الدفع ${voucherNo}`,
    metadata: { voucher_id: voucher.id }
  })
  revalidatePath(`/company/purchases/suppliers/${partyId}`)
  
  return voucher
}
