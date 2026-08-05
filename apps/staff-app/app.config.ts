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
