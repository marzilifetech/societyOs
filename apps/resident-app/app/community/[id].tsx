import { useState, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type Post = {
  id: string;
  content: string;
  reactions: number;
  isAnonymous: boolean;
  category?: string;
  createdAt: string;
  resident: { user: { name: string }; flatNumber?: string };
  _count: { comments: number };
};

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  resident: { user: { name: string }; flatNumber?: string };
};

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const { data: post, isLoading: postLoading } = useQuery<Post>({
    queryKey: ['community-post', id],
    queryFn: () => api.get<Post>(`/community/posts/${id}`),
    enabled: !!id,
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: ['community-comments', id],
    queryFn: () => api.get<Comment[]>(`/community/posts/${id}/comments`),
    enabled: !!id,
  });

  const reactMutation = useMutation({
    mutationFn: () => api.post(`/community/posts/${id}/react`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-post', id] }),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/community/posts/${id}/comments`, { content }),
    onSuccess: () => {
      setCommentText('');
      qc.invalidateQueries({ queryKey: ['community-comments', id] });
      qc.invalidateQueries({ queryKey: ['community-posts'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to post comment'),
  });

  const handleSubmitComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    commentMutation.mutate(trimmed);
  };

  const isLoading = postLoading || commentsLoading;

  const categoryColor: Record<string, string> = {
    General: '#821A52',
    Question: '#F59E0B',
    Announcement: '#10B981',
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View className="flex-row px-4 py-3 border-b border-gray-200">
      <View className="w-8 h-8 rounded-full bg-primary-50 items-center justify-center mr-3 mt-0.5">
        <Text className="text-primary-700 font-bold text-xs">
          {(item.resident?.user?.name?.[0] ?? '?').toUpperCase()}
        </Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center mb-0.5" style={{ gap: 6 }}>
          <Text className="text-gray-900 font-semibold text-[13px]">
            {item.resident?.user?.name ?? 'Neighbour'}
          </Text>
          {item.resident?.flatNumber ? (
            <Text className="text-gray-400 text-[11px]">· {item.resident.flatNumber}</Text>
          ) : null}
        </View>
        <Text className="text-gray-400 text-[11px] mb-1">
          {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text className="text-gray-700 text-sm leading-5">{item.content}</Text>
      </View>
    </View>
  );

  const ListHeader = () => {
    if (!post) return null;
    const cat = post.category ?? 'General';
    const catColor = categoryColor[cat] ?? '#821A52';
    return (
      <View className="bg-gray-50 border-b border-gray-200 mb-2">
        <View className="flex-row items-center px-4 pt-4 pb-3">
          <View className="w-10 h-10 rounded-full bg-primary-50 items-center justify-center mr-3">
            <Text className="text-primary-700 font-bold text-base">
              {post.isAnonymous ? '?' : (post.resident?.user?.name?.[0] ?? '?').toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Text className="text-gray-900 font-semibold text-[15px]">
                {post.isAnonymous ? 'Anonymous' : (post.resident?.user?.name ?? 'Neighbour')}
              </Text>
              {post.resident?.flatNumber && !post.isAnonymous ? (
                <Text className="text-gray-500 text-xs">{post.resident.flatNumber}</Text>
              ) : null}
            </View>
            <Text className="text-gray-500 text-xs mt-0.5">
              {new Date(post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={{ backgroundColor: `${catColor}1A` }} className="rounded-lg px-2 py-1">
            <Text style={{ color: catColor }} className="text-[11px] font-semibold">{cat}</Text>
          </View>
        </View>

        <Text className="text-gray-700 text-[15px] leading-[22px] px-4 pb-4">
          {post.content}
        </Text>

        <View className="flex-row items-center px-4 py-3 border-t border-gray-200" style={{ gap: 20 }}>
          <TouchableOpacity
            className="flex-row items-center"
            style={{ gap: 6 }}
            onPress={() => reactMutation.mutate()}
          >
            <Ionicons name="heart-outline" size={18} color="#6B7280" />
            <Text className="text-gray-500 text-[13px] font-medium">{post.reactions} likes</Text>
          </TouchableOpacity>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Ionicons name="chatbubble-outline" size={18} color="#6B7280" />
            <Text className="text-gray-500 text-[13px] font-medium">{post._count.comments} comments</Text>
          </View>
        </View>

        <View className="px-4 py-2.5 border-t border-gray-200 bg-white">
          <Text className="text-gray-400 text-[11px] font-semibold uppercase" style={{ letterSpacing: 0.8 }}>Comments</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center px-4 py-3 border-b border-gray-200">
          <TouchableOpacity onPress={() => router.back()} className="pr-3 py-1">
            <Ionicons name="chevron-back" size={24} color="#821A52" />
          </TouchableOpacity>
          <Text className="text-gray-900 text-base font-semibold flex-1">Post</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color="#821A52" style={{ marginTop: 80 }} />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={7}
            renderItem={renderComment}
            ListHeaderComponent={<ListHeader />}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View className="items-center py-10">
                <View className="w-16 h-16 rounded-full bg-primary-50 items-center justify-center mb-3">
                  <Ionicons name="chatbubble-ellipses" size={28} color="#821A52" />
                </View>
                <Text className="text-gray-500 text-sm">No comments yet — be first!</Text>
              </View>
            }
          />
        )}

        <View className="flex-row items-end px-4 py-3 bg-white border-t border-gray-200" style={{ gap: 12 }}>
          <TextInput
            ref={inputRef}
            className="flex-1 bg-gray-100 rounded-full px-4 text-sm text-gray-900"
            style={{ paddingVertical: 10, maxHeight: 112 }}
            placeholder="Write a comment…"
            placeholderTextColor="#9CA3AF"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={handleSubmitComment}
          />
          <TouchableOpacity
            className={`w-10 h-10 rounded-full items-center justify-center ${commentText.trim() ? 'bg-primary-500' : 'bg-gray-100'}`}
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || commentMutation.isPending}
          >
            {commentMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color={commentText.trim() ? '#fff' : '#9CA3AF'} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
