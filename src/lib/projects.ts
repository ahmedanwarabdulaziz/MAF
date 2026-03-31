import { createClient } from '@/lib/supabase-server'

// ─── Company ──────────────────────────────────────────────────

export async function getCompany() {
  const supabase = createClient()
  const { data } = await supabase
    .from('companies')
    .select('*')
    .eq('is_active', true)
    .single()
  return data
}

// ─── Projects ─────────────────────────────────────────────────

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
export type ProjectOnboardingType = 'new' | 'existing'

export async function getProjects(filters?: {
  status?: ProjectStatus
  onboarding_type?: ProjectOnboardingType
}) {
  const supabase = createClient()
  let query = supabase
    .from('projects')
    .select(`
      id, project_code, arabic_name, english_name, status,
      project_onboarding_type, location, start_date, expected_end_date,
      planned_allocation_amount, estimated_contract_value, migration_status,
      created_at, cost_centers(arabic_name)
    `)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.onboarding_type) query = query.eq('project_onboarding_type', filters.onboarding_type)

  const { data } = await query
  return data ?? []
}

export async function getProject(id: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('projects')
    .select(`
      *,
      cost_centers(arabic_name, english_name),
      owner_party:owner_party_id(id, arabic_name),
      project_parties(
        id, project_role, status,
        parties(id, arabic_name, english_name)
      )
    `)
    .eq('id', id)
    .single()
  return data
}

// ─── Parties ──────────────────────────────────────────────────

export type PartyRoleType = 'owner' | 'subcontractor' | 'supplier' | 'consultant' | 'other'

export async function getParties(filters?: { role_type?: PartyRoleType; q?: string; status?: string }) {
  const supabase = createClient()
  let query = supabase
    .from('parties')
    .select(`
      id, arabic_name, english_name, phone, email, is_active, created_at,
      party_roles(role_type, is_active)
    `)
    .is('archived_at', null)
    .order('arabic_name')

  if (filters?.q) {
    query = query.or(`arabic_name.ilike.%${filters.q}%,english_name.ilike.%${filters.q}%,phone.ilike.%${filters.q}%`)
  }
  if (filters?.status === 'active') {
    query = query.eq('is_active', true)
  } else if (filters?.status === 'inactive') {
    query = query.eq('is_active', false)
  }

  const { data } = await query
  if (!data) return []

  if (filters?.role_type) {
    return data.filter((p: any) =>
      p.party_roles?.some((r: any) => r.role_type === filters.role_type && r.is_active)
    )
  }
  return data
}

export async function getParty(id: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('parties')
    .select(`
      *,
      party_roles(id, role_type, is_active),
      party_role_accounts(id, role_type, project_id, account_code, status, opening_balance),
      party_contacts(id, full_name, job_title, email, phone, is_primary),
      project_parties(
        id, project_role, status,
        projects(id, project_code, arabic_name)
      )
    `)
    .eq('id', id)
    .single()
  return data
}

// ─── Cost Centers ─────────────────────────────────────────────

export async function getCostCenters() {
  const supabase = createClient()
  const { data } = await supabase
    .from('cost_centers')
    .select('id, cost_center_code, arabic_name, english_name, center_type')
    .eq('is_active', true)
    .order('cost_center_code')
  return data ?? []
}
