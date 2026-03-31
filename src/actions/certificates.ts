'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

// ====== CORE CERTIFICATE ENGINE ====== //

/**
 * Recalculates all sums for a certificate including lines and deductions
 * based on the saved state in the database, updating the header totals.
 */
export async function recalculateCertificateTotals(certificateId: string) {
  const supabase = createClient()
  
  // 1. Get lines
  const { data: lines, error: linesErr } = await supabase
    .from('subcontractor_certificate_lines')
    .select('gross_line_amount, taaliya_amount, net_line_amount')
    .eq('certificate_id', certificateId)
  if (linesErr) throw linesErr

  // 2. Get allowances (which increase gross)
  const { data: allowances, error: allowErr } = await supabase
    .from('subcontractor_certificate_allowances')
    .select('allowance_amount')
    .eq('certificate_id', certificateId)
  if (allowErr) throw allowErr

  // 3. Get deductions (which decrease net after ta'liya)
  const { data: deductions, error: dedErr } = await supabase
    .from('subcontractor_certificate_deductions')
    .select('deduction_amount')
    .eq('certificate_id', certificateId)
  if (dedErr) throw dedErr

  const totalLinesGross = (lines || []).reduce((sum, l) => sum + Number(l.gross_line_amount || 0), 0)
  const totalAllowances = (allowances || []).reduce((sum, a) => sum + Number(a.allowance_amount || 0), 0)
  const totalTaaliya = (lines || []).reduce((sum, l) => sum + Number(l.taaliya_amount || 0), 0)
  const totalDeductions = (deductions || []).reduce((sum, d) => sum + Number(d.deduction_amount || 0), 0)

  const finalGross = totalLinesGross + totalAllowances
  const finalNet = finalGross - totalTaaliya - totalDeductions

  // 4. Update Header
  const { error: updateErr } = await supabase
    .from('subcontractor_certificates')
    .update({
      gross_amount: finalGross,
      taaliya_amount: totalTaaliya,
      other_deductions_amount: totalDeductions,
      net_amount: finalNet,
      outstanding_amount: finalNet // initially outstanding equals net, modified by payments later
    })
    .eq('id', certificateId)

  if (updateErr) throw updateErr
}

// ====== CERTIFICATE HEADER ====== //

export async function getNextCertificateCode(agreementId: string) {
  const supabase = createClient()
  
  // 1. Get the agreement code
  const { data: agreement } = await supabase
    .from('subcontract_agreements')
    .select('agreement_code')
    .eq('id', agreementId)
    .single()

  if (!agreement || !agreement.agreement_code) return 'CERT-01'
  
  const baseCode = `CERT-${agreement.agreement_code}`

  // 2. Find highest existing sequence for this agreement
  const { data: certs } = await supabase
    .from('subcontractor_certificates')
    .select('certificate_no')
    .eq('subcontract_agreement_id', agreementId)

  if (!certs || certs.length === 0) return `${baseCode}-01`

  let maxNum = 0
  for (const row of certs) {
    if (row.certificate_no) {
      // Look for the last numbers after the last hyphen (e.g. CERT-SUB-001-05 => 05)
      const parts = row.certificate_no.split('-')
      const lastPart = parts[parts.length - 1]
      const num = parseInt(lastPart, 10)
      if (!isNaN(num) && num > maxNum) {
        maxNum = num
      }
    }
  }

  const nextNum = maxNum + 1
  return `${baseCode}-${nextNum.toString().padStart(2, '0')}`
}


