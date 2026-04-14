import { Stack } from 'expo-router'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient, asyncStoragePersister } from '../src/lib/query'
import { useEffect, useState } from 'react'
import { supabase } from '../src/lib/supabase'
import { Session } from '@supabase/supabase-js'
import * as ScreenOrientation from 'expo-screen-orientation'
import * as Device from 'expo-device'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    async function configureOrientation() {
      const deviceType = await Device.getDeviceTypeAsync()
      if (deviceType === Device.DeviceType.TABLET) {
        await ScreenOrientation.unlockAsync()
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
      }
    }
    configureOrientation()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setInitialized(true)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  if (!initialized) {
    return null // Could be a splash screen
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
      </Stack>
    </PersistQueryClientProvider>
  )
}
