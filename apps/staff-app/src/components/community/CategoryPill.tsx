import { View, Text } from 'react-native';

const COLORS: Record<string, { bg: string; text: string }> = {
  POLICY: { bg: 'bg-blue-100', text: 'text-blue-700' },
  SAFETY: { bg: 'bg-red-100', text: 'text-red-700' },
  SCHEDULE: { bg: 'bg-amber-100', text: 'text-amber-700' },
  WELFARE: { bg: 'bg-green-100', text: 'text-green-700' },
  ONBOARDING: { bg: 'bg-purple-100', text: 'text-purple-700' },
  TRADE: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  'SOFT SKILLS': { bg: 'bg-pink-100', text: 'text-pink-700' },
};

export function CategoryPill({ category }: { category: string }) {
  const c = COLORS[category?.toUpperCase()] ?? { bg: 'bg-gray-100', text: 'text-gray-700' };
  return (
    <View className={`rounded-full px-2.5 py-1 ${c.bg} self-start`}>
      <Text className={`text-[10px] font-semibold ${c.text}`}>{category}</Text>
    </View>
  );
}
