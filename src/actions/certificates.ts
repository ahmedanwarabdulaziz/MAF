'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

// ====================================================
// CUMULATIVE CERTIFICATE ENGINE (v041)
// ====================================================
//
// Semantic mapping after migration 041:
//   LINE LEVEL:
//     gross_line_amount  = cumulative_amount  = cumulative_qty × agreed_rate
//     taaliya_value      = disbursement_rate% (نسبة الصرف)
//     taaliya_amount     = retention per line = cumulative_amount × (1 - rate%)
//     net_line_amount    = cumulative_entitled = cumulative_amount × rate%
//     previous_disbursed = cumulative_entitled from previous approved cert
//     cumulative_amount  = (new dedicated column) same as gross_line_amount
//
//   HEADER LEVEL:
//     gross_amount       = Σ cumulative_amount
//     taaliya_amount     = Σ retention (cumulative_amount - cumulative_entitled)
//     net_amount         = Σ cumulative_entitled
//     outstanding_amount = net_amount − total_paid_from_vouchers
// ====================================================

// ====== CORE CERTIFICATE ENGINE ====== //

/**
 * Recalculates header totals from the saved lines.
 * Under the cumulative model:
 *   gross_amount = Σ cumulative_amount  (was: Σ current_qty × rate)
 *   taaliya_amount = Σ retention per line
 *   net_amount = Σ cumulative_entitled
 */
export async function recalculateCertificateTotals(certificateId: string) {
  const supabase = createClient()

  const { data: lines, error: linesErr } = await supabase
    .from('subcontractor_certificate_lines')
    .select('cumulative_amount, taaliya_amount, net_line_amount')
    .eq('certificate_id', certificateId)
  if (linesErr) throw linesErr

  const totalCumulativeGross = (lines || []).reduce(
    (sum, l) => sum + Number(l.cumulative_amount || 0), 0
  )
  const totalRetention = (lines || []).reduce(
    (sum, l) => sum + Number(l.taaliya_amount || 0), 0
  )
  const totalCumulativeEntitled = (lines || []).reduce(
    (sum, l) => sum + Number(l.net_line_amount || 0), 0
  )

  const { error: updateErr } = await supabase
    .from('subcontractor_certificates')
    .update({
      gross_amount:            totalCumulativeGross,       // Σ cumulative_amount
      taaliya_amount:          totalRetention,             // Σ retention
      other_deductions_amount: 0,                          // unused in new model
      net_amount:              totalCumulativeEntitled,    // Σ entitled
      outstanding_amount:      totalCumulativeEntitled,    // recalculated per payment
    })
    .eq('id', certificateId)

  if (updateErr) throw updateErr
}

// ====== CERTIFICATE HEADER ====== //

export async function getNextCertificateCode(agreementId: string) {
  const supabase = createClient()

  const { data: agreement } = await supabase
    .from('subcontract_agreements')
    .select('agreement_code')
    .eq('id', agreementId)
    .single()

  if (!agreement?.agreement_code) return 'CERT-01'

  const baseCode = `CERT-${agreement.agreement_code}`

  const { data: certs } = await supabase
    .from('subcontractor_certificates')
    .select('certificate_no')
    .eq('subcontract_agreement_id', agreementId)

  if (!certs || certs.length === 0) return `${baseCode}-01`

  let maxNum = 0
  for (const row of certs) {
    if (row.certificate_no) {
      const parts = row.certificate_no.split('-')
      const num = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(num) && num > maxNum) maxNum = num
    }
  }

  return `${baseCode}-${(maxNum + 1).toString().padStart(2, '0')}`
}


/**
 * Creates a new DRAFT certificate for an agreement.
 *
 * Cumulative behaviour:
 *   • Finds the last APPROVED certificate for this agreement.
 *   • Copies all its lines into the new draft with current_quantity = 0
 *     (the previous cumulative quantities become the new "previous_quantity").
 *   • Links previous_cert_id.
 *   • Sets period_from from agreement.start_date automatically.
 */
