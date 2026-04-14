import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 10 minutes cache time by default
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours garbage collection time for persistence
      retry: 2,
    },
  },
})

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
})
