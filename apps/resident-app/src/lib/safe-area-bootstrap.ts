import { Dimensions } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import type { Metrics } from 'react-native-safe-area-context';

/**
 * A guaranteed-non-null, guaranteed-NON-ZERO seed for
 * <SafeAreaProvider initialMetrics={...}>.
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
 * When that event is missed during startup, the ENTIRE app tree never mounts —
 * no crash, no log, just the bare window background.
 *
 * Passing `initialWindowMetrics` is the documented fix but is NOT sufficient:
 * the Android native module computes it from the current activity and returns
 * null when the activity isn't attached yet.
 *
 * WHY THE SIZE IS VALIDATED, NOT JUST THE NULLNESS
 * ------------------------------------------------
 * A non-null seed with a ZERO-HEIGHT frame is just as fatal and much harder to
 * spot: the tree mounts, every view lays out at height 0, and the screen is
 * blank with a perfectly healthy-looking view hierarchy. Observed on ~2 of 15
 * cold starts, with the root LinearLayout reporting
 * `boundsInScreen: Rect(0, 0 - 720, 0)`.
 *
 * Two things can produce that zero:
 *   1. `Dimensions.get('window')` returns 0x0 when read this early — this
 *      module is evaluated at IMPORT time, before the window is measured.
 *   2. `initialWindowMetrics` itself can carry a zero frame on a device that
 *      resolved insets before laying out the content view.
 *
 * So every candidate is size-checked, and we fall through:
 *   initialWindowMetrics → window → screen → hard-coded default.
 *
 * The last resort only has to be non-zero, not correct: the real metrics arrive
 * moments later via onInsetsChange and replace it. A one-frame layout
 * correction is strictly better than a dead app.
 */
const MIN_USABLE_DIMENSION = 1;

function isUsable(m: Metrics | null | undefined): m is Metrics {
  return (
    !!m &&
    !!m.frame &&
    m.frame.width >= MIN_USABLE_DIMENSION &&
    m.frame.height >= MIN_USABLE_DIMENSION
  );
}

function metricsFrom(source: 'window' | 'screen'): Metrics | null {
  try {
    const { width, height } = Dimensions.get(source);
    if (width < MIN_USABLE_DIMENSION || height < MIN_USABLE_DIMENSION) return null;
    return {
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
      frame: { x: 0, y: 0, width, height },
    };
  } catch {
    return null;
  }
}

/**
 * Last-resort frame. Deliberately a common phone size rather than something
 * tiny — if this is ever used, the app renders at roughly the right proportions
 * for the single frame before the true metrics land.
 */
const LAST_RESORT: Metrics = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: { x: 0, y: 0, width: 360, height: 800 },
};

function resolveBootstrapMetrics(): Metrics {
  if (isUsable(initialWindowMetrics)) return initialWindowMetrics;

  const fromWindow = metricsFrom('window');
  if (isUsable(fromWindow)) return fromWindow;

  // 'screen' is populated from the display config rather than the (possibly
  // not-yet-laid-out) activity window, so it survives cases where 'window'
  // still reads 0.
  const fromScreen = metricsFrom('screen');
  if (isUsable(fromScreen)) return fromScreen;

  return LAST_RESORT;
}

export const bootstrapWindowMetrics: Metrics = resolveBootstrapMetrics();
