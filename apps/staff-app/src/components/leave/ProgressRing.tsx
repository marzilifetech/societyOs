import { View, Text } from 'react-native';

// Lightweight pure-RN progress "ring" — uses concentric Views to avoid
// hard-dependency on react-native-svg. If svg is later available, this can
// be swapped for a true SVG circle.
type Props = {
  used: number;
  total: number;
  size?: number;
  color?: string;
};

export function ProgressRing({ used, total, size = 72, color = '#821A52' }: Props) {
  const pct = total > 0 ? Math.min(1, used / total) : 0;
  const remaining = Math.max(0, total - used);
  const ringSize = size;
  const inner = ringSize - 12;

  return (
    <View
      style={{
        width: ringSize,
        height: ringSize,
        borderRadius: ringSize / 2,
        borderWidth: 6,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Filled overlay arc emulated by a coloured strip whose height = pct */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: ringSize * pct,
          backgroundColor: color,
          opacity: 0.15,
        }}
      />
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: 'white',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text className="text-base font-bold text-gray-900">{remaining}</Text>
        <Text className="text-[10px] text-gray-400">left</Text>
      </View>
    </View>
  );
}
