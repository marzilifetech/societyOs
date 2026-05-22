import { View, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  status: string;
  config: Record<string, { label: string; bg: string; color: string }>;
};

export function StatusBadge({ status, config }: Props) {
  const t = useTheme();
  const meta = config[status];
  if (!meta) {
    return (
      <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: t.fontXs, fontWeight: '600' }}>{status}</Text>
      </View>
    );
  }
  const isClassName = meta.bg.startsWith('bg-') || meta.color.startsWith('text-');
  if (isClassName) {
    return (
      <View className={`rounded-full px-3 py-1 ${meta.bg}`}>
        <Text className={`font-semibold ${meta.color}`} style={{ fontSize: t.fontSm }}>{meta.label}</Text>
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: meta.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: meta.color, fontSize: t.fontXs, fontWeight: '600' }}>{meta.label}</Text>
    </View>
  );
}
