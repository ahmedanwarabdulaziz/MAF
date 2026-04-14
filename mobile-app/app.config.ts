import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MAF',
  slug: 'maf-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0a1628',
  },
  // MOB-10: runtimeVersion ties OTA updates to the native build.
  // Increment this string whenever native dependencies or permissions change.
  runtimeVersion: '1.0.0',
  updates: {
    url: 'https://u.expo.dev/maf-mobile',
  },
  android: {
    package: 'com.maf.mobile',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a1628',
    },
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
    ],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#0a1628',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Allow MAF to access your camera to capture receipts and site photos.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow MAF to access your photos to attach files to records.',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: 'Allow MAF to use your location to stamp field actions.',
      },
    ],
  ],
  extra: {
    // Public Supabase config — safe to include here (anon key, not service key)
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://maf-psi.vercel.app',
    eas: {
      projectId: 'ce065cbd-a49b-43fd-b35a-8e413d2fc6af', // Filled in after `eas init`
    },
  },
  scheme: 'maf',
})
