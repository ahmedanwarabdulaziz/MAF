'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // We use useState to ensure we only create ONE QueryClient per session,
  // preventing data loss when React re-renders this component.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // Data remains "fresh" for 1 minute before refetching in background
            refetchOnWindowFocus: false, // Prevents aggressive refetching when switching tabs
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  )
}