export async function createDraftCertificate(data: {
  project_id: string,
  subcontractor_party_id: string,
  subcontract_agreement_id: string,
  certificate_no: string,
  certificate_date: string,
  period_from?: string,
  period_to?: string,
  notes?: string
}) {
  const supabase = createClient()
  const { data: project } = await supabase.from('projects').select('company_id').eq('id', data.project_id).single()
  const { data: { user } } = await supabase.auth.getUser()

  // 0. Date overlap validation
  if (data.period_from && data.period_to) {
    if (data.period_from > data.period_to) {
      throw new Error('تاريخ بداية المستخلص يجب أن يكون قبل أو يساوي تاريخ النهاية')
    }
  }

  // 0.5 Check for existing pending/draft certificates (per agreement)
  const { data: existingPending } = await supabase
    .from('subcontractor_certificates')
    .select('certificate_no, status')
    .eq('project_id', data.project_id)
    .eq('subcontract_agreement_id', data.subcontract_agreement_id)
    .in('status', ['draft', 'pending_approval'])
    .limit(1)

  if (existingPending && existingPending.length > 0) {
    throw new Error(`لا يمكن إنشاء مستخلص جديد. يوجد مستخلص ${existingPending[0].status === 'draft' ? 'كمسودة' : 'بانتظار الاعتماد'} (رقم ${existingPending[0].certificate_no}) مسبقاً. يجب اعتماده أو إلغاؤه أولاً.`)
  }

  if (data.period_from) {
    const { data: latestCerts } = await supabase
      .from('subcontractor_certificates')
      .select('period_to')
      .eq('project_id', data.project_id)
      .eq('subcontract_agreement_id', data.subcontract_agreement_id)
      .not('period_to', 'is', null)
      .order('period_to', { ascending: false })
      .limit(1)
      
    if (latestCerts && latestCerts.length > 0 && latestCerts[0].period_to) {
      console.log(`[Validation] checking: ${data.period_from} <= ${latestCerts[0].period_to}`);
      const t1 = new Date(data.period_from + 'T00:00:00Z').getTime();
      const t2 = new Date(latestCerts[0].period_to + 'T00:00:00Z').getTime();
      
      if (t1 <= t2) {
        throw new Error(`لا يمكن أن يبدأ المستخلص في ${data.period_from} لتجنب التداخل مع المستخلص السابق المنتهي في ${latestCerts[0].period_to}. يجب أن يبدأ بعده.`)
      }
    }
  }

  const { data: result, error } = await supabase
    .from('subcontractor_certificates')
    .insert([{
      ...data,
      company_id: project?.company_id,
      created_by: user?.id,
      period_from: data.period_from || null,
      period_to: data.period_to || null,
      notes: data.notes || null,
      status: 'draft'
    }])
    .select()
    .single()

  if (error) throw error

  await writeAuditLog({
    action: 'certificate_created',
    entity_type: 'subcontractor_certificate',
    entity_id: result.id,
    description: `إنشاء مستخلص رقم ${data.certificate_no}`,
    metadata: { certificate_no: data.certificate_no, project_id: data.project_id, subcontractor_party_id: data.subcontractor_party_id },
  })

  revalidatePath(`/projects/${data.project_id}/certificates`)
  return result
}

