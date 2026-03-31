'use server'

import { createClient } from '@/lib/supabase-server'

export type LedgerEntry = {
  id: string
  source: 'petty_expense' | 'purchase_invoice' | 'store_issue'
  document_no: string
  date: string
  amount: number
  description: string
  status: string
  party_name?: string
}

export async function getCostCenterLedger(costCenterId: string, filters?: { date_from?: string; date_to?: string }) {
  const supabase = createClient()
  
  // 1. Fetch Petty Expenses
  let peQuery = supabase
    .from('petty_expenses')
    .select(`
      id, expense_date, total_amount, notes, status,
      creator:users!petty_expenses_created_by_fkey(display_name)
    `)
    .eq('cost_center_id', costCenterId)
    
  if (filters?.date_from) peQuery = peQuery.gte('expense_date', filters.date_from)
  if (filters?.date_to) peQuery = peQuery.lte('expense_date', filters.date_to)

  // 2. Fetch Company Purchase Invoices
  let cpiQuery = supabase
    .from('company_purchase_invoices')
    .select(`
      id, invoice_date, net_amount, notes, invoice_no, status,
      supplier:parties!supplier_party_id(arabic_name)
    `)
    .eq('cost_center_id', costCenterId)

  if (filters?.date_from) cpiQuery = cpiQuery.gte('invoice_date', filters.date_from)
  if (filters?.date_to) cpiQuery = cpiQuery.lte('invoice_date', filters.date_to)

  // 3. Fetch Store Issues (Main Warehouse & Projects)
  let siQuery = supabase
    .from('store_issues')
    .select(`
      id, issue_date, document_no, notes, status,
      lines:store_issue_lines(quantity, unit_cost)
    `)
    .eq('cost_center_id', costCenterId)
    .in('status', ['issued', 'partially_issued']) // Only fetch ones that actually hit the inventory value

  if (filters?.date_from) siQuery = siQuery.gte('issue_date', filters.date_from)
  if (filters?.date_to) siQuery = siQuery.lte('issue_date', filters.date_to)

  const [peRes, cpiRes, siRes] = await Promise.all([
    peQuery,
    cpiQuery,
    siQuery
  ])

  if (peRes.error) throw new Error(peRes.error.message)
  if (cpiRes.error) throw new Error(cpiRes.error.message)
  if (siRes.error) throw new Error(siRes.error.message)

  const entries: LedgerEntry[] = []

  // Process Petty Expenses
  peRes.data?.forEach((pe: any) => {
    // skip rejected or returned
    if (pe.status === 'rejected') return

    entries.push({
      id: pe.id,
      source: 'petty_expense',
      document_no: 'EXP-' + pe.id.substring(0, 6).toUpperCase(),
      date: pe.expense_date,
      amount: Number(pe.total_amount) || 0,
      description: pe.notes || 'مصروف نثري',
      status: pe.status,
      party_name: pe.creator?.display_name || 'موظف'
    })
  })

  // Process Purchase Invoices
  cpiRes.data?.forEach((cpi: any) => {
    if (cpi.status === 'cancelled') return

    entries.push({
      id: cpi.id,
      source: 'purchase_invoice',
      document_no: cpi.invoice_no,
      date: cpi.invoice_date,
      amount: Number(cpi.net_amount) || 0,
      description: cpi.notes || (cpi.supplier ? `فاتورة من ${cpi.supplier.arabic_name}` : 'فاتورة مشتريات'),
      status: cpi.status,
      party_name: cpi.supplier?.arabic_name || 'مورد عام'
    })
  })

  // Process Store Issues
  siRes.data?.forEach((si: any) => {
    // Calculate total cost of the issue based on unit_cost * quantity
    const totalCost = si.lines?.reduce((sum: number, l: any) => sum + (Number(l.quantity) * Number(l.unit_cost)), 0) || 0

    // Only add if it has cost
    if (totalCost > 0) {
      entries.push({
        id: si.id,
        source: 'store_issue',
        document_no: si.document_no || 'ISSUE-' + si.id.substring(0,6),
        date: si.issue_date,
        amount: totalCost,
        description: si.notes || 'إذن صرف أعيان من المخزن',
        status: si.status,
        party_name: 'إدارة المخازن'
      })
    }
  })

  // Sort by date descending
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Calculate KPIs
  const kpis = {
    total_petty: entries.filter(e => e.source === 'petty_expense').reduce((s, e) => s + e.amount, 0),
    total_purchases: entries.filter(e => e.source === 'purchase_invoice').reduce((s, e) => s + e.amount, 0),
    total_issues: entries.filter(e => e.source === 'store_issue').reduce((s, e) => s + e.amount, 0),
    total_all: entries.reduce((s, e) => s + e.amount, 0),
  }

  return { entries, kpis }
}