export async function createDraftCertificate(data: {
  project_id: string
  subcontractor_party_id: string
  subcontract_agreement_id: string
  certificate_no: string
  certificate_date: string
  period_to?: string
  notes?: string
}) {
  const supabase = createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('company_id')
    .eq('id', data.project_id)
    .single()
  const { data: { user } } = await supabase.auth.getUser()

  // 0. No existing draft/pending for this agreement
  const { data: existingPending } = await supabase
    .from('subcontractor_certificates')
    .select('certificate_no, status')
    .eq('project_id', data.project_id)
    .eq('subcontract_agreement_id', data.subcontract_agreement_id)
    .in('status', ['draft', 'pending_approval'])
    .limit(1)

  if (existingPending && existingPending.length > 0) {
    throw new Error(
      `لا يمكن إنشاء مستخلص جديد. يوجد مستخلص ${
        existingPending[0].status === 'draft' ? 'كمسودة' : 'بانتظار الاعتماد'
      } (رقم ${existingPending[0].certificate_no}) مسبقاً. يجب اعتماده أو إلغاؤه أولاً.`
    )
  }

  // 1. Get agreement start_date for period_from
  const { data: agreement } = await supabase
    .from('subcontract_agreements')
    .select('start_date, default_taaliya_value')
    .eq('id', data.subcontract_agreement_id)
    .single()

  const periodFrom = agreement?.start_date || null

  // 2. Find the last approved certificate for this agreement
  const { data: lastCerts } = await supabase
    .from('subcontractor_certificates')
    .select('id')
    .eq('subcontract_agreement_id', data.subcontract_agreement_id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })  // use created_at — reliable ordering
    .limit(1)

  const previousCertId = lastCerts?.[0]?.id || null

  // 3. Create the draft header
  const { data: newCert, error } = await supabase
    .from('subcontractor_certificates')
    .insert([{
      ...data,
      company_id:       project?.company_id,
      created_by:       user?.id,
      period_from:      periodFrom,
      period_to:        data.period_to || null,
      notes:            data.notes || null,
      status:           'draft',
      previous_cert_id: previousCertId,
    }])
    .select()
    .single()

  if (error) throw error

  // 4. If there's a previous approved certificate, seed its lines into the new draft
  if (previousCertId) {
    const { data: prevLines, error: prevErr } = await supabase
      .from('subcontractor_certificate_lines')
      .select('*')
      .eq('certificate_id', previousCertId)
      .order('created_at', { ascending: true })  // preserve original line order

    if (prevErr) throw prevErr

    if (prevLines && prevLines.length > 0) {
      const defaultDisb = Number(agreement?.default_taaliya_value || 90)

      const seededLines = prevLines.map(pl => {
        const rate = Number(pl.agreed_rate)
        const prevQty = Number(pl.cumulative_quantity)
        const currQty = 0
        const cumulQty = prevQty + currQty
        const disbRate = Number(pl.taaliya_value || defaultDisb)
        
        const cumulAmt = cumulQty * rate
        const cumulEntitled = cumulAmt * (disbRate / 100)
        const retention = cumulAmt - cumulEntitled
        const prevDisb = Number(pl.net_line_amount || 0)

        return {
          certificate_id:         newCert.id,
          project_work_item_id:   pl.project_work_item_id,
          unit_id:                pl.unit_id,
          agreed_rate:            rate,
          previous_quantity:      prevQty,
          current_quantity:       currQty,
          cumulative_quantity:    cumulQty,
          taaliya_type:           'percentage',
          taaliya_value:          disbRate,
          cumulative_amount:      cumulAmt,
          gross_line_amount:      cumulAmt,
          taaliya_amount:         retention,
          net_line_amount:        cumulEntitled,
          previous_disbursed:     prevDisb,
          owner_billable:         pl.owner_billable,
          notes:                  pl.notes || null,
        }
      })

      const { error: insErr } = await supabase
        .from('subcontractor_certificate_lines')
        .insert(seededLines)

      if (insErr) throw insErr

      // Recalculate header totals for the inherited lines
      await recalculateCertificateTotals(newCert.id)
    }
  }

  await writeAuditLog({
    action:      'certificate_created',
    entity_type: 'subcontractor_certificate',
    entity_id:   newCert.id,
    description: `إنشاء مستخلص تراكمي رقم ${data.certificate_no}`,
    metadata:    {
      certificate_no:            data.certificate_no,
      project_id:                data.project_id,
      subcontractor_party_id:    data.subcontractor_party_id,
      previous_cert_id:          previousCertId,
    },
  })

  revalidatePath(`/projects/${data.project_id}/certificates`)
  return newCert
}