export async function updateCertificateHeader(
  id: string,
  projectId: string,
  data: {
    certificate_no?: string
    certificate_date?: string | null
    period_from?: string | null
    period_to?: string | null
    notes?: string | null
    subcontractor_party_id?: string // needed for validation
  }
) {
  const supabase = createClient()
  
  const cleanData = { ...data }
  delete cleanData.subcontractor_party_id

  if ('certificate_date' in cleanData) cleanData.certificate_date = cleanData.certificate_date?.trim() || null
  if ('period_from' in cleanData) cleanData.period_from = cleanData.period_from?.trim() || null
  if ('period_to' in cleanData) cleanData.period_to = cleanData.period_to?.trim() || null
  if ('notes' in cleanData) cleanData.notes = cleanData.notes?.trim() || null

  // 0. Date overlap validation
  if (data.period_from && data.period_to) {
    if (data.period_from > data.period_to) {
      throw new Error('تاريخ بداية المستخلص يجب أن يكون قبل أو يساوي تاريخ النهاية')
    }
  }

  if (data.period_from) {
    // Need to find the agreement ID for this certificate since we didn't pass it from UI easily
    const { data: certData } = await supabase
      .from('subcontractor_certificates')
      .select('period_to, subcontract_agreement_id')
      .eq('id', id)
      .single()
      
    const aggId = certData?.subcontract_agreement_id

    const { data: latestCerts } = await supabase
      .from('subcontractor_certificates')
      .select('period_to')
      .eq('project_id', projectId)
      .eq('subcontract_agreement_id', aggId)
      .neq('id', id)
      .not('period_to', 'is', null)
      .order('period_to', { ascending: false })
      .limit(1)

    if (latestCerts && latestCerts.length > 0 && latestCerts[0].period_to) {
      console.log(`[Validation Edit] checking: ${data.period_from} <= ${latestCerts[0].period_to}`);
      const t1 = new Date(data.period_from + 'T00:00:00Z').getTime();
      const t2 = new Date(latestCerts[0].period_to + 'T00:00:00Z').getTime();

      if (t1 <= t2) {
        throw new Error(`لا يمكن أن يبدأ المستخلص في ${data.period_from} لتجنب التداخل مع المستخلص السابق للتاريخ ${latestCerts[0].period_to}. يجب أن يبدأ بعده.`)
      }
    }
  }

  const { data: result, error } = await supabase
    .from('subcontractor_certificates')
    .update(cleanData)
    .eq('id', id)
    // Only allow editing if draft or pending_approval (prior to final approval)
    .in('status', ['draft', 'pending_approval'])
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('رقم المستخلص مستخدم بالفعل.')
    throw error
  }

  await writeAuditLog({
    action: 'certificate_updated',
    entity_type: 'subcontractor_certificate',
    entity_id: id,
    description: `تعديل بيانات المستخلص رقم ${data.certificate_no || result.certificate_no}`,
    metadata: { certificate_id: id, project_id: projectId },
  })

  revalidatePath(`/projects/${projectId}/certificates`)
  revalidatePath(`/projects/${projectId}/certificates/${id}`)
  return result
}

// ====== CERTIFICATE LINES ENGINE ====== //

/**
 * Saves or updates lines for a certificate, automatically fetching previous quantities
 * from the most recent APPROVED certificate for this agreement + work item combination.
 * 
 * Computes the gross line amount, ta'liya, and net line amount per line based on 
 * current configuration.
 */
export async function saveCertificateLines(
  certificateId: string, 
  agreementId: string,
  linesData: Array<{
    id?: string, // if editing existing line
    project_work_item_id: string,
    unit_id: string,
    current_quantity: number,
    agreed_rate: number,
    taaliya_type: 'percentage' | 'fixed_amount',
    taaliya_value: number,
    owner_billable: boolean,
    notes?: string
  }>
) {
  const supabase = createClient()
  
  // 1. Fetch previous quantities from the last *approved* certificate for this agreement
  // To do this, we query all lines from approved certificates under this agreement
  // and sum the current_quantity per work_item. Or simpler: get the MAX cumulative_quantity.
  
  const { data: previousLines, error: prefErr } = await supabase
    .from('subcontractor_certificate_lines')
    .select(`
      project_work_item_id,
      cumulative_quantity,
      certificate:certificate_id (
        status,
        subcontract_agreement_id
      )
    `)
    // Normally we filter via a complex inner join or just fetch them and filter
    
  if (prefErr) throw prefErr

  // Filter in JS for simplicity: find previous approved cumulative qty
  const approvedCumulativeQtyMap = new Map<string, number>()
  if (previousLines) {
    for (const pl of previousLines) {
      const cert: any = Array.isArray(pl.certificate) ? pl.certificate[0] : pl.certificate
      if (cert?.status === 'approved' && cert?.subcontract_agreement_id === agreementId) {
        const existing = approvedCumulativeQtyMap.get(pl.project_work_item_id) || 0
        // find highest cumulative
        if (Number(pl.cumulative_quantity) > existing) {
          approvedCumulativeQtyMap.set(pl.project_work_item_id, Number(pl.cumulative_quantity))
        }
      }
    }
  }

  // 2. Prepare computed lines
  const computedLines = linesData.map(line => {
    const prevQty = approvedCumulativeQtyMap.get(line.project_work_item_id) || 0
    const currQty = Number(line.current_quantity || 0)
    const cumulativeQty = prevQty + currQty
    
    const rate = Number(line.agreed_rate || 0)
    
    // Core Engine Math
    const lineGross = currQty * rate
    
    let lineTaaliya = 0
    if (line.taaliya_type === 'percentage') {
      lineTaaliya = lineGross * (Number(line.taaliya_value || 0) / 100.0)
    } else {
      // Fixed amount per unit
      lineTaaliya = currQty * Number(line.taaliya_value || 0)
    }
    
    const lineNet = lineGross - lineTaaliya

    return {
      certificate_id: certificateId,
      project_work_item_id: line.project_work_item_id,
      unit_id: line.unit_id,
      previous_quantity: prevQty,
      current_quantity: currQty,
      cumulative_quantity: cumulativeQty,
      agreed_rate: rate,
      gross_line_amount: lineGross,
      taaliya_type: line.taaliya_type,
      taaliya_value: line.taaliya_value,
      taaliya_amount: lineTaaliya,
      net_line_amount: lineNet,
      owner_billable: line.owner_billable,
      notes: line.notes || null,
    }
  })

  // 3. Clear existing lines for this Draft certificate to replace fully
  const { error: delErr } = await supabase
    .from('subcontractor_certificate_lines')
    .delete()
    .eq('certificate_id', certificateId)
    
  if (delErr) throw delErr

  // 4. Insert computed lines
  if (computedLines.length > 0) {
    const { error: insErr } = await supabase
      .from('subcontractor_certificate_lines')
      .insert(computedLines)
    if (insErr) throw insErr
  }

  // 5. Recalculate Totals
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
    action: 'certificate_submitted',
    entity_type: 'subcontractor_certificate',
    entity_id: certificateId,
    description: 'تقديم مستخلص للموافقة',
    metadata: { certificate_id: certificateId, project_id: projectId },
  })

  revalidatePath(`/projects/${projectId}/certificates`)
}

