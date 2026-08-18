import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'TimeTrack Pro',
  slug: 'timetrack-pro',
  version: '1.0.6',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'timetrackpro',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.tonypierogi.timetrackpro',
    config: {
      // App only talks HTTPS to Supabase — exempt from export compliance.
      // Without this, every TestFlight build stalls awaiting a manual answer.
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.tonypierogi.timetrackpro',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow TimeTrack Pro to access your photos so you can attach images to inventory checks and SOPs.',
        cameraPermission:
          'Allow TimeTrack Pro to use the camera so you can photograph inventory items and job sites.',
        // App captures stills only — no video, so no microphone access needed.
        microphonePermission: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: 'c51f86f6-2298-4a58-81d9-b18438b9a251',
    },
  },
};

export default config;
