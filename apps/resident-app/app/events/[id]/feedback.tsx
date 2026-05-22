import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

type RatingCategory = 'overall' | 'venue' | 'organization' | 'content';

const RATING_CATEGORIES: { key: RatingCategory; label: string }[] = [
  { key: 'overall', label: 'Overall Experience' },
  { key: 'venue', label: 'Venue' },
  { key: 'organization', label: 'Organization' },
  { key: 'content', label: 'Content' },
];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View className="flex-row" style={{ gap: 8 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => onChange(star)}
          className="min-h-[48px] min-w-[48px] justify-center items-center"
        >
          <Ionicons
            name={star <= value ? 'star' : 'star-outline'}
            size={32}
            color={star <= value ? '#F59E0B' : '#D1D5DB'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function EventFeedbackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [ratings, setRatings] = useState<Record<RatingCategory, number>>({
    overall: 0,
    venue: 0,
    organization: 0,
    content: 0,
  });
  const [feedback, setFeedback] = useState('');

  const setRating = (key: RatingCategory, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const mutation = useMutation({
    mutationFn: (body: object) => api.post(`/events/${id}/feedback`, body),
    onSuccess: () => {
      Alert.alert('Thank You!', 'Your feedback has been submitted.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: () => {
      Alert.alert('Error', 'Could not submit feedback. Please try again.');
    },
  });

  const handleSubmit = () => {
    if (ratings.overall === 0) {
      Alert.alert('Required', 'Please rate the overall experience.');
      return;
    }
    mutation.mutate({ ratings, feedback: feedback.trim() || undefined });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="min-h-[52px] justify-center mr-3 flex-row items-center">
          <Ionicons name="chevron-back" size={20} color="#821A52" />
          <Text className="text-primary-500 text-base ml-1">Back</Text>
        </TouchableOpacity>
        <Text className="text-gray-900 text-2xl font-bold flex-1">Event Feedback</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}>
        <Text className="text-gray-500 text-sm mb-6">Rate your experience at this event</Text>

        {RATING_CATEGORIES.map(({ key, label }) => (
          <View
            key={key}
            className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-3"
          >
            <Text className="text-gray-900 text-base font-semibold mb-3">{label}</Text>
            <StarRating value={ratings[key]} onChange={(v) => setRating(key, v)} />
          </View>
        ))}

        <Text className="text-gray-700 text-xs font-semibold mt-3 mb-2">ADDITIONAL COMMENTS</Text>
        <TextInput
          value={feedback}
          onChangeText={setFeedback}
          placeholder="Share any thoughts or suggestions…"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={5}
          className="bg-gray-100 rounded-2xl border border-gray-200 text-gray-900 text-base p-4 mb-8"
          style={{ minHeight: 140, textAlignVertical: 'top' }}
        />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={mutation.isPending}
          className="bg-primary-500 rounded-2xl py-4 items-center min-h-[56px]"
        >
          <Text className="text-white text-base font-bold">
            {mutation.isPending ? 'Submitting…' : 'Submit Feedback'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
