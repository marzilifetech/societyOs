import { View, Text } from 'react-native';

type Props = { value: number; size?: number; color?: string };

export function StarStrip({ value, size = 16, color = '#F59E0B' }: Props) {
  const full = Math.round(value);
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((i) => (
        <Text
          key={i}
          style={{ fontSize: size, color: i <= full ? color : '#D1D5DB', marginRight: 1 }}
        >
          ★
        </Text>
      ))}
    </View>
  );
}
