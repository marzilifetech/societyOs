import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { ErrorCard } from '../../src/components/ErrorCard';

type Attachment = { url: string; name?: string; mimeType?: string };

type Notice = {
  id: string;
  title: string;
  body: string;
  publishedAt?: string;
  createdAt: string;
  isPinned?: boolean;
  attachments?: Attachment[];
  // Poll fields (when this notice is also a poll)
  question?: string;
  options?: string[];
  deadline?: string;
  isPoll?: boolean;
  myVote?: number | null;
};

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<Notice>({
    queryKey: ['notice', id],
    queryFn: () => api.get<Notice>(`/notices/${id}`),
    enabled: !!id,
  });

  const voteMutation = useMutation({
    mutationFn: (optionIndex: number) =>
      api.post(`/notices/${id}/vote`, { options: [optionIndex] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notice', id] });
      qc.invalidateQueries({ queryKey: ['polls'] });
    },
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not submit vote'),
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#821A52" />
      </SafeAreaView>
    );
  }

  // 404 / not found
  const isNotFound = isError && /404|not found/i.test((error as Error)?.message ?? '');
  if (isNotFound || (!isLoading && !isError && !data)) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-6 pt-4 pb-2 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2" accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900">Notice</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-2xl bg-gray-100 items-center justify-center mb-4">
            <Ionicons name="document" size={32} color="#9CA3AF" />
          </View>
          <Text className="text-gray-900 text-lg font-semibold">Notice not found</Text>
          <Text className="text-gray-500 text-sm text-center mt-2">It may have been removed by management.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-6 pt-4 pb-2 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2" accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900">Notice</Text>
        </View>
        <View className="px-6 pt-6">
          <ErrorCard message="Could not load this notice. Please try again." onRetry={() => refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  const isPoll = data.isPoll || (Array.isArray(data.options) && data.options.length > 0);
  const deadline = data.deadline ? new Date(data.deadline) : null;
  const isExpired = deadline ? deadline < new Date() : false;
  const hasVoted = data.myVote != null;
  const dateStr = (data.publishedAt ?? data.createdAt)
    ? new Date(data.publishedAt ?? data.createdAt).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '';

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Notice</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48, paddingTop: 8 }}>
        {data.isPinned && (
          <View className="flex-row items-center mb-3 gap-1">
            <Ionicons name="bookmark" size={14} color="#821A52" />
            <Text className="text-primary-500 font-semibold text-xs">PINNED</Text>
          </View>
        )}

        <Text className="text-gray-900 text-2xl font-bold mb-2">{data.title || data.question}</Text>
        {dateStr ? <Text className="text-gray-400 text-sm mb-5">{dateStr}</Text> : null}

        {data.body ? (
          <Text className="text-gray-700 text-base leading-6 mb-6">{data.body}</Text>
        ) : null}

        {/* Attachments */}
        {data.attachments && data.attachments.length > 0 && (
          <View className="mb-6">
            <Text className="text-gray-500 text-xs font-semibold mb-3 uppercase tracking-wide">Attachments</Text>
            {data.attachments.map((att, i) => {
              const isImage = att.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url);
              return (
                <TouchableOpacity
                  key={i}
                  className="bg-gray-50 border border-gray-200 rounded-2xl p-3 mb-2 flex-row items-center"
                  onPress={() => Linking.openURL(att.url)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open attachment ${att.name ?? i + 1}`}
                >
                  {isImage ? (
                    <Image source={{ uri: att.url }} style={{ width: 48, height: 48, borderRadius: 8 }} />
                  ) : (
                    <View className="w-12 h-12 rounded-lg bg-primary-50 items-center justify-center">
                      <Ionicons name="document" size={20} color="#821A52" />
                    </View>
                  )}
                  <Text className="ml-3 flex-1 text-gray-900 text-sm" numberOfLines={1}>
                    {att.name ?? `Attachment ${i + 1}`}
                  </Text>
                  <Ionicons name="open-outline" size={18} color="#6B7280" />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Poll section */}
        {isPoll && data.options && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4">
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="stats-chart" size={18} color="#821A52" />
              <Text className="text-gray-900 font-semibold text-base">Cast your vote</Text>
            </View>

            {data.options.map((option, i) => {
              const isSelected = selected === i;
              const isMine = data.myVote === i;
              const disabled = isExpired || hasVoted || voteMutation.isPending;
              return (
                <TouchableOpacity
                  key={i}
                  className={`border rounded-xl px-3 mb-2 min-h-[44px] justify-center ${
                    isSelected || isMine ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'
                  }`}
                  disabled={disabled}
                  onPress={() => !disabled && setSelected(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select option ${option}`}
                >
                  <Text className={`text-sm ${isSelected || isMine ? 'text-primary-500 font-semibold' : 'text-gray-700'}`}>
                    {option}{isMine ? '  ✓' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {!isExpired && !hasVoted && (
              <TouchableOpacity
                className={`mt-2 rounded-xl items-center justify-center min-h-[44px] ${
                  selected !== null && !voteMutation.isPending ? 'bg-primary-500' : 'bg-gray-200'
                }`}
                disabled={selected === null || voteMutation.isPending}
                onPress={() => selected !== null && voteMutation.mutate(selected)}
              >
                <Text className={`font-semibold text-sm ${selected !== null && !voteMutation.isPending ? 'text-white' : 'text-gray-400'}`}>
                  {voteMutation.isPending ? 'Submitting…' : 'Submit Vote'}
                </Text>
              </TouchableOpacity>
            )}

            {(hasVoted || isExpired) && (
              <Text className="text-xs text-gray-500 mt-1">
                {hasVoted ? 'Your vote has been recorded.' : 'Voting has closed.'}
              </Text>
            )}

            {deadline && (
              <Text className="mt-2 text-xs text-gray-400">
                {isExpired ? 'Closed' : `Closes ${deadline.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
