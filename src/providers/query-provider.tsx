'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// PERF-01: Static import is fine here — Next.js replaces process.env.NODE_ENV
// with "production" at build time, so the JSX branch below becomes dead code
// and webpack eliminates it from the production bundle automatically.
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
      {/* PERF-01: process.env.NODE_ENV === 'development' is false in prod builds,
          making this branch dead code that webpack eliminates from the bundle */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  )
}

