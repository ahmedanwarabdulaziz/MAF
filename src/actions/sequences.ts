'use server'

import { createClient } from '@/lib/supabase-server'

export async function peekNextDocumentNo(companyId: string, docType: string, prefix: string) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('peek_next_document_no', {
    p_company_id: companyId,
    p_doc_type: docType,
    p_prefix: prefix
  })

  // Fallback if RPC fails or migration is not applied yet
  if (error) {
    console.error('Error peeking next document no:', error)
    return `خطأ: ${error.message}`
  }
  
  return data as string
}

export async function peekNextDocumentNoByProject(projectId: string, docType: string, prefix: string) {
  const supabase = createClient()
  const { data: project } = await supabase.from('projects').select('company_id').eq('id', projectId).single()
  
  if (!project) return 'تلقائي'
    
  return peekNextDocumentNo(project.company_id, docType, prefix)
}

export async function peekNextCompanyDocumentNo(docType: string, prefix: string) {
  const supabase = createClient()
  // Assuming a single company context or getting first available
  const { data: company } = await supabase.from('companies').select('id').single()
  
  if (!company) return 'تلقائي'
    
  return peekNextDocumentNo(company.id, docType, prefix)
}
