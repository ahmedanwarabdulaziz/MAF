import * as Location from 'expo-location'
import { useState } from 'react'
import { Platform } from 'react-native'

export type MobileLocation = {
  latitude: number
  longitude: number
  accuracy: number | null
}

export function useLocation() {
  const [isRequestingLocation, setIsRequestingLocation] = useState(false)

  // Request location gracefully
  // Returns location or null if denied/unavailable
  const getDeviceLocation = async (): Promise<MobileLocation | null> => {
    setIsRequestingLocation(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        console.log('Permission to access location was denied')
        return null
      }

      // Use balanced accuracy (approx 100m) to save battery and time.
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, 
      })

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      }
    } catch (error) {
      console.warn('Error fetching location:', error)
      return null
    } finally {
      setIsRequestingLocation(false)
    }
  }

  return {
    getDeviceLocation,
    isRequestingLocation,
  }
}
