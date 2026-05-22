import { ScrollView, View, Text, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type Bylaw = {
  id: string;
  title: string;
  content: string;
  section: string;
  updatedAt: string;
};

export default function BylawsScreen() {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<Bylaw[]>({
    queryKey: ['bylaws'],
    queryFn: () => api.get<Bylaw[]>('/societies/bylaws'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filtered = (data ?? []).filter((b: Bylaw) => {
    const q = search.toLowerCase();
    return b.title.toLowerCase().includes(q) || b.section.toLowerCase().includes(q);
  });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="min-h-[48px] justify-center mr-3 flex-row items-center">
          <Ionicons name="chevron-back" size={20} color="#821A52" />
          <Text className="text-primary-500 text-base ml-1">Back</Text>
        </TouchableOpacity>
        <Text className="text-gray-900 text-2xl font-bold flex-1">Society Bylaws</Text>
      </View>

      <View className="px-6 mb-3">
        <View className="flex-row items-center bg-gray-100 border border-gray-200 rounded-2xl px-4 py-2.5">
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by title or section…"
            placeholderTextColor="#9CA3AF"
            className="flex-1 text-gray-900 text-base ml-2"
            style={{ minHeight: 36 }}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}
      >
        {isLoading && [1, 2, 3, 4].map((i) => (
          <View key={i} className="bg-gray-50 rounded-2xl mb-2.5" style={{ height: 64 }} />
        ))}

        {isError && (
          <View className="bg-gray-50 rounded-2xl border border-gray-200 p-6 items-center">
            <Text className="text-gray-700 text-base mb-3">Could not load bylaws</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-2xl px-6 py-3 min-h-[48px] justify-center">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <View className="bg-gray-50 rounded-2xl border border-gray-200 p-8 items-center mt-10">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="library" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 text-lg font-semibold">Bylaws not uploaded yet</Text>
            <Text className="text-gray-500 text-sm text-center mt-2">Society bylaws will appear here once added</Text>
          </View>
        )}

        {!isLoading && !isError && data && data.length > 0 && filtered.length === 0 && (
          <Text className="text-gray-400 text-sm text-center py-6">No bylaws match your search</Text>
        )}

        {filtered.map((bylaw: Bylaw) => {
          const isOpen = !!expanded[bylaw.id];
          return (
            <TouchableOpacity
              key={bylaw.id}
              onPress={() => toggleExpand(bylaw.id)}
              activeOpacity={0.8}
              className={`bg-gray-50 rounded-2xl border mb-2.5 overflow-hidden ${
                isOpen ? 'border-primary-500' : 'border-gray-200'
              }`}
            >
              <View className="flex-row items-center p-4 min-h-[64px]">
                <View className="bg-primary-50 rounded-lg px-2 py-1 mr-3">
                  <Text className="text-primary-500 text-xs font-bold">{bylaw.section}</Text>
                </View>
                <Text className="text-gray-900 text-base font-semibold flex-1">{bylaw.title}</Text>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#9CA3AF"
                  style={{ marginLeft: 8 }}
                />
              </View>

              {isOpen && (
                <View className="px-4 pb-4 border-t border-gray-200">
                  <Text className="text-gray-700 text-sm leading-6 mt-3">{bylaw.content}</Text>
                  <Text className="text-gray-400 text-xs mt-2.5">
                    Last updated: {new Date(bylaw.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
