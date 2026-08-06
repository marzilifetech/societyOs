import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { CategoryPill } from '../../src/components/community/CategoryPill';

type Notice = {
  id: string;
  title: string;
  body: string;
  category: 'POLICY' | 'SAFETY' | 'SCHEDULE' | 'WELFARE';
  publishedAt: string;
  pinnedUntil?: string | null;
  attachments?: { url: string; name: string }[];
};

const CATEGORIES = ['All', 'POLICY', 'SAFETY', 'SCHEDULE', 'WELFARE'] as const;
type Cat = typeof CATEGORIES[number];

export default function NoticesScreen() {
  const [cat, setCat] = useState<Cat>('All');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['notices'],
    queryFn: () =>
      api
        .get<Notice[]>('/staff/community/notices')
        .catch((e) => {
          console.warn('[notices] fetch failed', e?.message);
          return [] as Notice[];
        }),
  });

  const filtered = (data ?? []).filter((n) => cat === 'All' || n.category === cat);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-6 pt-4 pb-3 bg-white">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                className={`px-3 py-1.5 rounded-full border ${
                  cat === c ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'
                }`}
                onPress={() => setCat(c)}
              >
                <Text className={`text-xs font-medium ${cat === c ? 'text-white' : 'text-gray-600'}`}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-4xl mb-3">📢</Text>
          <Text className="text-gray-400">No notices</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => {
            const isExpanded = expanded === item.id;
            const isPinned = item.pinnedUntil && new Date(item.pinnedUntil).getTime() > Date.now();
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setExpanded(isExpanded ? null : item.id)}
                className="bg-white rounded-2xl p-4 shadow-sm"
              >
                {isPinned && (
                  <View className="bg-amber-100 self-start rounded-full px-2 py-0.5 mb-2">
                    <Text className="text-[10px] text-amber-700 font-semibold">📌 Pinned</Text>
                  </View>
                )}
                <View className="flex-row items-center justify-between mb-2">
                  <CategoryPill category={item.category} />
                  <Text className="text-[10px] text-gray-400">
                    {new Date(item.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <Text className="text-base font-semibold text-gray-900 mb-1">{item.title}</Text>
                <Text className="text-sm text-gray-600 leading-5" numberOfLines={isExpanded ? undefined : 2}>
                  {item.body}
                </Text>
                {isExpanded && item.attachments && item.attachments.length > 0 && (
                  <View className="mt-3">
                    <Text className="text-xs font-semibold text-gray-500 mb-1">Attachments</Text>
                    {item.attachments.map((a) => (
                      <Text key={a.url} className="text-xs text-primary-500 mt-0.5">📎 {a.name}</Text>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
