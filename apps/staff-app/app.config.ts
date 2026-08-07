import { ExpoConfig, ConfigContext } from '@expo/config';

/**
 * Dynamic config layer for the staff app. Static fields stay in `app.json`;
 * this file only overrides what needs to vary by build flavour. Currently:
 *
 *   APP_VARIANT=production  →  iOS `aps-environment=production`
 *   anything else (default) →  iOS `aps-environment=development`
 *
 * Apple's APNs gateway routing depends on the token environment, which is
 * itself determined by this entitlement. Releasing without flipping it
 * silently drops push to sandbox APNs (TestFlight is fine; App Store is not).
 *
 * Android: R8 minification + resource shrinking are enabled for release builds
 * (smaller APK, Play deobfuscation mapping). The keep rules below protect the
 * native libs the staff app invokes reflectively — reanimated, Sentry, MLKit
 * barcode (QR gate-pass scanning) and Google Maps (attendance/SOS). Unlike the
 * resident app, staff has NO Razorpay. These live here so they survive
 * `expo prebuild --clean`.
 */
const extraProguardRules = `
# ─── react-native-reanimated / worklets ─────────────────────────────────────
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }

# ─── React Native TurboModules ──────────────────────────────────────────────
-keep class com.facebook.react.turbomodule.** { *; }

# ─── @sentry/react-native (reflection: event processors, NDK symbolication) ──
-keep class io.sentry.** { *; }
-keepclassmembers class io.sentry.** { *; }
-keep class * extends io.sentry.core.SentryBaseEventProcessor { *; }
-keep class * implements io.sentry.core.Integration { *; }
-dontwarn io.sentry.android.core.FileIO
-dontwarn io.sentry.android.core.AnrV2Detector
-dontwarn io.sentry.core.protocol.SentryNanotrace

# ─── MLKit barcode (expo-camera QR gate-pass scan) — CRITICAL ───────────────
# The barcode scanner loads model/detector classes reflectively via GMS.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode.** { *; }
-keep class com.google.android.gms.vision.** { *; }
-dontwarn com.google.mlkit.**

# ─── react-native-maps + Google Maps SDK (attendance / SOS map) ─────────────
-keep class com.google.android.gms.maps.** { *; }
-keep interface com.google.android.gms.maps.** { *; }
-keep class com.airbnb.android.react.maps.** { *; }
-dontwarn com.google.android.gms.**

# ─── react-native-gesture-handler ───────────────────────────────────────────
-keep class com.swmansion.gesturehandler.** { *; }
-keepclassmembers class com.swmansion.gesturehandler.** { *; }
-dontwarn com.swmansion.gesturehandler.**

# ─── react-native-screens ──────────────────────────────────────────────────
-keep class com.swmansion.rnscreens.** { *; }
-keepclassmembers class com.swmansion.rnscreens.** { *; }
-dontwarn com.swmansion.rnscreens.**

# ─── react-native-safe-area-context ────────────────────────────────────────
-keep class com.th3rdwave.safeareacontext.** { *; }
-keepclassmembers class com.th3rdwave.safeareacontext.** { *; }
-dontwarn com.th3rdwave.safeareacontext.**

# ─── react-native-svg / webview (defensive dontwarn) ────────────────────────
-keep public class com.horcrux.svg.** { *; }
-dontwarn com.horcrux.svg.**
-dontwarn com.reactnativecommunity.webview.**
`;

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APP_VARIANT ?? 'development';
  const apsEnvironment = variant === 'production' ? 'production' : 'development';

  return {
    ...(config as ExpoConfig),
    plugins: [
      ...(config.plugins ?? []),
      // Disables expo-splash-screen's androidx system-splash management. Its
      // OnPreDrawListener blocks EVERY draw pass until hideAsync() lands, which
      // hangs the app on the splash forever on Android 15 / edge-to-edge /
      // New Arch. Reproduced and fixed in the resident app first. See the
      // plugin for the full rationale.
      './plugins/withAndroidNoSystemSplash',
      // Release signing lives here rather than hand-edited into the gitignored
      // android/ folder, where every `expo prebuild` silently reverted it to
      // the debug keystore. Credentials stay out of git — see the plugin.
      './plugins/withAndroidReleaseSigning',
      [
        'expo-build-properties',
        {
          android: {
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            extraProguardRules,
          },
        },
      ],
      // Kotlin bridge: creates every notification channel in
      // Application.onCreate (before JS loads, so a push that starts the
      // process finds its channel already present with the right importance /
      // DND policy) and exposes per-channel diagnostics + settings deep links.
      // Also sets the FCM default_notification_channel_id meta-data, whose
      // absence was silently downgrading pushes to a DEFAULT-importance
      // "Miscellaneous" channel. See the plugin for the full rationale.
      //
      // Registered LAST on purpose: expo-notifications' own manifest mod runs
      // after any plugin listed before it and rebuilds the <application>
      // meta-data list, which silently dropped this entry when this plugin sat
      // higher in the array.
      './plugins/withNativeNotifications',
      // Kotlin bridge: CameraX + MLKit QR scanner. Detection, same-code
      // de-duplication and torch control all happen natively, so JS receives
      // exactly one event per physical scan instead of ~25/sec of bridge
      // traffic. Falls back to expo-camera when absent — see the plugin.
      './plugins/withNativeQrScanner',
    ],
    ios: {
      ...(config.ios ?? {}),
      bundleIdentifier:
        (config.ios as any)?.bundleIdentifier ?? 'com.societyos.staff',
      entitlements: {
        ...((config.ios as any)?.entitlements ?? {}),
        'aps-environment': apsEnvironment,
      },
    },
  };
};
