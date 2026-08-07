import { useEffect, useRef } from 'react';
import { Animated, Easing, type ViewStyle } from 'react-native';
import { useColorScheme } from 'nativewind';

/**
 * Pulsing loading placeholder.
 *
 * WHY THIS EXISTS — DO NOT REPLACE THIS WITH `className="animate-pulse"`
 * ---------------------------------------------------------------------
 * Tailwind's `animate-pulse` is implemented by NativeWind as an ANIMATED
 * STYLE. NativeWind also wraps `View` in its JSX interop, turning it into the
 * function component `CssInterop.View`. React Native's Animated refuses that
 * combination and throws:
 *
 *   Looks like you're passing an animation style to a function component
 *   `View`. Please wrap your function component with `React.forwardRef()`…
 *
 * which the root ErrorBoundary catches and turns into a full-screen
 * "Something went wrong". Because skeletons render in the LOADING state, this
 * took down the staff Home screen and the notification inbox on essentially
 * every cold start — the screens failed before their data ever arrived.
 *
 * This is the same pinned-stack constraint behind `Tappable` (function-form
 * `style` on Pressable is dropped) and the Reanimated removal in PhotoViewer:
 * on NativeWind 4.1.x + old architecture, animation and the className interop
 * cannot be applied to the same element.
 *
 * The fix is to animate a plain `Animated.View` with a plain `style`, never
 * touching the interop. Colours are resolved from the NativeWind colour scheme
 * so dark mode still works without a className.
 */
const LIGHT = '#F3F4F6'; // gray-100
const DARK = '#1F2937'; // gray-800

export function Skeleton({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const { colorScheme } = useColorScheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { backgroundColor: colorScheme === 'dark' ? DARK : LIGHT, borderRadius: 16 },
        style,
        { opacity },
      ]}
    />
  );
}

/** Full-width block placeholder. */
export function SkeletonCard({ height = 80 }: { height?: number }) {
  return <Skeleton style={{ height }} />;
}

/** Three side-by-side tiles — the shape of the attendance stat row. */
export function SkeletonRow() {
  return (
    <Animated.View style={{ flexDirection: 'row', gap: 12 }}>
      <Skeleton style={{ flex: 1, height: 64, borderRadius: 12 }} />
      <Skeleton style={{ flex: 1, height: 64, borderRadius: 12 }} />
      <Skeleton style={{ flex: 1, height: 64, borderRadius: 12 }} />
    </Animated.View>
  );
}