export async function approveCertificate(certificateId: string, projectId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // In a full production scenario, we lock the quantities, but they are already tracked.
  // We simply mark it approved.
  const { error } = await supabase
    .from('subcontractor_certificates')
    .update({ 
      status: 'approved',
      approved_by: user?.id,
      approved_at: new Date().toISOString()
    })
    .eq('id', certificateId)
    .in('status', ['draft', 'pending_approval'])

  if (error) throw error

  await writeAuditLog({
    action: 'certificate_approved',
    entity_type: 'subcontractor_certificate',
    entity_id: certificateId,
    description: 'اعتماد مستخلص مقاول الباطن',
    metadata: { certificate_id: certificateId, project_id: projectId },
  })

  revalidatePath(`/projects/${projectId}/certificates`)
  return true
}

// ====== GETTERS FOR SECURE FETCHING ====== //

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
      agreement:subcontract_agreement_id(agreement_code, default_taaliya_type, default_taaliya_value),
      created_by_user:created_by(display_name),
      approved_by_user:approved_by(display_name)
    `)
    .eq('id', certId)
    .single()

  if (error) throw error
  return data
}

export async function getLastSubcontractorCertEndDate(projectId: string, subcontractorPartyId: string, excludeCertId?: string, agreementId?: string) {
  const supabase = createAdminClient()
  let query = supabase.from('subcontractor_certificates')
    .select('period_to')
    .eq('project_id', projectId)
    .eq('subcontractor_party_id', subcontractorPartyId)
    .not('period_to', 'is', null)
    .order('period_to', { ascending: false })
    .limit(1)

  if (agreementId) {
    query = query.eq('subcontract_agreement_id', agreementId)
  }

  if (excludeCertId) {
     query = query.neq('id', excludeCertId)
  }

  const { data, error } = await query
  if (error) return null
  return data?.[0]?.period_to || null
}

export async function getSubcontractorCertificateStatus(projectId: string, subcontractorPartyId: string, agreementId?: string) {
  const supabase = createAdminClient()
  
  let q1 = supabase.from('subcontractor_certificates')
    .select('period_to')
    .eq('project_id', projectId)
    .eq('subcontractor_party_id', subcontractorPartyId)
    .not('period_to', 'is', null)
    
  if (agreementId) q1 = q1.eq('subcontract_agreement_id', agreementId)

  const { data: latestCerts } = await q1
    .order('period_to', { ascending: false })
    .limit(1)

  let q2 = supabase.from('subcontractor_certificates')
    .select('certificate_no, status')
    .eq('project_id', projectId)
    .eq('subcontractor_party_id', subcontractorPartyId)
    .in('status', ['draft', 'pending_approval'])
    
  if (agreementId) q2 = q2.eq('subcontract_agreement_id', agreementId)

  const { data: pendingCerts } = await q2
    .limit(1)

  return {
    lastEndDate: latestCerts?.[0]?.period_to || null,
    hasPending: !!(pendingCerts && pendingCerts.length > 0),
    pendingNo: pendingCerts?.[0]?.certificate_no || null,
    pendingStatus: pendingCerts?.[0]?.status || null
  }
}

/**
 * Returns lines that are ALREADY saved on this draft certificate.
 * Also natively pre-computes the 'previous_quantity' available for Display.
 */
export async function getCertificateBOQGrid(agreementId: string, certId: string) {
  const supabase = createClient()
  
  // 1. Get existing quantities on THIS draft certificate
  const { data: currentCertLines, error: currErr } = await supabase
    .from('subcontractor_certificate_lines')
    .select(`
      *,
      work_item:project_work_item_id(item_code, arabic_description, subcontractor_price),
      unit:unit_id(arabic_name)
    `)
    .eq('certificate_id', certId)
    
  if (currErr) throw currErr

  // 2. To find 'previous quantity' without requiring the backend to resave, we query approved lines
  const { data: previousLines, error: prefErr } = await supabase
    .from('subcontractor_certificate_lines')
    .select(`
      project_work_item_id,
      cumulative_quantity,
      certificate:certificate_id (
        status,
        subcontract_agreement_id
      )
    `)
  if (prefErr) throw prefErr

  const approvedCumulativeQtyMap = new Map<string, number>()
  if (previousLines) {
    for (const pl of previousLines) {
      const cert: any = Array.isArray(pl.certificate) ? pl.certificate[0] : pl.certificate
      if (cert?.status === 'approved' && cert?.subcontract_agreement_id === agreementId) {
        const existing = approvedCumulativeQtyMap.get(pl.project_work_item_id) || 0
        if (Number(pl.cumulative_quantity) > existing) {
          approvedCumulativeQtyMap.set(pl.project_work_item_id, Number(pl.cumulative_quantity))
        }
      }
    }
  }

  // Map everything together
  const mergedGrid = (currentCertLines || []).map(line => {
    const prevQty = approvedCumulativeQtyMap.get(line.project_work_item_id) || 0
    
    const workItem: any = Array.isArray(line.work_item) ? line.work_item[0] : line.work_item
    const unit: any = Array.isArray(line.unit) ? line.unit[0] : line.unit

    return {
      _id: line.id, // for react keys
      project_work_item_id: line.project_work_item_id,
      unit_id: line.unit_id,
      item_code: workItem?.item_code,
      item_desc: workItem?.arabic_description,
      unit_name: unit?.arabic_name,
      agreed_rate: Number(line.agreed_rate),
      
      // Data entry focus
      previous_quantity: prevQty,
      current_quantity: Number(line.current_quantity),
      
      // Configuration overrides
      taaliya_type: line.taaliya_type,
      taaliya_value: Number(line.taaliya_value),
      owner_billable: line.owner_billable,
      notes: line.notes || ''
    }
  })

  return mergedGrid
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

// -------------------------------------------------------------------
// VIEWS & QUERIES
// -------------------------------------------------------------------

export async function getSubcontractorStatements(projectId: string) {
  const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(projectId);
  if (!projectId || !isUUID) return [];

  const supabase = createClient()
  
  // 1. Fetch approved/paid certificates to aggregate billings
  const { data: certs, error } = await supabase
    .from('subcontractor_certificates')
    .select(`
      subcontractor_party_id,
      gross_amount,
      taaliya_amount,
      other_deductions_amount,
      net_amount,
      paid_to_date,
      outstanding_amount,
      subcontractor:subcontractor_party_id(arabic_name)
    `)
    .eq('project_id', projectId)
    .in('status', ['approved', 'paid_in_full'])

  if (error) {
    console.error("getSubcontractorStatements error:", error.message, 'code:', error.code);
    return []
  }
  
  if (!certs || certs.length === 0) return []

  // 2. Fetch all posted payment vouchers for this project and their party links
  //    to capture payments made directly to a party (even without a certificate allocation)
  const { data: voucherParties } = await supabase
    .from('payment_voucher_parties')
    .select(`
      party_id,
      paid_amount,
      voucher:payment_voucher_id(project_id, status)
    `)
  
  // Build a map of party_id → total paid via payment vouchers (posted, for this project)
  const partyVoucherPayments = new Map<string, number>()
  if (voucherParties) {
    for (const pvp of voucherParties) {
      const v: any = Array.isArray(pvp.voucher) ? pvp.voucher[0] : pvp.voucher
      if (v?.status === 'posted' && v?.project_id === projectId) {
        const existing = partyVoucherPayments.get(pvp.party_id) || 0
        partyVoucherPayments.set(pvp.party_id, existing + Number(pvp.paid_amount || 0))
      }
    }
  }

  // 3. Aggregate per subcontractor
  const aggregated = new Map<string, any>()
  
  for (const c of certs) {
    const pId = c.subcontractor_party_id
    if (!aggregated.has(pId)) {
      const subInfo: any = Array.isArray(c.subcontractor) ? c.subcontractor[0] : c.subcontractor
      aggregated.set(pId, {
        subcontractor_party_id: pId,
        subcontractor_name: subInfo?.arabic_name,
        total_gross: 0,
        total_taaliya: 0,
        total_net_payable: 0,
        total_paid: 0,
        total_outstanding: 0,
      })
    }
    const current = aggregated.get(pId)
    current.total_gross += Number(c.gross_amount)
    current.total_taaliya += Number(c.taaliya_amount)
    current.total_net_payable += Number(c.net_amount)
    // Use max of: cert-level paid_to_date OR direct voucher payments
    // (avoids double-counting when allocations exist)
    current.total_paid += Number(c.paid_to_date)
    current.total_outstanding += Number(c.outstanding_amount)
  }

  // 4. For parties where cert paid_to_date = 0 but voucher payments exist,
  //    use voucher payments total as the paid amount
  for (const [partyId, row] of aggregated) {
    const voucherTotal = partyVoucherPayments.get(partyId) || 0
    if (row.total_paid === 0 && voucherTotal > 0) {
      row.total_paid = voucherTotal
      row.total_outstanding = Math.max(0, row.total_net_payable - voucherTotal)
    }
  }

  return Array.from(aggregated.values())
}

// -------------------------------------------------------------------
// PAYMENTS & CROSS-PROJECT FEATURES
// -------------------------------------------------------------------

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

  // 1. Validate Certificate
  const { data: cert, error: certErr } = await supabase
    .from('subcontractor_certificates')
    .select('id, project_id, company_id, subcontractor_party_id, outstanding_amount, status, certificate_no')
    .eq('id', certId)
    .single()

  if (certErr || !cert) throw new Error('المستخلص غير موجود')
  if (cert.status !== 'approved' && cert.status !== 'paid_in_full') {
    throw new Error('لا يمكن السداد إلا للمستخلصات المعتمدة المنتظرة للصرف')
  }
  if (Number(cert.outstanding_amount) <= 0) {
    throw new Error('تم سداد هذا المستخلص بالكامل')
  }
  if (payload.amount > cert.outstanding_amount) {
    throw new Error(`المبلغ المدخل أكبر من المتبقي (${cert.outstanding_amount})`)
  }

  const voucherNo = 'PV-SUB-' + Math.random().toString(36).substring(2, 8).toUpperCase()

  // 2. Create Voucher
  const { data: voucher, error: vErr } = await supabase
    .from('payment_vouchers')
    .insert([{
      company_id: cert.company_id,
      project_id: cert.project_id,
      voucher_no: voucherNo,
      payment_date: payload.payment_date,
      payment_method: payload.payment_method,
      financial_account_id: payload.financial_account_id,
      total_amount: payload.amount,
      direction: 'outflow',
      status: 'draft',
      receipt_reference_no: payload.receipt_reference_no || null,
      notes: payload.notes || `سداد جزء من مستخلص ${cert.certificate_no}`,
      created_by: user.id
    }])
    .select('id')
    .single()

  if (vErr || !voucher) throw new Error(vErr?.message || 'خطأ في إنشاء سند الدفع')

  // 3. Link Party
  const { data: partyLink, error: pErr } = await supabase
    .from('payment_voucher_parties')
    .insert([{
      payment_voucher_id: voucher.id,
      party_id: cert.subcontractor_party_id,
      paid_amount: payload.amount
    }])
    .select('id')
    .single()

  if (pErr || !partyLink) throw new Error(pErr?.message || 'خطأ في ربط المقاول بالدفع')

  // 4. Create Allocation
  const { error: aErr } = await supabase.from('payment_allocations').insert([{
    payment_voucher_party_id: partyLink.id,
    source_entity_type: 'subcontractor_certificate',
    source_entity_id: cert.id,
    allocated_amount: payload.amount
  }])

  if (aErr) throw new Error(aErr.message)

  // 5. Post Voucher
  const { error: postErr } = await supabase.rpc('post_payment_voucher', {
    p_voucher_id: voucher.id,
    p_user_id: user.id
  })

  if (postErr) throw new Error(postErr.message)

  await writeAuditLog({
    action: 'PAYMENT',
    entity_type: 'subcontractor_certificate',
    entity_id: certId,
    description: `تم سداد مبلغ ${payload.amount} لمستخلص رقم: ${cert.certificate_no}`
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

  // Identify outstanding certificates for this party AND project
  const { data: certs, error: certErr } = await supabase
    .from('subcontractor_certificates')
    .select('id, certificate_no, outstanding_amount, created_at, company_id, project_id')
    .eq('subcontractor_party_id', partyId)
    .eq('project_id', projectId) // Scoped to Project!
    .in('status', ['approved'])
    .gt('outstanding_amount', 0)
    .order('created_at', { ascending: true })

  if (certErr) throw new Error(certErr.message)
  if (!certs || certs.length === 0) throw new Error('لا توجد مستخلصات مستحقة السداد لهذا المقاول في المشروع المحدد')

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

  // 1. Create one payment voucher
  const { data: voucher, error: vErr } = await supabase
    .from('payment_vouchers')
    .insert([{
      company_id: companyId,
      project_id: projectId,
      voucher_no: voucherNo,
      payment_date: payload.payment_date,
      payment_method: payload.payment_method,
      financial_account_id: payload.financial_account_id,
      total_amount: payload.amount,
      direction: 'outflow',
      status: 'draft',
      receipt_reference_no: payload.receipt_reference_no || null,
      notes: payload.notes || `دفعة شاملة مقاول - ${allocations.length} مستخلصات`,
      created_by: user.id
    }])
    .select('id')
    .single()

  if (vErr || !voucher) throw new Error(vErr?.message || 'خطأ في إنشاء مستند الدفع')

  // 2. Link Party
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

  // 3. Create bulk allocations
  const { error: aErr } = await supabase.from('payment_allocations').insert(
    allocations.map(a => ({
      payment_voucher_party_id: partyLink.id,
      source_entity_type: 'subcontractor_certificate',
      source_entity_id: a.certId,
      allocated_amount: a.amount
    }))
  )

  if (aErr) throw new Error(aErr.message)

  // 4. Post voucher
  const { error: postErr } = await supabase.rpc('post_payment_voucher', {
    p_voucher_id: voucher.id,
    p_user_id: user.id
  })

  if (postErr) throw new Error(postErr.message)

  await writeAuditLog({
    action: 'PAYMENT',
    entity_type: 'payment_vouchers',
    entity_id: voucher.id,
    description: `دفعة شاملة لمقاول باطن - سند رقم: ${voucherNo} - إجمالي: ${payload.amount} ج.م موزع على ${allocations.length} مستخلصات`
  })

  revalidatePath(`/company/purchases/suppliers/${partyId}`)

  return { voucherNo, allocations }
}