export async function updateCertificateHeader(
  id: string,
  projectId: string,
  data: {
    certificate_no?: string
    certificate_date?: string | null
    period_to?: string | null
    notes?: string | null
  }
) {
  const supabase = createClient()

  const cleanData: Record<string, any> = {}
  if ('certificate_no'   in data) cleanData.certificate_no   = data.certificate_no
  if ('certificate_date' in data) cleanData.certificate_date = data.certificate_date?.trim() || null
  if ('period_to'        in data) cleanData.period_to        = data.period_to?.trim() || null
  if ('notes'            in data) cleanData.notes            = data.notes?.trim() || null

  const { data: result, error } = await supabase
    .from('subcontractor_certificates')
    .update(cleanData)
    .eq('id', id)
    .in('status', ['draft', 'pending_approval'])
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('رقم المستخلص مستخدم بالفعل.')
    throw error
  }

  await writeAuditLog({
    action:      'certificate_updated',
    entity_type: 'subcontractor_certificate',
    entity_id:   id,
    description: `تعديل بيانات المستخلص رقم ${data.certificate_no || result.certificate_no}`,
    metadata:    { certificate_id: id, project_id: projectId },
  })

  revalidatePath(`/projects/${projectId}/certificates`)
  return result
}

// ====== CUMULATIVE LINES ENGINE ====== //

/**
 * Saves lines for a DRAFT certificate using cumulative logic:
 *
 *   For each line:
 *     cumulative_qty      = previous_qty + current_qty
 *     cumulative_amount   = cumulative_qty × agreed_rate            (→ gross_line_amount)
 *     cumulative_entitled = cumulative_amount × (disbursement_rate / 100) (→ net_line_amount)
 *     retention           = cumulative_amount − cumulative_entitled  (→ taaliya_amount)
 *     previous_disbursed  = cumulative_entitled from last approved cert for this work_item
 *
 *   Header:
 *     gross_amount  = Σ cumulative_amount
 *     taaliya_amount= Σ retention
 *     net_amount    = Σ cumulative_entitled
 */
