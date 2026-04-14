import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '../lib/api'
import { WorkInboxData } from '../types/work-inbox'

type CriticalActionsResponse = {
  data: WorkInboxData
  generatedAt: string
}

export function useCriticalActions() {
  return useQuery({
    queryKey: ['critical-actions'],
    queryFn: async (): Promise<CriticalActionsResponse> => {
      return fetchApi('/api/mobile/critical-actions')
    },
    // Keep data fresh longer internally if not explicitly pulled
    staleTime: 1000 * 60 * 5, 
    // Persist cache up to 24 hours 
    gcTime: 1000 * 60 * 60 * 24,
  })
}
