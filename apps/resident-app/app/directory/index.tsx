import { View, Text, TouchableOpacity, TextInput, FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type DirectoryEntry = {
  id: string;
  name: string;
  flat: { block: string; number: string };
  phone?: string;
};

export default function DirectoryScreen() {
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<DirectoryEntry[]>({
    queryKey: ['directory'],
    queryFn: () => api.get<DirectoryEntry[]>('/directory'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((e: any) =>
      e.name.toLowerCase().includes(q) ||
      `${e.flat.block}-${e.flat.number}`.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 w-10 h-10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-gray-900 text-2xl font-bold">Directory</Text>
          <Text className="text-gray-500 text-sm mt-0.5">Society residents</Text>
        </View>
      </View>

      <View className="px-6 mb-3">
        <View className="bg-gray-100 rounded-2xl flex-row items-center px-3.5">
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or flat…"
            placeholderTextColor="#9CA3AF"
            className="flex-1 text-gray-900 text-base ml-2"
            style={{ paddingVertical: 14 }}
            accessibilityLabel="Search residents"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading && (
        <View className="px-6">
          {[1, 2, 3, 4, 5].map((i: any) => (
            <View key={i} className="bg-gray-50 border border-gray-200 rounded-2xl mb-2.5" style={{ height: 64 }} />
          ))}
        </View>
      )}

      {isError && (
        <View className="px-6 items-center mt-10">
          <Text className="text-gray-700 text-base mb-3">Could not load directory</Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="bg-primary-500 rounded-2xl px-6 py-3"
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text className="text-white font-semibold text-base">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !isError && (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => item.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
          ListEmptyComponent={
            <View className="bg-gray-50 border border-gray-200 rounded-2xl p-8 items-center mt-5">
              <View className="w-16 h-16 rounded-full bg-primary-50 items-center justify-center mb-3">
                <Ionicons name="book" size={28} color="#821A52" />
              </View>
              <Text className="text-gray-900 text-base font-semibold">
                {search ? 'No results found' : 'Directory is empty'}
              </Text>
              <Text className="text-gray-500 text-sm text-center mt-2">
                {search ? 'Try a different search' : 'No residents have enabled directory visibility'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 mb-2 flex-row items-center">
              <View className="w-11 h-11 rounded-full bg-primary-50 items-center justify-center mr-3">
                <Text className="text-primary-700 text-lg font-bold">{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 text-base font-semibold">{item.name}</Text>
                <Text className="text-gray-500 text-xs mt-0.5">
                  Flat {item.flat.block}-{item.flat.number}
                </Text>
              </View>
              {item.phone ? (
                <TouchableOpacity className="w-9 h-9 rounded-full bg-primary-50 items-center justify-center">
                  <Ionicons name="call" size={16} color="#821A52" />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
