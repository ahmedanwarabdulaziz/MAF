import { useEffect } from 'react'
import { router } from 'expo-router'
import { supabase } from '../src/lib/supabase'
import { View, Text, ActivityIndicator } from 'react-native'
import { usePushNotifications } from '../src/hooks/usePushNotifications'

export default function Index() {
  // Scaffold push token logic
  usePushNotifications()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Enforce basic active status check at startup before routing
        supabase.from('users').select('is_active').eq('id', session.user.id).single()
          .then(({ data, error }) => {
            if (error || data?.is_active === false) {
              supabase.auth.signOut()
            } else {
              router.replace('/(app)/critical-actions')
            }
          })
      } else {
        router.replace('/login')
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          router.replace('/login')
        }
      }
    )

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a1628' }}>
      <ActivityIndicator size="large" color="#ffffff" />
      <Text style={{ marginTop: 12, color: '#ffffff' }}>جارٍ استعادة الجلسة...</Text>
    </View>
  )
}
