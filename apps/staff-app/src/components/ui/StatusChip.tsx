import { Text, View } from 'react-native';
import type { StatusTone } from '../../lib/status-theme';

type StatusChipProps = {
  /** Colour pair from src/lib/status-theme.ts. */
  tone: StatusTone;
  /** Overrides the tone's default label (e.g. for i18n'd screens). */
  label?: string;
  className?: string;
};

/** Capsule status chip — colours always come from status-theme, never inline maps. */
export function StatusChip({ tone, label, className = '' }: StatusChipProps) {
  return (
    <View className={`rounded-full px-2.5 py-1 ${tone.bg} ${className}`}>
      <Text className={`text-xs font-semibold ${tone.text}`} numberOfLines={1}>
        {label ?? tone.label ?? ''}
      </Text>
    </View>
  );
}
