import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { flatLabel, type ServiceRequest } from '@societyos/api-client';
import { Card } from '../ui/Card';

/**
 * Who asked, which flat, and what — at the top of every task screen. The
 * screens read `task.unit` / `task.requestedBy`, which the API never sends,
 * so they all said "Resident · Flat —".
 */
export function TaskSummaryCard({
  task,
  showCall = true,
}: {
  task: ServiceRequest;
  showCall?: boolean;
}) {
  const name = task.resident?.user?.name ?? 'Resident';
  const phone = task.resident?.user?.phone ?? null;
  const flat = flatLabel(task.resident?.flat);
  const floor = task.resident?.flat?.floor;

  return (
    <Card padding="lg">
      <Text className="mb-1 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {task.category}
      </Text>
      <View className="flex-row items-center">
        <View className="flex-1">
          <Text className="font-semibold text-base text-gray-900 dark:text-gray-100">
            {name}
            {flat ? ` · Flat ${flat}` : ''}
          </Text>
          {typeof floor === 'number' ? (
            <Text className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Floor {floor}</Text>
          ) : null}
        </View>
        {showCall && phone ? (
          <TouchableOpacity
            onPress={() => void Linking.openURL(`tel:${phone}`)}
            accessibilityRole="button"
            accessibilityLabel={`Call ${name}`}
            className="h-11 w-11 items-center justify-center rounded-full bg-green-600"
          >
            <Ionicons name="call" size={20} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>
      {task.description ? (
        <Text className="mt-2 text-sm leading-5 text-gray-600 dark:text-gray-300">
          {task.description}
        </Text>
      ) : null}
    </Card>
  );
}
