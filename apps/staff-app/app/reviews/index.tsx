import { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { getUnwrapped } from '../../src/lib/unwrapped-get';
import { StarStrip } from '../../src/components/review/StarStrip';
import { ReviewCard } from '../../src/components/review/ReviewCard';
import { ErrorCard } from '../../src/components/ErrorCard';

const FILTERS = ['All', '5★', '4★', '3★', 'Negative'] as const;
type Filter = typeof FILTERS[number];

type ReviewRow = {
  id: string;
  rating: number;
  comment?: string;
  stars?: number;
  reviewer?: { name: string; flat: string | null };
  createdAt?: string;
};

/** Matches GET /staff/reviews (paginated) inner payload after envelope unwrap. */
type ReviewsPage = {
  items: ReviewRow[];
  total: number;
  page: number;
  pageSize: number;
  avgRating: number;
};

export default function ReviewsScreen() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('All');
  const [flagFor, setFlagFor] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [newCount, setNewCount] = useState(0);
  const lastTotalRef = useRef<number | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['my-reviews'],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = typeof pageParam === 'number' && pageParam >= 1 ? pageParam : 1;
      return getUnwrapped<ReviewsPage>(`/staff/reviews?page=${page}`);
    },
    getNextPageParam: (last) => {
      const next = last.page + 1;
      return last.page * last.pageSize < last.total ? next : undefined;
    },
  });

  const flatten =
    data?.pages.flatMap((p) => (Array.isArray(p.items) ? p.items : [])).filter(Boolean) ?? [];
  const first = data?.pages[0];
  const avg = first?.avgRating ?? 0;
  const total = first?.total ?? 0;

  // Poll for new reviews every 30s
  useEffect(() => {
    const id = setInterval(() => {
      getUnwrapped<ReviewsPage>('/staff/reviews?page=1')
        .then((p) => {
          if (lastTotalRef.current != null && p.total > lastTotalRef.current) {
            setNewCount(p.total - lastTotalRef.current);
          }
          lastTotalRef.current = p.total;
        })
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (first?.total != null) lastTotalRef.current = first.total;
  }, [first?.total]);

  const filtered = flatten.filter((r) => {
    if (!r) return false;
    const stars = r.stars ?? r.rating ?? 0;
    if (filter === 'All') return true;
    if (filter === 'Negative') return stars <= 2;
    return stars === Number(filter[0]);
  });

  const flagMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/staff/reviews/${id}/flag`, { reason }),
    onSuccess: () => {
      Alert.alert('Flagged', 'Review reported to admin.');
      setFlagFor(null);
      setFlagReason('');
      qc.invalidateQueries({ queryKey: ['my-reviews'] });
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-6 pt-4 pb-3 bg-white">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary-500 text-base mb-3">← Back</Text>
        </TouchableOpacity>
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-900">My Reviews</Text>
          <TouchableOpacity onPress={() => router.push('/reviews/performance' as any)}>
            <Text className="text-primary-500 text-sm font-semibold">Performance →</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View className="flex-row items-center mt-4 mb-3">
          <Text className="text-5xl font-bold text-gray-900 mr-3">{avg.toFixed(1)}</Text>
          <View>
            <StarStrip value={avg} size={20} />
            <Text className="text-xs text-gray-500 mt-1">{total} review{total !== 1 ? 's' : ''}</Text>
          </View>
          {newCount > 0 && (
            <View className="ml-auto bg-red-500 rounded-full px-2 py-1">
              <Text className="text-white text-xs font-semibold">{newCount} new</Text>
            </View>
          )}
        </View>

        {/* Filter chips */}
        <View className="flex-row gap-2 pb-2">
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              className={`px-3 py-1.5 rounded-full border ${
                filter === f ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'
              }`}
              onPress={() => setFilter(f)}
            >
              <Text className={`text-xs font-medium ${filter === f ? 'text-white' : 'text-gray-600'}`}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" />
        </View>
      ) : isError ? (
        <ErrorCard
          message="Your reviews couldn't be loaded. Please try again."
          onRetry={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">⭐</Text>
          <Text className="text-gray-500 text-center">No reviews yet — complete tasks to receive feedback</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { setNewCount(0); refetch(); }} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="my-4" color="#821A52" /> : null}
          renderItem={({ item }) => (
            <ReviewCard review={item} onLongPress={() => setFlagFor(item.id)} />
          )}
        />
      )}

      {/* Flag modal */}
      <Modal visible={!!flagFor} transparent animationType="fade" onRequestClose={() => setFlagFor(null)}>
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="bg-white rounded-2xl p-5 w-full">
            <Text className="text-base font-semibold text-gray-900 mb-1">Flag Review</Text>
            <Text className="text-xs text-gray-500 mb-3">Admin will review this report</Text>
            <TextInput
              className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-900 min-h-[80px]"
              placeholder="Why is this review inappropriate?"
              placeholderTextColor="#9CA3AF"
              value={flagReason}
              onChangeText={setFlagReason}
              multiline
              textAlignVertical="top"
            />
            <View className="flex-row gap-2 mt-4">
              <TouchableOpacity
                className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
                onPress={() => { setFlagFor(null); setFlagReason(''); }}
              >
                <Text className="text-sm font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-xl py-3 items-center ${flagReason.trim().length >= 5 ? 'bg-red-500' : 'bg-gray-200'}`}
                disabled={flagReason.trim().length < 5 || flagMutation.isPending}
                onPress={() => flagFor && flagMutation.mutate({ id: flagFor, reason: flagReason })}
              >
                {flagMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className={`text-sm font-semibold ${flagReason.trim().length >= 5 ? 'text-white' : 'text-gray-400'}`}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
