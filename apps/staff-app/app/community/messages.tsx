import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

type Group = {
  id: string;
  name: string;
  memberCount: number;
  lastMessage?: { body: string; createdAt: string } | null;
  unreadCount?: number;
};

export default function MessagesScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['msg-groups'],
    queryFn: () =>
      api
        .get<Group[]>('/staff/community/groups')
        .catch((e) => {
          console.warn('[groups] fetch failed', e?.message);
          return [] as Group[];
        }),
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" />
        </View>
      ) : !data?.length ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-4xl mb-3">💬</Text>
          <Text className="text-gray-400">No groups yet</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              className="bg-white rounded-2xl p-4 flex-row items-center"
              onPress={() => router.push(`/community/messages/${item.id}` as any)}
            >
              <View className="bg-primary-50 w-12 h-12 rounded-full items-center justify-center mr-3">
                <Text className="text-primary-600 font-bold text-base">
                  {item.name?.[0]?.toUpperCase() ?? 'G'}
                </Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-gray-900">{item.name}</Text>
                  {item.lastMessage && (
                    <Text className="text-[10px] text-gray-400">
                      {new Date(item.lastMessage.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
                <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                  {item.lastMessage?.body ?? `${item.memberCount} members`}
                </Text>
              </View>
              {(item.unreadCount ?? 0) > 0 && (
                <View className="bg-primary-500 rounded-full w-2.5 h-2.5 ml-2" />
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
