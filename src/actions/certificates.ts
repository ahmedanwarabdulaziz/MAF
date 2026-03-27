'use server'

import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

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
  revalidatePath(`/projects/${data.project_id}/certificates`)
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
      agreement:subcontract_agreement_id(agreement_code),
      created_by_user:created_by(full_name),
      approved_by_user:approved_by(full_name)
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
      agreement:subcontract_agreement_id(agreement_code),
      created_by_user:created_by(full_name),
      approved_by_user:approved_by(full_name)
    `)
    .eq('id', certId)
    .single()

  if (error) throw error
  return data
}

/**
 * Returns merged lines matching an agreement's expected B.O.Q 
 * and injects any existing quantities already saved on this draft certificate.
 * Also natively pre-computes the 'previous_quantity' available for Display.
 */
export async function getCertificateBOQGrid(agreementId: string, certId: string) {
  const supabase = createClient()
  
  // 1. Get base agreement lines (the B.O.Q framework)
  const { data: aggrLines, error: aggrErr } = await supabase
    .from('subcontract_agreement_lines')
    .select(`
      work_item_id,
      unit_id,
      agreed_rate,
      taaliya_type,
      taaliya_value,
      owner_billable_default,
      work_item:work_item_id(item_code, arabic_description),
      unit:unit_id(arabic_name)
    `)
    .eq('subcontract_agreement_id', agreementId)
    
  if (aggrErr) throw aggrErr

  // 2. Get existing quantities on THIS draft certificate (if previously saved)
  const { data: currentCertLines, error: currErr } = await supabase
    .from('subcontractor_certificate_lines')
    .select('*')
    .eq('certificate_id', certId)
    
  if (currErr) throw currErr

  // 3. To find 'previous quantity' without requiring the backend to resave, we query approved lines
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
  const mergedGrid = (aggrLines || []).map(agLine => {
    const existingLine = (currentCertLines || []).find(l => l.project_work_item_id === agLine.work_item_id)
    const prevQty = approvedCumulativeQtyMap.get(agLine.work_item_id) || 0
    
    const workItem: any = Array.isArray(agLine.work_item) ? agLine.work_item[0] : agLine.work_item
    const unit: any = Array.isArray(agLine.unit) ? agLine.unit[0] : agLine.unit

    return {
      project_work_item_id: agLine.work_item_id,
      unit_id: agLine.unit_id,
      item_code: workItem?.item_code,
      item_desc: workItem?.arabic_description,
      unit_name: unit?.arabic_name,
      agreed_rate: Number(agLine.agreed_rate),
      
      // Data entry focus
      previous_quantity: prevQty,
      current_quantity: existingLine ? Number(existingLine.current_quantity) : 0,
      
      // Configuration overrides (defaulted from agreement)
      taaliya_type: existingLine ? existingLine.taaliya_type : agLine.taaliya_type,
      taaliya_value: existingLine ? Number(existingLine.taaliya_value) : Number(agLine.taaliya_value),
      owner_billable: existingLine ? existingLine.owner_billable : agLine.owner_billable_default,
      notes: existingLine?.notes || ''
    }
  })

  return mergedGrid
}

/**
 * Returns an aggregated summary per subcontractor for the project.
 * Sums up only Approved or Paid certificates.
 */
export async function getSubcontractorStatements(projectId: string) {
  const supabase = createClient()
  
  // Fetch active certificates to manually aggregate (or use RPC)
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

  if (error) throw error

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
    current.total_paid += Number(c.paid_to_date)
    current.total_outstanding += Number(c.outstanding_amount)
  }

  return Array.from(aggregated.values())
}

