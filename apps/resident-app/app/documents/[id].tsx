import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Alert, TextInput, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type DocRequest = {
  id: string;
  type: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'COMPLETED' | 'REJECTED' | string;
  requestedAt: string;
  completedAt?: string;
  notes?: string;
  rating?: number;
  ratingComment?: string;
};

const STATUS_META: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  PROCESSING: { bg: 'bg-primary-50', text: 'text-primary-500', label: 'Processing' },
  READY: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ready' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
};

export default function DocumentRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showRating, setShowRating] = useState(false);

  const { data, isLoading, isError } = useQuery<DocRequest>({
    queryKey: ['document-request', id],
    queryFn: () => api.get<DocRequest>(`/document-requests/${id}`),
    enabled: !!id,
  });

  const rateMutation = useMutation({
    mutationFn: () =>
      api.post(`/document-requests/${id}/rating`, { rating, comment: comment.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-request', id] });
      qc.invalidateQueries({ queryKey: ['document-requests'] });
      setShowRating(false);
      Alert.alert('Thank you!', 'Your feedback has been submitted.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not submit rating.'),
  });

  const downloadFile = async () => {
    try {
      const r = await api.get<{ url: string }>(`/document-requests/${id}/download`);
      if (r?.url) await Linking.openURL(r.url);
    } catch (e: any) {
      Alert.alert('Download failed', e?.message ?? 'Could not download file.');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#821A52" />
      </SafeAreaView>
    );
  }
  if (isError || !data) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">Request not found</Text>
      </SafeAreaView>
    );
  }

  const meta = STATUS_META[data.status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: data.status };
  const isCompleted = data.status === 'COMPLETED' || data.status === 'READY';
  const hasRated = data.rating != null && data.rating > 0;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Document Request</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48, paddingTop: 8 }}>
        <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-5">
          <View className="flex-row items-start justify-between mb-3">
            <Text className="text-gray-900 text-lg font-semibold flex-1">{data.type}</Text>
            <View className={`rounded-full px-2.5 py-1 ${meta.bg}`}>
              <Text className={`text-xs font-bold ${meta.text}`}>{meta.label}</Text>
            </View>
          </View>
          <Text className="text-gray-500 text-sm">
            Requested: {new Date(data.requestedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          {data.completedAt && (
            <Text className="text-gray-500 text-sm mt-1">
              Completed: {new Date(data.completedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          )}
          {data.notes && (
            <View className="mt-3 pt-3 border-t border-gray-200">
              <Text className="text-gray-500 text-xs mb-1">Notes</Text>
              <Text className="text-gray-700 text-sm">{data.notes}</Text>
            </View>
          )}
        </View>

        {isCompleted && (
          <TouchableOpacity
            onPress={downloadFile}
            className="bg-primary-50 border border-primary-100 rounded-2xl py-4 items-center mb-5 flex-row justify-center gap-2"
            style={{ minHeight: 56 }}
            accessibilityRole="button"
            accessibilityLabel="Download document"
          >
            <Ionicons name="download-outline" size={18} color="#821A52" />
            <Text className="text-primary-500 font-semibold">Download Document</Text>
          </TouchableOpacity>
        )}

        {data.status === 'COMPLETED' && hasRated && (
          <View className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5">
            <Text className="text-gray-700 text-sm mb-1">Your rating</Text>
            <Text className="text-2xl">{'★'.repeat(data.rating ?? 0)}{'☆'.repeat(5 - (data.rating ?? 0))}</Text>
            {data.ratingComment ? <Text className="text-gray-600 text-sm italic mt-2">{data.ratingComment}</Text> : null}
          </View>
        )}

        {data.status === 'COMPLETED' && !hasRated && (
          <View className="mb-5">
            {!showRating ? (
              <TouchableOpacity
                onPress={() => setShowRating(true)}
                className="bg-primary-500 rounded-2xl py-4 items-center"
                style={{ minHeight: 56 }}
                accessibilityRole="button"
                accessibilityLabel="Rate this request"
              >
                <Text className="text-white font-semibold">Rate this Request</Text>
              </TouchableOpacity>
            ) : (
              <View className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                <Text className="font-semibold text-gray-700 mb-3">How was it?</Text>
                <View className="flex-row gap-3 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setRating(star)}
                      accessibilityRole="button"
                      accessibilityLabel={`Rate ${star} stars`}
                    >
                      <Text className={`text-3xl ${star <= rating ? 'opacity-100' : 'opacity-30'}`}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-4"
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Add a comment (optional)"
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity
                  className={`rounded-2xl py-4 items-center ${rating > 0 ? 'bg-primary-500' : 'bg-gray-200'}`}
                  onPress={() => rateMutation.mutate()}
                  disabled={rating === 0 || rateMutation.isPending}
                  style={{ minHeight: 56 }}
                  accessibilityRole="button"
                  accessibilityLabel="Submit rating"
                >
                  {rateMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className={`font-semibold ${rating > 0 ? 'text-white' : 'text-gray-400'}`}>Submit Rating</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
