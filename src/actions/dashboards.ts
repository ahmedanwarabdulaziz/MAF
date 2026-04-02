'use server'

import { createClient } from '@/lib/supabase-server'

// --- CORPORATE DASHBOARD DATA ---
export async function getCompanyDashboardMetrics() {
  const supabase = createClient()
  
  // 1. Projects Count & Liabilities
  const { data: summary } = await supabase
    .from('vw_company_financial_summary')
    .select('*')
    .single()

  const activeProjects = Number(summary?.active_projects || 0)
  const totalSupplierLiability = Number(summary?.supplier_liability || 0)
  const totalSubcontractorLiability = Number(summary?.subcontractor_liability || 0)

  // 2. Treasury Balances (using the fast view)
  const { data: treasury } = await supabase
    .from('financial_account_balances_view')
    .select('project_id, current_balance, account_type')
  
  let corporateCash = 0
  let projectCash = 0
  
  treasury?.forEach(acc => {
    if (acc.project_id) projectCash += Number(acc.current_balance || 0)
    else corporateCash += Number(acc.current_balance || 0)
  })

  return {
    active_projects: activeProjects,
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

  // 1. Pre-aggregated Project Financial Summary
  const { data: view } = await supabase
    .from('vw_project_financial_summary')
    .select('*')
    .eq('project_id', projectId)
    .single()

  // 2. Local Treasury (Cashboxes)
  const { data: treasury } = await supabase
    .from('financial_account_balances_view')
    .select('current_balance')
    .eq('project_id', projectId)
  
  const siteCashboxBalance = treasury?.reduce((sum, t) => sum + Number(t.current_balance || 0), 0) || 0

  return {
    budget: Number(view?.budget || 0),
    site_cashbox: siteCashboxBalance,
    total_billed: Number(view?.billed || 0),
    total_collected: Number(view?.collected || 0),
    total_receivable: Number(view?.billed || 0) - Number(view?.collected || 0),
    incurred_material_cost: Number(view?.sup_cost || 0),
    subcontractor_liability: Number(view?.sub_cost || 0) - Number(view?.sub_paid || 0),
    supplier_liability: Number(view?.sup_cost || 0) - Number(view?.sup_paid || 0)
  }
}

// --- CONSOLIDATED MATRIX REPORT ---
export async function getConsolidatedProjectsReport() {
    const supabase = createClient()
    
    // Fetch directly from the high-performance Postgres view
    const { data: reports, error } = await supabase
        .from('vw_project_financial_summary')
        .select('*')
        .order('arabic_name', { ascending: true })
    
    if (error) throw error

    return (reports || []).map(p => {
        const totalCostIncurred = Number(p.sup_cost || 0) + Number(p.sub_cost || 0)
        const variance = Number(p.budget || 0) - totalCostIncurred

        return {
            id: p.project_id,
            name: p.arabic_name,
            budget: Number(p.budget || 0),
            billed: Number(p.billed || 0),
            collected: Number(p.collected || 0),
            cost: totalCostIncurred,
            variance,
            subLiability: Number(p.sub_cost || 0) - Number(p.sub_paid || 0),
            supLiability: Number(p.sup_cost || 0) - Number(p.sup_paid || 0)
        }
    })
}
