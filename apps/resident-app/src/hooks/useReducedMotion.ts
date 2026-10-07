import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Last known OS answer. The OS can only be asked asynchronously, so a hook
 * that starts from `false` would begin an animation and then snap it when the
 * answer arrives. Asked once at launch (primeReducedMotion), every screen
 * after that knows on its first render.
 */
let cached: boolean | null = null;

/** Ask the OS early — called at import time by the root layout. */
export function primeReducedMotion(): void {
  AccessibilityInfo.isReduceMotionEnabled()
    .then((value) => {
      cached = value;
    })
    .catch(() => {});
}

/**
 * True when the resident has asked the OS to reduce motion ("Remove
 * animations" on Android, "Reduce Motion" on iOS). Decorative animation must
 * stop then: some older users turn it off because movement makes screens
 * harder to follow.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(cached ?? false);

  useEffect(() => {
    let mounted = true;
    const update = (value: boolean) => {
      cached = value;
      if (mounted) setReduced(value);
    };
    AccessibilityInfo.isReduceMotionEnabled()
      .then(update)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

/** Test seam: forget the cached OS answer. */
export function __resetReducedMotionForTests(): void {
  cached = null;
}
