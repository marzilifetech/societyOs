import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type Post = {
  id: string;
  content: string;
  photoUrls: string[];
  reactions: number;
  isAnonymous: boolean;
  createdAt: string;
  resident: { user: { name: string } };
  _count: { comments: number };
};

export default function CommunityFeedScreen() {
  const qc = useQueryClient();
  const [page] = useState(1);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['community-posts', page],
    queryFn: () => api.get<{ posts: Post[]; total: number }>(`/community/posts?page=${page}&limit=20`),
  });

  const reactMutation = useMutation({
    mutationFn: (id: string) => api.post(`/community/posts/${id}/react`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-posts'] }),
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not react to post.'),
  });

  const posts = data?.posts ?? [];

  const renderPost = ({ item }: { item: Post }) => (
    <TouchableOpacity
      className="bg-gray-50 border border-gray-200 rounded-2xl mx-4 mb-3 overflow-hidden"
      onPress={() => router.push(`/community/${item.id}` as any)}
      activeOpacity={0.85}
    >
      <View className="p-4">
        <View className="flex-row items-center mb-3">
          <View className="w-9 h-9 rounded-full bg-primary-50 items-center justify-center mr-3">
            <Text className="text-primary-700 font-bold text-sm">
              {item.isAnonymous ? '?' : (item.resident?.user?.name?.[0] ?? '?').toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 font-semibold text-sm">
              {item.isAnonymous ? 'Anonymous' : (item.resident?.user?.name ?? 'Neighbour')}
            </Text>
            <Text className="text-gray-500 text-xs">
              {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        <Text className="text-gray-700 text-sm leading-5 mb-3" numberOfLines={4}>
          {item.content}
        </Text>

        <View className="flex-row items-center pt-2 border-t border-gray-200" style={{ gap: 16 }}>
          <TouchableOpacity
            className="flex-row items-center"
            style={{ gap: 4 }}
            onPress={() => reactMutation.mutate(item.id)}
          >
            <Ionicons name="heart-outline" size={16} color="#6B7280" />
            <Text className="text-gray-500 text-xs">{item.reactions}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center"
            style={{ gap: 4 }}
            onPress={() => router.push(`/community/${item.id}` as any)}
          >
            <Ionicons name="chatbubble-outline" size={16} color="#6B7280" />
            <Text className="text-gray-500 text-xs">{item._count.comments}</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center" style={{ gap: 4 }}>
            <Ionicons name="share-social" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-gray-900">Community</Text>
          <Text className="text-gray-500 text-sm">Connect with your neighbours</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#821A52" style={{ marginTop: 64 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          renderItem={renderPost}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#821A52" />
          }
          ListEmptyComponent={
            <View className="items-center mt-20">
              <View className="w-20 h-20 rounded-full bg-primary-50 items-center justify-center mb-4">
                <Ionicons name="chatbubbles" size={36} color="#821A52" />
              </View>
              <Text className="text-gray-900 text-lg font-semibold mb-1">Nothing here yet</Text>
              <Text className="text-gray-500 text-sm text-center px-8">
                Be the first to share something with your community!
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        className="absolute bottom-8 right-6 bg-primary-500 rounded-full w-14 h-14 items-center justify-center"
        style={{
          elevation: 6,
          shadowColor: '#821A52', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
        }}
        onPress={() => router.push('/community/new' as any)}
        accessibilityRole="button"
        accessibilityLabel="Create new post"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
