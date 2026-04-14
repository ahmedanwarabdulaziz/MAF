import Constants from 'expo-constants'
import { supabase } from './supabase'

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl as string

/**
 * Perform an authenticated API request to the main Vercel backend.
 * Automatically appends the user's Supabase JWT access token.
 */
export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }

  const url = `${API_BASE_URL}${endpoint}`
  const headers = new Headers(options.headers || {})
  headers.set('Authorization', `Bearer ${session.access_token}`)
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json')

  const response = await fetch(url, { cache: 'no-store', ...options, headers })
  
  if (!response.ok) {
    const errText = await response.text()
    if (response.status === 401 || response.status === 403) {
      throw new Error('Unauthorized')
    }
    throw new Error(`API Error: ${response.status} - ${errText}`)
  }

  return response.json()
}

export async function captureMobileEvent(payload: {
  action_type: string
  entity_type?: string
  entity_id?: string
  location?: { latitude: number; longitude: number; accuracy: number | null } | null
  device_context?: any
  metadata?: any
}) {
  return fetchApi('/api/mobile/events', {
    method: 'POST',
    body: JSON.stringify(payload)
  }).catch((err) => {
    // Audit failure shouldn't crash the main app, but should be logged.
    console.warn('Failed to capture mobile event:', err)
  })
}
