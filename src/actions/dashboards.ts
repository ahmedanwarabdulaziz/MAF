'use server'

import { createClient } from '@/lib/supabase-server'

// --- CORPORATE DASHBOARD DATA ---
export async function getCompanyDashboardMetrics() {
  const supabase = createClient()
  
  // 1. Projects Count
  const { count: activeProjects } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })

  // 2. Treasury Balances
  const { data: treasury } = await supabase
    .from('financial_account_balances_view')
    .select('project_id, current_balance, account_type')
  
  let corporateCash = 0
  let projectCash = 0
  
  treasury?.forEach(acc => {
    if (acc.project_id) projectCash += Number(acc.current_balance || 0)
    else corporateCash += Number(acc.current_balance || 0)
  })

  // 3. Outstanding Liabilities (Suppliers & Subcontractors)
  // We can sum directly via JS for MVP speed and simplicity
  const { data: suppliers } = await supabase
    .from('supplier_invoices')
    .select('net_amount, paid_to_date')
    .in('status', ['posted', 'partially_paid'])
  
  const totalSupplierLiability = suppliers?.reduce((sum, s) => sum + (Number(s.net_amount) - Number(s.paid_to_date || 0)), 0) || 0

  const { data: subcontractors } = await supabase
    .from('subcontractor_certificates')
    .select('outstanding_amount')
    .in('status', ['approved'])  // certificate_status ENUM: approved|paid_in_full (no 'partially_paid')

  const totalSubcontractorLiability = subcontractors?.reduce((sum, s) => sum + Number(s.outstanding_amount || 0), 0) || 0

  return {
    active_projects: activeProjects || 0,
    corporate_cash_balance: corporateCash,
    project_cash_balance: projectCash,
    supplier_liability: totalSupplierLiability,
    subcontractor_liability: totalSubcontractorLiability,
    total_liability: totalSupplierLiability + totalSubcontractorLiability
  }
}

// --- PROJECT DASHBOARD DATA ---
export async function getProjectDashboardMetrics(projectId: string) {
  const supabase = createClient()

  // 1. Budget Summary
  const { data: budgets } = await supabase
    .from('project_budget_versions')
    .select('total_estimated_cost')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .single()
  
  const totalBudget = Number(budgets?.total_estimated_cost || 0)

  // 2. Local Treasury (Cashboxes)
  const { data: treasury } = await supabase
    .from('financial_account_balances_view')
    .select('current_balance')
    .eq('project_id', projectId)
  
  const siteCashboxBalance = treasury?.reduce((sum, t) => sum + Number(t.current_balance || 0), 0) || 0

  // 3. Local Liabilities
  const { data: suppliers } = await supabase
    .from('supplier_invoices')
    .select('net_amount, paid_to_date')
    .eq('project_id', projectId)
    .in('status', ['posted', 'partially_paid'])
  const localSupplierLiability = suppliers?.reduce((sum, s) => sum + (Number(s.net_amount) - Number(s.paid_to_date || 0)), 0) || 0

  const { data: subcontractors } = await supabase
    .from('subcontractor_certificates')
    .select('outstanding_amount')
    .eq('project_id', projectId)
    .in('status', ['approved'])  // certificate_status ENUM: approved|paid_in_full (no 'partially_paid')
  const localSubcontractorLiability = subcontractors?.reduce((sum, s) => sum + Number(s.outstanding_amount || 0), 0) || 0

  // 4. Receivables (Owner Billed vs Collected)
  const { data: ownerBilling } = await supabase
    .from('owner_billing_certificates')
    .select('amount, collected_amount')
    .eq('project_id', projectId)
    .eq('status', 'approved')
  
  let totalBilled = 0
  let totalCollected = 0
  ownerBilling?.forEach(b => {
      totalBilled += Number(b.amount || 0)
      totalCollected += Number(b.collected_amount || 0)
  })

  // 5. Procurement Cost (Total POs or Total Approved Invoices)
  // Let's use total approved invoices as actual incurred material cost
  const { data: allSupInvoices } = await supabase
    .from('supplier_invoices')
    .select('net_amount')
    .eq('project_id', projectId)
    .in('status', ['posted', 'partially_paid', 'paid'])
  const incurredMaterialCost = allSupInvoices?.reduce((sum, i) => sum + Number(i.net_amount || 0), 0) || 0

  return {
    budget: totalBudget,
    site_cashbox: siteCashboxBalance,
    total_billed: totalBilled,
    total_collected: totalCollected,
    total_receivable: totalBilled - totalCollected,
    incurred_material_cost: incurredMaterialCost,
    subcontractor_liability: localSubcontractorLiability,
    supplier_liability: localSupplierLiability
  }
}

// --- CONSOLIDATED MATRIX REPORT ---
export async function getConsolidatedProjectsReport() {
    const supabase = createClient()
    // Fetch all active projects
    const { data: projects, error } = await supabase
        .from('projects')
        .select('id, arabic_name')
        .order('created_at', { ascending: false })
    
    if (error) throw error

    // Fetch parallel massive data (in a real prod app with 10k rows, this would be a postgres view or RPC)
    const [budgetsRes, ownerRes, supRes, subRes] = await Promise.all([
        supabase.from('project_budget_versions').select('project_id, total_estimated_cost').eq('is_active', true),
        supabase.from('owner_billing_certificates').select('project_id, amount, collected_amount').eq('status', 'approved'),
        supabase.from('supplier_invoices').select('project_id, net_amount, paid_to_date').in('status', ['posted', 'partially_paid', 'paid']),
        supabase.from('subcontractor_certificates').select('project_id, net_amount, paid_to_date').in('status', ['approved', 'paid_in_full'])
    ])

    return projects.map(p => {
        const budget = budgetsRes.data?.find(b => b.project_id === p.id)
        
        let billed = 0, collected = 0
        ownerRes.data?.filter(o => o.project_id === p.id).forEach(o => {
            billed += Number(o.amount || 0)
            collected += Number(o.collected_amount || 0)
        })

        let supCost = 0, supPaid = 0
        supRes.data?.filter(s => s.project_id === p.id).forEach(s => {
            supCost += Number(s.net_amount || 0)
            supPaid += Number(s.paid_to_date || 0)
        })

        let subCost = 0, subPaid = 0
        subRes.data?.filter(s => s.project_id === p.id).forEach(s => {
            subCost += Number(s.net_amount || 0)
            subPaid += Number(s.paid_to_date || 0)
        })

        const totalCostIncurred = supCost + subCost
        const variance = (Number(budget?.total_estimated_cost || 0)) - totalCostIncurred

        return {
            id: p.id,
            name: p.arabic_name,
            budget: Number(budget?.total_estimated_cost || 0),
            billed,
            collected,
            cost: totalCostIncurred,
            variance,
            subLiability: subCost - subPaid,
            supLiability: supCost - supPaid
        }
    })
}
