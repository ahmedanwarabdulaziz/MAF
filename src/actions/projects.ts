'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

interface CreateProjectInput {
  project_code: string
  arabic_name: string
  english_name?: string | null
  project_onboarding_type: string
  status: string
  location?: string | null
  start_date?: string | null
  expected_end_date?: string | null
  estimated_contract_value?: number | null
  planned_allocation_amount?: number | null
  notes?: string | null
}

export async function createProject(input: CreateProjectInput): Promise<{ id: string }> {
  const supabase = createClient()

  // Fetch company server-side (no is_active filter — resilient to any state)
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (companyErr || !company) {
    throw new Error('لا توجد شركة مُسجَّلة في النظام')
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      company_id: company.id,
      ...input,
      // english_name is NOT NULL in schema — fallback to arabic_name
      english_name: input.english_name || input.arabic_name,
      migration_status: input.project_onboarding_type === 'existing' ? 'draft' : 'not_required',
    })
    .select('id')
    .single()

  if (error) {
    if (error.message.includes('unique')) throw new Error('رمز المشروع مستخدم بالفعل')
    throw new Error(error.message)
  }

  revalidatePath('/company/projects')
  return { id: data.id }
}