export async function saveCertificateLines(
  certificateId: string,
  agreementId: string,
  linesData: Array<{
    id?: string
    project_work_item_id: string
    unit_id: string
    current_quantity: number
    agreed_rate: number
    taaliya_type: 'percentage' | 'fixed_amount'
    taaliya_value: number   // now means disbursement_rate %
    owner_billable: boolean
    notes?: string
  }>
) {
  const supabase = createClient()

  // 1. Build a map: work_item_id → { cumulative_qty, net_line_amount (cumulative_entitled) }
  //    from the last APPROVED certificate under this agreement (excluding the current draft).
  const { data: approvedLines, error: approvedErr } = await supabase
    .from('subcontractor_certificate_lines')
    .select(`
      project_work_item_id,
      cumulative_quantity,
      net_line_amount,
      certificate:certificate_id (
        status,
        subcontract_agreement_id
      )
    `)

  if (approvedErr) throw approvedErr

  // highest cumulative_quantity and net_line_amount per work_item in approved certs
  const prevCumulativeQty   = new Map<string, number>()
  const prevCumulativeDisb  = new Map<string, number>()

  if (approvedLines) {
    for (const pl of approvedLines) {
      const cert: any = Array.isArray(pl.certificate) ? pl.certificate[0] : pl.certificate
      if (cert?.status === 'approved' && cert?.subcontract_agreement_id === agreementId) {
        const wid = pl.project_work_item_id
        if (Number(pl.cumulative_quantity) > (prevCumulativeQty.get(wid) || 0)) {
          prevCumulativeQty.set(wid,  Number(pl.cumulative_quantity))
          prevCumulativeDisb.set(wid, Number(pl.net_line_amount || 0))
        }
      }
    }
  }

  // 2. Compute new line values
  const computedLines = linesData.map(line => {
    const prevQty        = prevCumulativeQty.get(line.project_work_item_id) || 0
    const currQty        = Number(line.current_quantity || 0)
    const cumulativeQty  = prevQty + currQty

    const rate              = Number(line.agreed_rate || 0)
    const disbRate          = Math.max(0, Math.min(100, Number(line.taaliya_value || 0)))

    const cumulativeAmount  = cumulativeQty * rate                   // gross_line_amount
    const cumulativeEntitled = cumulativeAmount * (disbRate / 100)   // net_line_amount
    const retention         = cumulativeAmount - cumulativeEntitled  // taaliya_amount
    const prevDisb          = prevCumulativeDisb.get(line.project_work_item_id) || 0

    return {
      certificate_id:        certificateId,
      project_work_item_id:  line.project_work_item_id,
      unit_id:               line.unit_id,
      previous_quantity:     prevQty,
      current_quantity:      currQty,
      cumulative_quantity:   cumulativeQty,
      agreed_rate:           rate,

      // Repurposed columns (v041):
      cumulative_amount:     cumulativeAmount,
      gross_line_amount:     cumulativeAmount,    // = cumulative_amount
      taaliya_type:          'percentage' as const,
      taaliya_value:         disbRate,            // disbursement_rate %
      taaliya_amount:        retention,           // retention per line
      net_line_amount:       cumulativeEntitled,  // cumulative_entitled

      previous_disbursed:    prevDisb,
      owner_billable:        line.owner_billable,
      notes:                 line.notes || null,
    }
  })

  // 3. Replace all lines for this draft certificate
  const { error: delErr } = await supabase
    .from('subcontractor_certificate_lines')
    .delete()
    .eq('certificate_id', certificateId)
  if (delErr) throw delErr

  if (computedLines.length > 0) {
    const { error: insErr } = await supabase
      .from('subcontractor_certificate_lines')
      .insert(computedLines)
    if (insErr) throw insErr
  }

  // 4. Recalculate header totals
  await recalculateCertificateTotals(certificateId)
}

// ====== APPROVAL ENGINE ====== //

export async function submitCertificateForApproval(certificateId: string, projectId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('subcontractor_certificates')
    .update({ status: 'pending_approval' })
    .eq('id', certificateId)
    .eq('status', 'draft')

  if (error) throw error

  await writeAuditLog({
    action:      'certificate_submitted',
    entity_type: 'subcontractor_certificate',
    entity_id:   certificateId,
    description: 'تقديم مستخلص للموافقة',
    metadata:    { certificate_id: certificateId, project_id: projectId },
  })

  revalidatePath(`/projects/${projectId}/certificates`)
}

