import { Dimensions } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import type { Metrics } from 'react-native-safe-area-context';

/**
 * A guaranteed-non-null seed for <SafeAreaProvider initialMetrics={...}>.
 *
 * WHY THIS EXISTS
 * ---------------
 * SafeAreaProvider renders its native view but NO CHILDREN while its `insets`
 * state is null:
 *
 *     {insets != null ? (<...>{children}</...>) : null}
 *
 * `insets` is seeded from `initialMetrics?.insets ?? ... ?? null`, and if that
 * seed is null the provider waits for an async native `onInsetsChange` event.
 * When that event is missed during Fabric/bridgeless startup, the ENTIRE app
 * tree never mounts — no crash, no log, just the bare window background.
 *
 * Passing `initialWindowMetrics` is the documented fix, but it is NOT
 * sufficient on its own: the Android native module computes that constant from
 * the current activity and returns null when the activity isn't attached yet
 * or the insets aren't resolvable —
 *
 *     val decorView = reactApplicationContext.currentActivity?.window?.decorView
 *     val contentView = decorView?.findViewById<View>(android.R.id.content) ?: return null
 *     return if (insets == null || frame == null) null else ...
 *
 * So on some devices the seed is null anyway and the app blanks. Measured:
 * ~50% of cold starts on Android 15 with no seed, still ~40% on Android 16 with
 * the bare `initialWindowMetrics` seed.
 *
 * Falling back to zero insets over the real window size makes the first commit
 * unconditional. The true insets arrive moments later via onInsetsChange and
 * replace these — a sub-frame layout correction instead of a dead app.
 */
function fallbackMetrics(): Metrics {
  const { width, height } = Dimensions.get('window');
  return {
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
    frame: { x: 0, y: 0, width, height },
  };
}

export const bootstrapWindowMetrics: Metrics = initialWindowMetrics ?? fallbackMetrics();
