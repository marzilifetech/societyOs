import { useEffect, useRef } from 'react';
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

const BASE = 'rgba(20, 20, 20, 0.08)';
const PULSE_MS = 900;

/**
 * Placeholder block in the shape of content that is still loading.
 *
 * A skeleton holds the content's place, so nothing jumps when the data lands,
 * and it says "something is coming here" without implying an answer — unlike
 * an empty state shown too early. It pulses gently (opacity only, on the
 * native driver), and holds still when the OS asks for reduced motion.
 *
 * Decorative: hidden from screen readers. Give the surrounding container an
 * accessibility label such as "Loading your requests".
 *
 * The pulse is only decoration: the block is fully visible at rest, so it
 * still shows on the (old-architecture) setups where an Animated value never
 * reaches a view mounted after its screen's first render.
 *
 * For a stack of full-width list placeholders, use
 * components/common/SkeletonPlaceholder instead.
 */
export function Skeleton({ width = '100%', height = 14, radius = 8, style }: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      return undefined;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: PULSE_MS, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reducedMotion]);

  return (
    <Animated.View
      testID="skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: BASE, opacity }, style]}
    />
  );
}
