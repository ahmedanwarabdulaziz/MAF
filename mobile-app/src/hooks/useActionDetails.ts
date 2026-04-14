import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '../lib/api'

type ActionDetailsResponse = {
  data: {
    type: string
    header: any
    lines?: any[]
    message?: string
  }
}

export function useActionDetails(id: string) {
  return useQuery({
    queryKey: ['action-details', id],
    queryFn: async (): Promise<ActionDetailsResponse> => {
      return fetchApi(`/api/mobile/critical-actions/${id}`)
    },
    enabled: !!id,
    staleTime: 1000 * 60, // 1 minute
  })
}

export function useExecuteAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, action, attachmentUrls, note }: { id: string; action: 'approve' | 'reject', attachmentUrls?: string[], note?: string }) => {
      return fetchApi(`/api/mobile/critical-actions/${id}`, {
        method: 'POST',
        body: JSON.stringify({ action, attachmentUrls, note }),
      })
    },
    onSuccess: (_, variables) => {
      // Optimistically remove the item from the list so the UI updates instantly
      queryClient.setQueryData(['critical-actions'], (old: any) => {
        if (!old?.data?.items) return old
        return {
          ...old,
          data: {
            ...old.data,
            items: old.data.items.filter((item: any) => item.id !== variables.id)
          }
        }
      })

      // Invalidate both the details page and the master critical-actions list to trigger a background refetch
      queryClient.invalidateQueries({ queryKey: ['action-details', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['critical-actions'] })
    },
  })
}
