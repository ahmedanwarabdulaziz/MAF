'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

// Fetch all payment vouchers for a project
export async function getProjectPayments(projectId: string) {
  const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(projectId);
  if (!projectId || !isUUID) return [];

  const supabase = createClient()
  const { data, error } = await supabase
    .from('payment_vouchers')
    .select(`
      *,
      financial_account:financial_account_id(arabic_name, currency),
      parties:payment_voucher_parties(
        paid_amount,
        party:party_id(arabic_name)
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error("getProjectPayments Error:", error.message, "projectId:", projectId, "code:", error.code);
    return []
  }
  return data || []
}

// Fetch the "Payables Queue" (Unpaid or Partially Paid Documents)
export async function getProjectPayablesQueue(projectId: string) {
  const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(projectId);
  if (!projectId || !isUUID) return { supplier_invoices: [], subcontractor_certificates: [] };

  const supabase = createClient()
  
  // 1. Supplier Invoices
  const { data: supplierInvoices, error: supErr } = await supabase
    .from('supplier_invoices')
    .select(`
      id, invoice_no, invoice_date, net_amount, paid_to_date, status,
      supplier:supplier_party_id(id, arabic_name)
    `)
    .eq('project_id', projectId)
    .in('status', ['posted', 'partially_paid'])

  if (supErr) {
    console.error("getProjectPayablesQueue supErr:", supErr.message, 'code:', supErr.code);
    return { supplier_invoices: [], subcontractor_certificates: [] }
  }

  // 2. Subcontractor Certificates
  const { data: subCertificates, error: subErr } = await supabase
    .from('subcontractor_certificates')
    .select(`
      id, certificate_no, certificate_date, net_amount, paid_to_date, outstanding_amount, status,
      subcontractor_agreement:subcontract_agreement_id(
        subcontractor:subcontractor_party_id(id, arabic_name)
      )
    `)
    .eq('project_id', projectId)
    .in('status', ['approved'])  // certificate_status ENUM: draft|pending_approval|approved|paid_in_full

  if (subErr) {
    console.error("getProjectPayablesQueue subErr:", subErr.message, 'code:', subErr.code);
    return { supplier_invoices: supplierInvoices || [], subcontractor_certificates: [] }
  }

  return {
    supplier_invoices: supplierInvoices || [],
    subcontractor_certificates: subCertificates || []
  }
}

// Fetch the Global "Payables Queue" (Unpaid or Partially Paid Documents) across ALL projects
export async function getGlobalPayablesQueue() {
  const supabase = createAdminClient() // use admin/service role to aggregate all data
  
  // 1. Supplier Invoices
  const { data: supplierInvoices, error: supErr } = await supabase
    .from('supplier_invoices')
    .select(`
      id, invoice_no, invoice_date, net_amount, returned_amount, outstanding_amount, paid_to_date, status, project_id,
      supplier:supplier_party_id(id, arabic_name),
      project:project_id(arabic_name)
    `)
    .in('status', ['posted', 'partially_paid'])

  if (supErr) {
    console.error("getGlobalPayablesQueue supErr:", supErr.message, 'code:', supErr.code);
    return { supplier_invoices: [], subcontractor_certificates: [], company_invoices: [] }
  }

  // 2. Subcontractor Certificates
  const { data: subCertificates, error: subErr } = await supabase
    .from('subcontractor_certificates')
    .select(`
      id, certificate_no, certificate_date, net_amount, paid_to_date, outstanding_amount, status, project_id,
      subcontractor_agreement:subcontract_agreement_id(
        subcontractor:subcontractor_party_id(id, arabic_name)
      ),
      project:project_id(arabic_name)
    `)
    .in('status', ['approved'])

  if (subErr) {
    console.error("getGlobalPayablesQueue subErr:", subErr.message, 'code:', subErr.code);
    return { supplier_invoices: supplierInvoices || [], subcontractor_certificates: [], company_invoices: [] }
  }

  // 3. Company Purchase Invoices
  const { data: companyInvoices, error: compErr } = await supabase
    .from('company_purchase_invoices')
    .select(`
      id, invoice_no, invoice_date, net_amount, returned_amount, outstanding_amount, paid_to_date, status, company_id,
      supplier:supplier_party_id(id, arabic_name)
    `)
    .in('status', ['posted', 'partially_paid'])

  if (compErr) {
    console.error("getGlobalPayablesQueue compErr:", compErr.message);
  }

  return {
    supplier_invoices: supplierInvoices || [],
    subcontractor_certificates: subCertificates || [],
    company_invoices: companyInvoices || []
  }
}

// Execute Payment Voucher Draft (Creates the Voucher, links Party, and Drafts Allocations)
export async function draftPaymentVoucher(payload: {
  project_id?: string
  company_id: string
  payment_date: string
  payment_method: string
  financial_account_id: string
  total_amount: number
  receipt_reference_no?: string
  notes?: string
  party_id: string
  allocations: { source_type: string, source_id: string, amount: number }[]
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Let the DB trigger handle sequential numbering
  const voucherNo = 'تلقائي'

  // 1. Create the Voucher
  const { data: voucher, error: vErr } = await supabase
    .from('payment_vouchers')
    .insert([{
      company_id: payload.company_id,
      project_id: payload.project_id || null,
      voucher_no: voucherNo,
      payment_date: payload.payment_date,
      payment_method: payload.payment_method,
      financial_account_id: payload.financial_account_id,
      total_amount: payload.total_amount,
      direction: 'outflow',
      status: 'draft',
      receipt_reference_no: payload.receipt_reference_no || null,
      notes: payload.notes || null,
      created_by: user?.id
    }])
    .select('id')
    .single()

  if (vErr) throw vErr

  // 2. Link the Party 
  const { data: partyLink, error: pErr } = await supabase
    .from('payment_voucher_parties')
    .insert([{
      payment_voucher_id: voucher.id,
      party_id: payload.party_id,
      paid_amount: payload.total_amount
    }])
    .select('id')
    .single()

  if (pErr) throw pErr

  // 3. Create the Allocations under this party link
  if (payload.allocations.length > 0) {
    const allocPayload = payload.allocations.map(a => ({
      payment_voucher_party_id: partyLink.id,
      source_entity_type: a.source_type,
      source_entity_id: a.source_id,
      allocated_amount: a.amount
    }))

    const { error: aErr } = await supabase.from('payment_allocations').insert(allocPayload)
    if (aErr) throw aErr
  }

  await writeAuditLog({
    action: 'payment_requested',
    entity_type: 'payment_voucher',
    entity_id: voucher.id,
    description: `طلب دفع (قيد الانتظار) بمبلغ ${payload.total_amount} — طريقة: ${payload.payment_method}`,
    metadata: { voucher_id: voucher.id, total_amount: payload.total_amount, payment_method: payload.payment_method, party_id: payload.party_id, project_id: payload.project_id, allocations_count: payload.allocations.length },
  })

  // Revalidate routes
  revalidatePath(`/projects/${payload.project_id}/payments`)
  revalidatePath(`/projects/${payload.project_id}/payments/queue`)
  revalidatePath('/company/treasury/queue')
  
  return voucher.id
}

// -------------------------------------------------------------------
// TREASURY EXECUTION — تنفيذ الدفعات من الإدارة المالية
// -------------------------------------------------------------------

export async function getTreasuryExecutionQueue() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('payment_vouchers')
    .select(`
      *,
      project:project_id(arabic_name),
      financial_account:financial_account_id(arabic_name, currency),
      parties:payment_voucher_parties(
        paid_amount,
        party:party_id(arabic_name)
      ),
      created_by_user:users!payment_vouchers_created_by_fkey(display_name)
    `)
    .eq('status', 'draft')
    .order('created_at', { ascending: true })

  if (error) {
    console.error("getTreasuryExecutionQueue Error:", error.message);
    return []
  }
  return data || []
}

export async function executeTreasuryPayment(voucherId: string, payload: {
  financial_account_id?: string
  attachment_urls?: string[]
  notes?: string
  executed_amount?: number
}) {
  const supabase = createAdminClient()
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()

  // 1. Get Voucher and its allocations
  const { data: voucher, error: vErr } = await supabase.from('payment_vouchers').select('*').eq('id', voucherId).single()
  if (vErr || !voucher) throw new Error('سند الصرف غير موجود')
  if (voucher.status !== 'draft') throw new Error('لقد تم تنفيذ هذا السند مسبقاً')

  // 2. Handle partial payment waterfall if executed amount is less than requested amount
  let finalAmount = voucher.total_amount
  if (payload.executed_amount && payload.executed_amount < voucher.total_amount && payload.executed_amount > 0) {
      finalAmount = payload.executed_amount
      
      const { data: parties } = await supabase
        .from('payment_voucher_parties')
        .select('id, paid_amount, allocations:payment_allocations(id, allocated_amount)')
        .eq('payment_voucher_id', voucherId)

      let remainingDeficit = voucher.total_amount - finalAmount

      if (parties && parties.length > 0) {
        for (const party of parties) {
          if (remainingDeficit <= 0) break

          let newPartyPaid = party.paid_amount
          // Reduce allocations first
          if (party.allocations && party.allocations.length > 0) {
            for (const alloc of party.allocations) {
              if (remainingDeficit <= 0) break
              const deduct = Math.min(alloc.allocated_amount, remainingDeficit)
              const newAllocAmt = alloc.allocated_amount - deduct
              remainingDeficit -= deduct
              newPartyPaid -= deduct

              await supabase.from('payment_allocations')
                .update({ allocated_amount: newAllocAmt })
                .eq('id', alloc.id)
            }
          } else {
             // No allocations, just reduce party paid directly
             const deduct = Math.min(party.paid_amount, remainingDeficit)
             newPartyPaid -= deduct
             remainingDeficit -= deduct
          }

          // Update party total
          await supabase.from('payment_voucher_parties')
            .update({ paid_amount: newPartyPaid })
            .eq('id', party.id)
        }
      }
  }

  // 3. Update attachments, notes, total_amount and fallback account
  const updates: any = {}
  if (payload.attachment_urls && payload.attachment_urls.length > 0) updates.attachment_urls = payload.attachment_urls
  if (payload.notes) updates.notes = payload.notes
  if (payload.financial_account_id && payload.financial_account_id !== voucher.financial_account_id) {
     updates.financial_account_id = payload.financial_account_id
  }
  if (finalAmount !== voucher.total_amount) {
     updates.total_amount = finalAmount
  }

  if (Object.keys(updates).length > 0) {
     const { error: upErr } = await supabase.from('payment_vouchers').update(updates).eq('id', voucherId)
     if (upErr) throw new Error('فشل تحديث بيانات السند: ' + upErr.message)
  }

  const finalAccountId = payload.financial_account_id || voucher.financial_account_id
  if (!finalAccountId) throw new Error('لا يمكن تنفيذ السند لعدم تحديد خزينة أو حساب بنكي')

  // 4. Auto-post the voucher using RPC to trigger cash movements
  const { error: postErr } = await supabase.rpc('post_payment_voucher', {
    p_voucher_id: voucherId,
    p_user_id: user?.id
  })
  
  if (postErr) throw new Error('فشل تنفيذ وسحب الرصيد: ' + postErr.message)

  await writeAuditLog({
    action: 'payment_executed',
    entity_type: 'payment_voucher',
    entity_id: voucherId,
    description: `تنفيذ واعتماد صرف مبلغ ${voucher.total_amount} من الخزينة`,
    metadata: { voucher_id: voucherId, executed_account_id: finalAccountId, attachments_count: payload.attachment_urls?.length || 0 },
  })

  // Record money withdrawal audit specifically for the account
  await writeAuditLog({
    action: 'funds_withdrawn',
    entity_type: 'financial_account',
    entity_id: finalAccountId,
    description: `صرف مدفوعات نقدية/بنكية بمبلغ ${voucher.total_amount}`,
    metadata: { payment_voucher_id: voucherId, total_amount: voucher.total_amount, reference_type: 'payment_voucher' },
  })

  revalidatePath('/company/treasury/queue')
  revalidatePath(`/projects/${voucher.project_id}/payments`)
  revalidatePath(`/company/treasury/${finalAccountId}`)
}

// Fetch single payment voucher details including allocations
export async function getPaymentVoucherDetails(voucherId: string) {
  const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(voucherId);
  if (!voucherId || !isUUID) throw new Error('Invalid Voucher ID');

  const supabase = createClient()
  
  const { data: voucher, error } = await supabase
    .from('payment_vouchers')
    .select(`
      *,
      financial_account:financial_account_id(arabic_name, currency),
      parties:payment_voucher_parties(
        id,
        paid_amount,
        party:party_id(arabic_name),
        allocations:payment_allocations(
            id,
            allocated_amount,
            source_entity_type,
            source_entity_id
        )
      )
    `)
    .eq('id', voucherId)
    .single()

  if (error) {
    console.error("getPaymentVoucherDetails Error:", error.message);
    throw new Error('Failed to load voucher details');
  }

  // Manually hydrate polymorphic associations
  const partyRecord = Array.isArray(voucher.parties) ? voucher.parties[0] : voucher.parties
  if (partyRecord?.allocations && partyRecord.allocations.length > 0) {
      const spInvoiceIds = partyRecord.allocations.filter((a: any) => a.source_entity_type === 'supplier_invoice').map((a: any) => a.source_entity_id)
      const subCertIds = partyRecord.allocations.filter((a: any) => a.source_entity_type === 'subcontractor_certificate').map((a: any) => a.source_entity_id)

      const [{ data: spInvoices }, { data: subCerts }] = await Promise.all([
          spInvoiceIds.length > 0 ? supabase.from('supplier_invoices').select('id, invoice_no, invoice_date').in('id', spInvoiceIds) : Promise.resolve({ data: [] }),
          subCertIds.length > 0 ? supabase.from('subcontractor_certificates').select('id, certificate_no, certificate_date').in('id', subCertIds) : Promise.resolve({ data: [] })
      ])

      const spInvoiceMap = Object.fromEntries((spInvoices || []).map(i => [i.id, i]))
      const subCertMap = Object.fromEntries((subCerts || []).map(i => [i.id, i]))

      partyRecord.allocations = partyRecord.allocations.map((a: any) => {
          if (a.source_entity_type === 'supplier_invoice' && spInvoiceMap[a.source_entity_id]) {
              return { ...a, supplier_invoices: spInvoiceMap[a.source_entity_id] }
          }
          if (a.source_entity_type === 'subcontractor_certificate' && subCertMap[a.source_entity_id]) {
              return { ...a, subcontractor_certificates: subCertMap[a.source_entity_id] }
          }
          return a
      })
  }

  return voucher;
}

// -------------------------------------------------------------------
// ADVANCE PAYMENTS — دفعات مقدمة للموردين والمقاولين
// -------------------------------------------------------------------

export async function recordAdvancePayment(payload: {
  project_id: string
  party_id:   string
  party_type: 'supplier' | 'contractor'   // للتصنيف في الرصيد
  financial_account_id: string
  amount: number
  payment_date: string
  payment_method: string
  reference_no?: string
  notes?: string
}) {
  // نجيب الـ user من الـ client العادي (اللي بيحمل JWT)
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()

  // الـ admin client للعمليات على قاعدة البيانات
  const supabase = createAdminClient()

  // جلب company_id من المشروع
  const { data: project } = await supabase
    .from('projects')
    .select('company_id')
    .eq('id', payload.project_id)
    .single()

  if (!project?.company_id) throw new Error('المشروع غير موجود أو لا يملك شركة')

  // 1. إنشاء سند الصرف من نوع advance
  const { data: voucher, error: vErr } = await supabase
    .from('payment_vouchers')
    .insert([{
      company_id:           project.company_id,
      project_id:           payload.project_id,
      voucher_no:           'تلقائي',
      payment_date:         payload.payment_date,
      payment_method:       payload.payment_method,
      financial_account_id: payload.financial_account_id,
      total_amount:         payload.amount,
      direction:            'outflow',
      status:               'draft',
      payment_type:         'advance',
      receipt_reference_no: payload.reference_no || null,
      notes:                payload.notes || null,
      created_by:           user?.id,
    }])
    .select('id')
    .single()

  if (vErr) throw vErr

  // 2. ربط الطرف (مورد أو مقاول)
  const { error: pErr } = await supabase
    .from('payment_voucher_parties')
    .insert([{
      payment_voucher_id: voucher.id,
      party_id:           payload.party_id,
      paid_amount:        payload.amount,
    }])

  if (pErr) throw pErr

  // 3. ترحيل السند (سيخصم المبلغ من الخزينة)
  const { error: postErr } = await supabase.rpc('post_payment_voucher', {
    p_user_id:    user?.id,
    p_voucher_id: voucher.id,
  })
  if (postErr) throw postErr

  // 4. تحديث رصيد الدفعات المقدمة للطرف
  const { error: rpcErr } = await supabase.rpc('upsert_party_advance_balance', {
    p_company_id:  project.company_id,
    p_project_id:  payload.project_id,
    p_party_id:    payload.party_id,
    p_party_type:  payload.party_type,
    p_add_amount:  payload.amount,
  })

  if (rpcErr) {
    console.error('Failed to update advance balance:', rpcErr)
    throw new Error('فشل تحديث رصيد المدفوعات المقدمة للطرف. يرجى التأكد من تشغيل التحديثات (Migrations).')
  }

  await writeAuditLog({
    action:      'advance_payment_created',
    entity_type: 'payment_voucher',
    entity_id:   voucher.id,
    description: `دفعة مقدمة بمبلغ ${payload.amount} لـ ${payload.party_type === 'supplier' ? 'مورد' : 'مقاول'}`,
    metadata:    { voucher_id: voucher.id, party_id: payload.party_id, amount: payload.amount },
  })

  revalidatePath(`/projects/${payload.project_id}/payments`)
  revalidatePath('/company/treasury')
  revalidatePath('/company/purchases')
  revalidatePath('/company/purchases/suppliers')
  return voucher.id
}

// رصيد الدفعات المقدمة لطرف معين في مشروع
export async function getPartyAdvanceBalance(
  projectId: string,
  partyId:   string,
  partyType: 'supplier' | 'contractor'
) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('party_advance_balances')
    .select('total_advanced, total_deducted, balance_remaining')
    .eq('project_id', projectId)
    .eq('party_id',   partyId)
    .eq('party_type', partyType)
    .maybeSingle()

  return data ?? { total_advanced: 0, total_deducted: 0, balance_remaining: 0 }
}

// قائمة الموردين والمقاولين المرتبطين بمشروع
export async function getProjectPartiesForAdvance(projectId: string) {
  const supabase = createAdminClient()

  // الموردين: كل الأطراف التي لها دور "supplier" في الشركة (بغض النظر عن المشروع)
  const { data: project } = await supabase
    .from('projects')
    .select('company_id')
    .eq('id', projectId)
    .single()

  const { data: supplierRoles } = await supabase
    .from('party_roles')
    .select('party_id, party:party_id(id, arabic_name, company_id)')
    .eq('role_type', 'supplier')
    .eq('is_active', true)

  // فلترة الموردين على نفس الشركة
  const uniqueSuppliers = (supplierRoles || [])
    .filter((r: any) => r.party?.company_id === project?.company_id && r.party?.arabic_name)
    .map((r: any) => ({
      id:           r.party_id,
      arabic_name:  r.party.arabic_name,
      type:         'supplier' as const,
    }))

  // المقاولين: من subcontract_agreements في هذا المشروع فقط
  const { data: agreements } = await supabase
    .from('subcontract_agreements')
    .select('subcontractor_party_id, party:subcontractor_party_id(id, arabic_name)')
    .eq('project_id', projectId)
    .not('subcontractor_party_id', 'is', null)

  const uniqueContractors = Array.from(
    new Map(
      (agreements || [])
        .filter((a: any) => a.party?.arabic_name)
        .map((a: any) => [
          a.subcontractor_party_id,
          { id: a.subcontractor_party_id, arabic_name: a.party.arabic_name, type: 'contractor' as const }
        ])
    ).values()
  )

  return { suppliers: uniqueSuppliers, contractors: uniqueContractors }
}

// -------------------------------------------------------------------
// جلب قائمة المشاريع النشطة للاستخدام في الشاشات المجمعة
// -------------------------------------------------------------------
export async function getCompanyProjects() {
  const supabase = createAdminClient()
  
  // First get the company ID
  const { data: company, error: cErr } = await supabase
    .from('companies')
    .select('id')
    .limit(1)
    .single()

  if (cErr || !company) return []

  // Get active projects
  const { data: projects, error: pErr } = await supabase
    .from('projects')
    .select('id, arabic_name, project_code')
    .eq('company_id', company.id)
    .in('status', ['active', 'planning', 'on_hold'])
    .order('arabic_name')

  if (pErr) {
    console.error('Error fetching company projects:', pErr.message)
    return []
  }

  return projects || []
}

// -------------------------------------------------------------------
// سداد/تسوية فاتورة أو مستخلص من رصيد دفعات مقدمة
// -------------------------------------------------------------------
export async function settleInvoiceFromAdvance(
  invoiceId: string,
  invoiceType: 'company_purchase_invoice' | 'supplier_invoice' | 'subcontractor_certificate',
  partyId: string,
  partyType: 'supplier' | 'contractor',
  payload: {
    advance_project_id: string | null
    invoice_project_id: string | null
    amount: number
    payment_date: string
    reference_no?: string
  }
) {
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()
  const adminSupabase = createAdminClient()

  if (!user) throw new Error('غير مصرح')
  if (payload.amount <= 0) throw new Error('مبلغ الاستقطاع غير صالح')

  // 1. Get company ID
  const { data: comp } = await adminSupabase.from('companies').select('id').single()
  if (!comp) throw new Error('لا توجد شركة معرفة')

  // 2. Call deduct_party_advance_balance RPC
  const { error: deductErr } = await adminSupabase.rpc('deduct_party_advance_balance', {
    p_company_id: comp.id,
    p_project_id: payload.advance_project_id,
    p_party_id: partyId,
    p_party_type: partyType,
    p_deduct_amount: payload.amount
  })
  
  if (deductErr) throw new Error('لا يمكن استقطاع الدفعة المقدمة: ' + deductErr.message)

  // 3. Create generic payment_voucher header with payment_type = 'advance_settlement'
  let voucherNo = `SETT-${Date.now().toString().slice(-6)}`
  const { data: vNext } = await adminSupabase.rpc('get_next_document_no', { 
    p_company_id: comp.id, p_doc_type: 'payment_vouchers', p_prefix: 'SETT' 
  })
  if (vNext) voucherNo = vNext

  const { data: voucher, error: vErr } = await adminSupabase
    .from('payment_vouchers')
    .insert({
      company_id: comp.id,
      project_id: payload.invoice_project_id, // Project the invoice belongs to
      financial_account_id: null,
      payment_type: 'advance_settlement',
      voucher_no: voucherNo,
      payment_date: payload.payment_date,
      direction: 'outflow',
      total_amount: payload.amount,
      payment_method: 'cash', // 'offset' is not in standard payment_method check yet
      receipt_reference_no: payload.reference_no,
      notes: `تسوية من دفعة مقدمة (مشروع ${payload.advance_project_id || 'الشركة'})`,
      created_by: user.id
    })
    .select('id')
    .single()

  if (vErr || !voucher) throw new Error('خطأ في إنشاء سند التسوية: ' + vErr?.message)

  // 4. Create payment_voucher_parties
  const { data: vParty, error: pErr } = await adminSupabase
    .from('payment_voucher_parties')
    .insert({
      payment_voucher_id: voucher.id,
      party_id: partyId,
      paid_amount: payload.amount,
      notes: ''
    })
    .select('id')
    .single()

  if (pErr || !vParty) throw new Error('خطأ في ربط المستفيد: ' + pErr?.message)

  // 5. Create payment_allocations to target the invoice
  const { error: allocErr } = await adminSupabase
    .from('payment_allocations')
    .insert({
      payment_voucher_party_id: vParty.id,
      source_entity_type: invoiceType,
      source_entity_id: invoiceId,
      allocated_amount: payload.amount
    })

  if (allocErr) throw new Error('خطأ في تخصيص مبلغ التسوية: ' + allocErr.message)

  // 6. Post payment voucher (which triggers invoice balance update)
  const { error: postErr } = await adminSupabase.rpc('post_payment_voucher', {
    p_voucher_id: voucher.id,
    p_user_id: user.id
  })

  if (postErr) throw new Error('خطأ في ترحيل سند التسوية: ' + postErr.message)

  await writeAuditLog({
    action: 'create_advance_settlement',
    entity_type: 'payment_vouchers',
    entity_id: voucher.id,
    description: `تم تسوية دفعة بقيمة ${payload.amount}`
  })
  
  revalidatePath(`/company/purchases/suppliers/${partyId}`)
  if (invoiceType === 'subcontractor_certificate') {
    revalidatePath(`/projects/${payload.invoice_project_id}/subcontractors/certificates/${invoiceId}`)
  } else if (invoiceType === 'supplier_invoice') {
    revalidatePath(`/projects/${payload.invoice_project_id}/procurement/invoices/${invoiceId}`)
  } else {
    revalidatePath(`/company/purchases/invoices/${invoiceId}`)
  }

  return { voucherId: voucher.id, voucherNo }
}
