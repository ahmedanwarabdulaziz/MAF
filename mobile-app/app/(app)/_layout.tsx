import { Stack } from 'expo-router'

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="critical-actions" 
        options={{ 
          title: 'المهام الحرجة',
          headerBackVisible: false,
          headerStyle: { backgroundColor: '#0a1628' },
          headerTintColor: '#ffffff',
        }} 
      />
    </Stack>
  )
}
