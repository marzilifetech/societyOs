import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  height?: number;
  count?: number;
  className?: string;
  borderRadius?: number;
};

export function SkeletonPlaceholder({
  height = 60,
  count = 3,
  className,
  borderRadius,
}: Props) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.85, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View key={i} style={{ opacity: pulse, marginBottom: 12 }}>
          <View
            className={className ?? 'bg-gray-200'}
            style={{ height, borderRadius: borderRadius ?? t.radiusMd }}
          />
        </Animated.View>
      ))}
    </>
  );
}
