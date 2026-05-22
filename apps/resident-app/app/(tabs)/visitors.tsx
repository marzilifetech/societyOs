import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type IoniconName = keyof typeof Ionicons.glyphMap;

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: IoniconName; iconColor: string; label: string }> = {
  EXPECTED: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'time', iconColor: '#1D4ED8', label: 'Expected' },
  CHECKED_IN: { bg: 'bg-green-100', text: 'text-green-700', icon: 'checkmark-circle', iconColor: '#15803D', label: 'Checked In' },
  CHECKED_OUT: { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'log-out', iconColor: '#4B5563', label: 'Checked Out' },
  DENIED: { bg: 'bg-red-100', text: 'text-red-700', icon: 'close-circle', iconColor: '#B91C1C', label: 'Denied' },
};

export default function VisitorsTab() {
  const { data: visitors, isLoading } = useQuery({
    queryKey: ['my-visitors'],
    queryFn: () => api.get<any[]>('/visitors/my'),
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row justify-between items-center">
        <Text className="text-2xl font-bold text-gray-900">Visitors</Text>
        <TouchableOpacity
          className="bg-primary-500 rounded-xl px-4 py-2 flex-row items-center gap-1"
          onPress={() => router.push('/visitor/new' as any)}
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text className="text-white font-semibold text-sm">Invite</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={visitors}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const c = STATUS_CONFIG[item.status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'person' as IoniconName, iconColor: '#4B5563', label: item.status?.replace('_', ' ') ?? '' };
          return (
            <TouchableOpacity
              className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-3"
              onPress={() => router.push(`/visitor/${item.id}` as any)}
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                  {item.purpose && (
                    <Text className="text-sm text-gray-500 mt-0.5">{item.purpose}</Text>
                  )}
                  <Text className="text-xs text-gray-400 mt-1">
                    {new Date(item.createdAt).toLocaleDateString('en-IN')}
                  </Text>
                </View>
                <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${c.bg}`}>
                  <Ionicons name={c.icon} size={12} color={c.iconColor} />
                  <Text className={`text-xs font-medium ${c.text}`}>{c.label}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center mt-20">
              <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                <Ionicons name="people" size={32} color="#821A52" />
              </View>
              <Text className="text-gray-900 font-semibold text-base">No visitors yet</Text>
              <Text className="text-gray-400 text-sm mt-1">Invite someone to create a gate pass code</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