export async function approveCertificate(certificateId: string, projectId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('subcontractor_certificates')
    .update({
      status:      'approved',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', certificateId)
    .in('status', ['draft', 'pending_approval'])

  if (error) throw error

  await writeAuditLog({
    action:      'certificate_approved',
    entity_type: 'subcontractor_certificate',
    entity_id:   certificateId,
    description: 'اعتماد مستخلص مقاول الباطن',
    metadata:    { certificate_id: certificateId, project_id: projectId },
  })

  revalidatePath(`/projects/${projectId}/certificates`)
  return true
}

// ====== GETTERS ====== //

export async function getCertificatesList(projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('subcontractor_certificates')
    .select(`
      *,
      subcontractor:subcontractor_party_id(arabic_name),
      agreement:subcontract_agreement_id(agreement_code, default_taaliya_type, default_taaliya_value),
      created_by_user:created_by(display_name),
      approved_by_user:approved_by(display_name)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getCertificateDetails(certId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('subcontractor_certificates')
    .select(`
      *,
      subcontractor:subcontractor_party_id(arabic_name),
      agreement:subcontract_agreement_id(agreement_code, default_taaliya_type, default_taaliya_value, start_date),
      created_by_user:created_by(display_name),
      approved_by_user:approved_by(display_name)
    `)
    .eq('id', certId)
    .single()

  if (error) throw error
  return data
}

/**
 * Returns the total amount paid to a subcontractor for a specific project,
 * summed from posted payment vouchers.
 */
export async function getCertificatePaidAmount(
  subcontractorPartyId: string,
  projectId: string
): Promise<number> {
  const supabase = createClient()

  const { data: voucherParties } = await supabase
    .from('payment_voucher_parties')
    .select(`
      party_id,
      paid_amount,
      voucher:payment_voucher_id(project_id, status)
    `)
    .eq('party_id', subcontractorPartyId)

  if (!voucherParties) return 0

  let totalPaid = 0
  for (const pvp of voucherParties) {
    const v: any = Array.isArray(pvp.voucher) ? pvp.voucher[0] : pvp.voucher
    if (v?.status === 'posted' && v?.project_id === projectId) {
      totalPaid += Number(pvp.paid_amount || 0)
    }
  }
  return totalPaid
}

/**
 * Returns the BOQ grid for a draft certificate.
 * Each row contains cumulative quantities and finance figures.
 */
export async function getCertificateBOQGrid(agreementId: string, certId: string) {
  const supabase = createClient()

  // Current draft lines
  const { data: currentLines, error: currErr } = await supabase
    .from('subcontractor_certificate_lines')
    .select(`
      *,
      work_item:project_work_item_id(item_code, arabic_description, subcontractor_price),
      unit:unit_id(arabic_name)
    `)
    .eq('certificate_id', certId)

  if (currErr) throw currErr

  return (currentLines || []).map(line => {
    const workItem: any = Array.isArray(line.work_item) ? line.work_item[0] : line.work_item
    const unit: any     = Array.isArray(line.unit)      ? line.unit[0]      : line.unit

    return {
      _id:                    line.id,
      project_work_item_id:   line.project_work_item_id,
      unit_id:                line.unit_id,
      item_code:              workItem?.item_code,
      item_desc:              workItem?.arabic_description,
      unit_name:              unit?.arabic_name,
      agreed_rate:            Number(line.agreed_rate),

      // Quantities
      previous_quantity:      Number(line.previous_quantity),
      current_quantity:       Number(line.current_quantity),
      cumulative_quantity:    Number(line.cumulative_quantity),

      // Finance (cumulative model)
      cumulative_amount:      Number(line.cumulative_amount   || line.gross_line_amount || 0),
      disbursement_rate:      Number(line.taaliya_value       || 0),   // %
      cumulative_entitled:    Number(line.net_line_amount     || 0),
      retention:              Number(line.taaliya_amount      || 0),
      previous_disbursed:     Number(line.previous_disbursed  || 0),
      this_line_net:          Number(line.net_line_amount     || 0) - Number(line.previous_disbursed || 0),

      // Compatibility aliases
      taaliya_type:           'percentage' as const,
      taaliya_value:          Number(line.taaliya_value || 0),
      owner_billable:         line.owner_billable,
      notes:                  line.notes || '',
    }
  })
}

export async function getAgreementCumulativeMap(agreementId: string) {
  const supabase = createClient()
  const { data: previousLines } = await supabase
    .from('subcontractor_certificate_lines')
    .select(`
      project_work_item_id,
      cumulative_quantity,
      certificate:certificate_id (
        status,
        subcontract_agreement_id
      )
    `)

  const approvedCumulativeQtyMap: Record<string, number> = {}
  if (previousLines) {
    for (const pl of previousLines) {
      const cert: any = Array.isArray(pl.certificate) ? pl.certificate[0] : pl.certificate
      if (cert?.status === 'approved' && cert?.subcontract_agreement_id === agreementId) {
        const existing = approvedCumulativeQtyMap[pl.project_work_item_id] || 0
        if (Number(pl.cumulative_quantity) > existing) {
          approvedCumulativeQtyMap[pl.project_work_item_id] = Number(pl.cumulative_quantity)
        }
      }
    }
  }
  return approvedCumulativeQtyMap
}

export async function getSubcontractorCertificateStatus(
  projectId: string,
  subcontractorPartyId: string,
  agreementId?: string
) {
  const supabase = createAdminClient()

  let q2 = supabase
    .from('subcontractor_certificates')
    .select('certificate_no, status')
    .eq('project_id', projectId)
    .eq('subcontractor_party_id', subcontractorPartyId)
    .in('status', ['draft', 'pending_approval'])

  if (agreementId) q2 = q2.eq('subcontract_agreement_id', agreementId)

  const { data: pendingCerts } = await q2.limit(1)

  return {
    lastEndDate:   null,  // no longer used in cumulative model
    hasPending:    !!(pendingCerts && pendingCerts.length > 0),
    pendingNo:     pendingCerts?.[0]?.certificate_no || null,
    pendingStatus: pendingCerts?.[0]?.status || null,
  }
}

// -------------------------------------------------------------------
// STATEMENTS & CROSS-PROJECT
// -------------------------------------------------------------------

export async function getSubcontractorStatements(projectId: string) {
  const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(projectId)
  if (!projectId || !isUUID) return []

  const supabase = createClient()

  // Only the LATEST approved cert per agreement represents the full cumulative state.
  // We use subcontractor-level aggregation: latest cert's net_amount = total_entitled.
  const { data: certs, error } = await supabase
    .from('subcontractor_certificates')
    .select(`
      id,
      subcontractor_party_id,
      subcontract_agreement_id,
      gross_amount,
      taaliya_amount,
      net_amount,
      paid_to_date,
      outstanding_amount,
      created_at,
      subcontractor:subcontractor_party_id(arabic_name)
    `)
    .eq('project_id', projectId)
    .in('status', ['approved', 'paid_in_full'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getSubcontractorStatements error:', error.message)
    return []
  }
  if (!certs || certs.length === 0) return []

  // In the cumulative model, the LATEST cert per agreement is the authoritative state.
  // We take the latest cert per agreement_id.
  const latestByAgreement = new Map<string, any>()
  for (const c of certs) {
    if (!latestByAgreement.has(c.subcontract_agreement_id)) {
      latestByAgreement.set(c.subcontract_agreement_id, c)
    }
  }

  // Fetch total paid from payment vouchers per subcontractor
  const { data: voucherParties } = await supabase
    .from('payment_voucher_parties')
    .select(`party_id, paid_amount, voucher:payment_voucher_id(project_id, status)`)

  const partyVoucherPayments = new Map<string, number>()
  if (voucherParties) {
    for (const pvp of voucherParties) {
      const v: any = Array.isArray(pvp.voucher) ? pvp.voucher[0] : pvp.voucher
      if (v?.status === 'posted' && v?.project_id === projectId) {
        partyVoucherPayments.set(
          pvp.party_id,
          (partyVoucherPayments.get(pvp.party_id) || 0) + Number(pvp.paid_amount || 0)
        )
      }
    }
  }

  // Aggregate per subcontractor (sum latest cert per agreement)
  const aggregated = new Map<string, any>()

  for (const cert of latestByAgreement.values()) {
    const pId = cert.subcontractor_party_id
    if (!aggregated.has(pId)) {
      const subInfo: any = Array.isArray(cert.subcontractor)
        ? cert.subcontractor[0]
        : cert.subcontractor
      aggregated.set(pId, {
        subcontractor_party_id: pId,
        subcontractor_name:     subInfo?.arabic_name,
        total_gross:            0,
        total_retention:        0,
        total_net_payable:      0,
        total_paid:             0,
        total_outstanding:      0,
      })
    }
    const row = aggregated.get(pId)
    row.total_gross       += Number(cert.gross_amount)     // cumulative value
    row.total_retention   += Number(cert.taaliya_amount)   // cumulative retention
    row.total_net_payable += Number(cert.net_amount)       // cumulative entitled
  }

  // Apply payments from vouchers
  for (const [partyId, row] of aggregated) {
    const paid = partyVoucherPayments.get(partyId) || 0
    row.total_paid        = paid
    row.total_outstanding = Math.max(0, row.total_net_payable - paid)
  }

  return Array.from(aggregated.values())
}

export async function getSupplierCertificates(partyId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('subcontractor_certificates')
    .select(`
      *,
      project:projects(arabic_name),
      agreement:subcontract_agreement_id(agreement_code),
      approved_by_user:approved_by(display_name)
    `)
    .eq('subcontractor_party_id', partyId)
    .in('status', ['approved', 'paid_in_full'])
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

// -------------------------------------------------------------------
// PAYMENTS
// -------------------------------------------------------------------

export async function paySubcontractorCertificate(certId: string, payload: {
  financial_account_id: string
  payment_method: string
  payment_date: string
  amount: number
  receipt_reference_no?: string
  notes?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  const { data: cert, error: certErr } = await supabase
    .from('subcontractor_certificates')
    .select('id, project_id, company_id, subcontractor_party_id, outstanding_amount, status, certificate_no')
    .eq('id', certId)
    .single()

  if (certErr || !cert) throw new Error('المستخلص غير موجود')
  if (cert.status !== 'approved' && cert.status !== 'paid_in_full') {
    throw new Error('لا يمكن السداد إلا للمستخلصات المعتمدة')
  }
  if (Number(cert.outstanding_amount) <= 0) {
    throw new Error('تم سداد هذا المستخلص بالكامل')
  }
  if (payload.amount > cert.outstanding_amount) {
    throw new Error(`المبلغ المدخل أكبر من المتبقي (${cert.outstanding_amount})`)
  }

  const voucherNo = 'PV-SUB-' + Math.random().toString(36).substring(2, 8).toUpperCase()

  const { data: voucher, error: vErr } = await supabase
    .from('payment_vouchers')
    .insert([{
      company_id:           cert.company_id,
      project_id:           cert.project_id,
      voucher_no:           voucherNo,
      payment_date:         payload.payment_date,
      payment_method:       payload.payment_method,
      financial_account_id: payload.financial_account_id,
      total_amount:         payload.amount,
      direction:            'outflow',
      status:               'draft',
      receipt_reference_no: payload.receipt_reference_no || null,
      notes:                payload.notes || `سداد مستخلص ${cert.certificate_no}`,
      created_by:           user.id,
    }])
    .select('id')
    .single()

  if (vErr || !voucher) throw new Error(vErr?.message || 'خطأ في إنشاء سند الدفع')

  const { data: partyLink, error: pErr } = await supabase
    .from('payment_voucher_parties')
    .insert([{ payment_voucher_id: voucher.id, party_id: cert.subcontractor_party_id, paid_amount: payload.amount }])
    .select('id')
    .single()

  if (pErr || !partyLink) throw new Error(pErr?.message || 'خطأ في ربط المقاول بالدفع')

  const { error: aErr } = await supabase.from('payment_allocations').insert([{
    payment_voucher_party_id: partyLink.id,
    source_entity_type:       'subcontractor_certificate',
    source_entity_id:         cert.id,
    allocated_amount:         payload.amount,
  }])
  if (aErr) throw new Error(aErr.message)

  const { error: postErr } = await supabase.rpc('post_payment_voucher', {
    p_voucher_id: voucher.id,
    p_user_id:    user.id,
  })
  if (postErr) throw new Error(postErr.message)

  await writeAuditLog({
    action:      'PAYMENT',
    entity_type: 'subcontractor_certificate',
    entity_id:   certId,
    description: `سداد مبلغ ${payload.amount} لمستخلص رقم: ${cert.certificate_no}`,
  })

  revalidatePath(`/company/purchases/suppliers/${cert.subcontractor_party_id}`)
  return true
}

export async function bulkPaySubcontractor(partyId: string, projectId: string, payload: {
  financial_account_id: string
  payment_method: string
  payment_date: string
  amount: number
  receipt_reference_no?: string
  notes?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  const { data: certs, error: certErr } = await supabase
    .from('subcontractor_certificates')
    .select('id, certificate_no, outstanding_amount, created_at, company_id, project_id')
    .eq('subcontractor_party_id', partyId)
    .eq('project_id', projectId)
    .in('status', ['approved'])
    .gt('outstanding_amount', 0)
    .order('created_at', { ascending: true })

  if (certErr) throw new Error(certErr.message)
  if (!certs || certs.length === 0)
    throw new Error('لا توجد مستخلصات مستحقة السداد لهذا المقاول في المشروع المحدد')

  let remaining = payload.amount
  const allocations: { certId: string; certNo: string; amount: number }[] = []
  for (const cert of certs) {
    if (remaining <= 0) break
    const toAllocate = Math.min(remaining, Number(cert.outstanding_amount))
    allocations.push({ certId: cert.id, certNo: cert.certificate_no, amount: toAllocate })
    remaining -= toAllocate
  }

  if (allocations.length === 0) throw new Error('لا يمكن توزيع المبلغ على أي مستخلص')

  const voucherNo = 'PV-SUBBULK-' + Math.random().toString(36).substring(2, 8).toUpperCase()
  const companyId = certs[0].company_id

  const { data: voucher, error: vErr } = await supabase
    .from('payment_vouchers')
    .insert([{
      company_id:           companyId,
      project_id:           projectId,
      voucher_no:           voucherNo,
      payment_date:         payload.payment_date,
      payment_method:       payload.payment_method,
      financial_account_id: payload.financial_account_id,
      total_amount:         payload.amount,
      direction:            'outflow',
      status:               'draft',
      receipt_reference_no: payload.receipt_reference_no || null,
      notes:                payload.notes || `دفعة شاملة مقاول - ${allocations.length} مستخلصات`,
      created_by:           user.id,
    }])
    .select('id')
    .single()

  if (vErr || !voucher) throw new Error(vErr?.message || 'خطأ في إنشاء مستند الدفع')

  const { data: partyLink, error: pErr } = await supabase
    .from('payment_voucher_parties')
    .insert([{ payment_voucher_id: voucher.id, party_id: partyId, paid_amount: payload.amount }])
    .select('id')
    .single()

  if (pErr || !partyLink) throw new Error(pErr?.message || 'خطأ في ربط المقاول بالدفع')

  const { error: aErr } = await supabase.from('payment_allocations').insert(
    allocations.map(a => ({
      payment_voucher_party_id: partyLink.id,
      source_entity_type:       'subcontractor_certificate',
      source_entity_id:         a.certId,
      allocated_amount:         a.amount,
    }))
  )
  if (aErr) throw new Error(aErr.message)

  const { error: postErr } = await supabase.rpc('post_payment_voucher', {
    p_voucher_id: voucher.id,
    p_user_id:    user.id,
  })
  if (postErr) throw new Error(postErr.message)

  await writeAuditLog({
    action:      'PAYMENT',
    entity_type: 'payment_vouchers',
    entity_id:   voucher.id,
    description: `دفعة شاملة لمقاول باطن - سند رقم: ${voucherNo} - إجمالي: ${payload.amount} ج.م`,
  })

  revalidatePath(`/company/purchases/suppliers/${partyId}`)
  return { voucherNo, allocations }
}

export async function deleteCertificate(certificateId: string, projectId: string) {
  const supabase = createClient()
  const { data: cert, error: checkErr } = await supabase
    .from('subcontractor_certificates')
    .select('status, certificate_no')
    .eq('id', certificateId)
    .single()

  if (checkErr) throw checkErr

  if (cert.status !== 'draft' && cert.status !== 'pending_approval') {
    throw new Error('لا يمكن حذف المستخلص إلا إذا كان مسودة أو بانتظار الاعتماد')
  }

  const { error: linesErr } = await supabase
    .from('subcontractor_certificate_lines')
    .delete()
    .eq('certificate_id', certificateId)

  if (linesErr) throw linesErr

  const { error: certErr } = await supabase
    .from('subcontractor_certificates')
    .delete()
    .eq('id', certificateId)

  if (certErr) throw certErr

  await writeAuditLog({
    action:      'certificate_deleted',
    entity_type: 'subcontractor_certificate',
    entity_id:   certificateId,
    description: `حذف مستخلص رقم: ${cert.certificate_no}`,
    metadata:    { certificate_id: certificateId, project_id: projectId },
  })

  revalidatePath(`/projects/${projectId}/certificates`)
  return true
}
