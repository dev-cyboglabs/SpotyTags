import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config — staff Android app.
 *
 * Entry point: the React app detects `Capacitor.isNativePlatform()` in
 * App.js and redirects "/" → "/mobile" so the APK opens directly on the
 * staff workflow, never the desktop dashboard.
 */
const config: CapacitorConfig = {
  appId: 'com.spotytags.staff',
  appName: 'SpotyTags Staff',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    // Optional: point at a live server (online-only mode). Leave commented to
    // bundle the React build inside the APK (offline-capable).
    // url: 'https://staff-app-preview.preview.emergentagent.com/mobile',
  },
  android: { allowMixedContent: true },
};

export default config;
