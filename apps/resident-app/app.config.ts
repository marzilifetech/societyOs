import { ExpoConfig, ConfigContext } from '@expo/config';

/**
 * Dynamic config layer. The static fields stay in `app.json`; this file only
 * overrides what needs to vary by build flavour — the iOS APNs environment —
 * and injects native build config via `expo-build-properties`.
 *
 * IMPORTANT: an iOS `Release` build with `aps-environment=development` will
 * silently fail to deliver push (Apple ships dev tokens to sandbox APNs only).
 * Set APP_VARIANT=production for every release/TestFlight build.
 *
 * Android note: SDK 54 / RN 0.81 builds native libraries with NDK r27, which
 * produces 16 KB-page-aligned `.so` files (required by Google Play for apps
 * targeting Android 15+). The release R8/shrink config and ProGuard keep rules
 * below live here — rather than hand-edited into the gitignored `android/`
 * folder — so they survive every `expo prebuild --clean`.
 */

// R8 strips classes invoked reflectively unless explicitly kept. These keeps
// were established in production; removing any of them risks silent payment
// failures (Razorpay) or broken crash reporting (Sentry).
const extraProguardRules = `
# ─── react-native-reanimated ────────────────────────────────────────────────
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }

# ─── React Native TurboModules ──────────────────────────────────────────────
-keep class com.facebook.react.turbomodule.** { *; }

# ─── @sentry/react-native (io.sentry:sentry-android) ────────────────────────
# Sentry uses reflection for event processors, breadcrumb capture and NDK
# symbolication. Stripping any of these breaks crash reporting.
-keep class io.sentry.** { *; }
-keepclassmembers class io.sentry.** { *; }
-keep class * extends io.sentry.core.SentryBaseEventProcessor { *; }
-keep class * implements io.sentry.core.Integration { *; }
-dontwarn io.sentry.android.core.FileIO
-dontwarn io.sentry.android.core.AnrV2Detector
-dontwarn io.sentry.core.protocol.SentryNanotrace

# ─── react-native-razorpay (CRITICAL — payment callbacks via reflection) ────
# Razorpay's PaymentResult listener is invoked reflectively from the native
# Checkout activity. If R8 renames the method, every payment silently fails
# at the callback.
-keep class com.razorpay.** { *; }
-keep class com.razorpay.rn.** { *; }
-keepclassmembers class com.razorpay.PaymentResultWithDataListener { *; }
-keepclassmembers class com.razorpay.ExternalWalletListener { *; }
-keepclassmembers class com.razorpay.rn.RazorpayModule {
  public <init>(com.facebook.react.bridge.ReactApplicationContext);
  public void open(com.facebook.react.bridge.ReadableMap);
  public void onActivityResult(int, int, android.content.Intent);
  public void onPaymentSuccess(java.lang.String, com.razorpay.PaymentData);
  public void onPaymentError(int, java.lang.String, com.razorpay.PaymentData);
  public void onExternalWalletSelected(java.lang.String, com.razorpay.PaymentData);
}
-keep class com.razorpay.CheckoutActivity { *; }
-keep class com.razorpay.PaymentData { *; }
-keep class com.razorpay.Checkout { *; }
-keepclasseswithmembers class com.razorpay.** { public <init>(...); }
-dontwarn com.razorpay.**

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
`;

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APP_VARIANT ?? 'development';
  const apsEnvironment = variant === 'production' ? 'production' : 'development';

  return {
    ...(config as ExpoConfig),
    plugins: [
      ...(config.plugins ?? []),
      // Disables expo-splash-screen's androidx system-splash management, which
      // blocks the activity's first draw until hideAsync() lands and hangs the
      // app on the maroon splash (Android 15 / edge-to-edge / New Arch — seen
      // on OnePlus). This used to be a hand edit inside the gitignored
      // `android/` folder, so every prebuild — i.e. every EAS/Play Store build
      // — silently reverted it while local builds kept working. See the plugin
      // for the full rationale.
      './plugins/withAndroidNoSystemSplash',
      // Same reasoning: release signing was a hand edit in the gitignored
      // android/ folder, so `expo prebuild` kept reverting local release builds
      // to the debug keystore. Credentials stay out of git — see the plugin.
      './plugins/withAndroidReleaseSigning',
      [
        'expo-build-properties',
        {
          android: {
            // Re-enable R8 minification + resource shrinking for release builds.
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
        (config.ios as any)?.bundleIdentifier ?? 'com.societyos.resident',
      entitlements: {
        ...((config.ios as any)?.entitlements ?? {}),
        'aps-environment': apsEnvironment,
      },
    },
  };
};
