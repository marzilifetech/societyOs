import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type FeedbackItem = {
  id: string;
  category: string;
  subject: string;
  submittedAt: string;
  status: 'RECEIVED' | 'REVIEWED' | 'ACTIONED';
};

const CATEGORIES = ['Maintenance', 'Security', 'Cleanliness', 'Staff', 'Amenities', 'General'];

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  RECEIVED: { color: '#1D4ED8', bg: '#DBEAFE', label: 'Received' },
  REVIEWED: { color: '#B45309', bg: '#FEF3C7', label: 'Reviewed' },
  ACTIONED: { color: '#15803D', bg: '#DCFCE7', label: 'Actioned' },
};

export default function FeedbackScreen() {
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<FeedbackItem[]>({
    queryKey: ['feedback-mine'],
    queryFn: () => api.get<FeedbackItem[]>('/feedback/my'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const mutation = useMutation({
    mutationFn: (body: object) => api.post('/feedback', body),
    onSuccess: () => {
      Alert.alert('Thank you for your feedback', '', [{ text: 'OK', onPress: () => {
        setCategory('');
        setSubject('');
        setMessage('');
        setRating(0);
        refetch();
        router.back();
      }}]);
    },
    onError: () => {
      Alert.alert('Error', 'Could not submit feedback. Please try again.');
    },
  });

  const handleSubmit = () => {
    if (!category) { Alert.alert('Required', 'Please select a category.'); return; }
    if (!subject.trim()) { Alert.alert('Required', 'Please enter a subject.'); return; }
    if (message.trim().length < 20) { Alert.alert('Required', 'Message must be at least 20 characters.'); return; }
    mutation.mutate({
      category,
      subject: subject.trim(),
      message: message.trim(),
      rating: rating > 0 ? rating : undefined,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 w-10 h-10 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-gray-900 text-2xl font-bold flex-1">Feedback</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}
      >
        <Text className="text-gray-500 text-xs font-semibold mb-2.5 mt-2" style={{ letterSpacing: 0.5 }}>CATEGORY *</Text>
        <View className="flex-row flex-wrap mb-6" style={{ gap: 10 }}>
          {CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                className={`rounded-xl px-3.5 py-2.5 border ${active ? 'bg-primary-50 border-primary-500' : 'bg-gray-50 border-gray-200'}`}
              >
                <Text className={`font-semibold text-sm ${active ? 'text-primary-700' : 'text-gray-700'}`}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="text-gray-500 text-xs font-semibold mb-2" style={{ letterSpacing: 0.5 }}>SUBJECT *</Text>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          placeholder="Brief subject line…"
          placeholderTextColor="#9CA3AF"
          className="bg-gray-100 rounded-2xl text-gray-900 text-base mb-6"
          style={{ padding: 16, minHeight: 52 }}
        />

        <Text className="text-gray-500 text-xs font-semibold mb-2" style={{ letterSpacing: 0.5 }}>MESSAGE *</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Describe your feedback (min 20 chars)…"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={5}
          className="bg-gray-100 rounded-2xl text-gray-900 text-base mb-2"
          style={{ padding: 16, minHeight: 140, textAlignVertical: 'top' }}
        />
        <Text
          className={`text-xs mb-6 text-right ${message.trim().length < 20 && message.length > 0 ? 'text-red-500' : 'text-gray-400'}`}
        >
          {message.trim().length}/20 min
        </Text>

        <Text className="text-gray-500 text-xs font-semibold mb-2.5" style={{ letterSpacing: 0.5 }}>RATING (OPTIONAL)</Text>
        <View className="flex-row mb-8" style={{ gap: 8 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(rating === star ? 0 : star)}
              className="px-1 justify-center"
              style={{ minHeight: 48 }}
            >
              <Ionicons
                name={star <= rating ? 'star' : 'star-outline'}
                size={32}
                color={star <= rating ? '#F59E0B' : '#D1D5DB'}
              />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={mutation.isPending}
          className="bg-primary-500 rounded-2xl py-4 items-center justify-center mb-8"
          style={{ minHeight: 56 }}
        >
          <Text className="text-white text-base font-bold">
            {mutation.isPending ? 'Submitting…' : 'Submit Feedback'}
          </Text>
        </TouchableOpacity>

        <Text className="text-gray-900 text-lg font-bold mb-4">Past Feedback</Text>

        {isLoading && [1, 2].map((i) => (
          <View key={i} className="bg-gray-50 border border-gray-200 rounded-2xl mb-2.5" style={{ height: 80 }} />
        ))}

        {isError && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-6 items-center">
            <Text className="text-gray-700 text-sm mb-3">Could not load feedback history</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-2xl px-6 py-2.5">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <View className="items-center py-4">
            <View className="w-16 h-16 rounded-full bg-primary-50 items-center justify-center mb-3">
              <Ionicons name="chatbubble-ellipses" size={28} color="#821A52" />
            </View>
            <Text className="text-gray-400 text-sm">No feedback submitted yet</Text>
          </View>
        )}

        {data?.map((item: FeedbackItem) => {
          const statusMeta = STATUS_META[item.status] ?? STATUS_META.RECEIVED;
          return (
            <View key={item.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 mb-2.5">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-gray-500 text-xs font-semibold">{item.category.toUpperCase()}</Text>
                <View className="rounded-lg px-2 py-1" style={{ backgroundColor: statusMeta.bg }}>
                  <Text className="text-[11px] font-bold" style={{ color: statusMeta.color }}>{statusMeta.label}</Text>
                </View>
              </View>
              <Text className="text-gray-900 text-[15px] font-semibold mb-1" numberOfLines={1}>{item.subject}</Text>
              <Text className="text-gray-400 text-xs">
                {new Date(item.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
