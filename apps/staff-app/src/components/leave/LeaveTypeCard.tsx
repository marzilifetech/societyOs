import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ProgressRing } from './ProgressRing';

type Props = {
  label: string;
  type: string;
  used: number;
  total: number;
  color: string;
};

export function LeaveTypeCard({ label, type, used, total, color }: Props) {
  return (
    <View className="bg-white rounded-2xl p-4 shadow-sm flex-row items-center mb-3">
      <ProgressRing used={used} total={total} color={color} />
      <View className="flex-1 ml-4">
        <Text className="text-base font-semibold text-gray-900">{label}</Text>
        <Text className="text-xs text-gray-500 mt-0.5">
          {used} / {total} used
        </Text>
        <TouchableOpacity
          className="mt-2 self-start"
          onPress={() => router.push(`/leave/new?type=${type}` as any)}
        >
          <Text className="text-primary-500 text-xs font-semibold">Apply Now →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
