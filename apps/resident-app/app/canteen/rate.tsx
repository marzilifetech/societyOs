import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

export default function RateDishScreen() {
  const { dishId } = useLocalSearchParams<{ dishId: string }>();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/canteen/dishes/${dishId}/rate`, { rating, comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dish', dishId] });
      setSubmitted(true);
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  if (submitted) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8 bg-white">
        <View className="w-24 h-24 rounded-full bg-amber-100 items-center justify-center mb-6">
          <Ionicons name="star" size={56} color="#F59E0B" />
        </View>
        <Text className="text-2xl font-bold text-gray-900 mb-3 text-center">Thanks for Rating!</Text>
        <Text className="text-base text-gray-500 text-center mb-8">Your feedback helps improve the canteen menu.</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-primary-500 rounded-2xl py-4 px-10">
          <Text className="text-white font-bold text-base">Done</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Rate Dish</Text>
      </View>

      <View className="px-6 pt-6">
        <Text className="text-base text-gray-500 mb-6 text-center">How would you rate this dish?</Text>

        {/* Star selector */}
        <View className="flex-row justify-center gap-3 mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setRating(s)}
              className="items-center justify-center"
              style={{ minWidth: 56, minHeight: 56 }}
              accessibilityRole="button"
              accessibilityLabel={`${s} star${s > 1 ? 's' : ''}`}
            >
              <Ionicons
                name={s <= rating ? 'star' : 'star-outline'}
                size={44}
                color={s <= rating ? '#F59E0B' : '#D1D5DB'}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View className="bg-gray-100 rounded-2xl p-4 mb-6">
          <View className="flex-row items-center gap-1.5 mb-2">
            <Ionicons name="create-outline" size={14} color="#6B7280" />
            <Text className="text-sm text-gray-500">Your review (optional)</Text>
          </View>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Share your experience..."
            placeholderTextColor="#9CA3AF"
            className="text-gray-900"
            style={{ fontSize: 15, minHeight: 100, textAlignVertical: 'top' }}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          onPress={() => mutation.mutate()}
          disabled={rating === 0 || mutation.isPending}
          className={`rounded-2xl py-4 items-center justify-center flex-row gap-2 ${rating === 0 ? 'bg-gray-200' : 'bg-primary-500'}`}
          accessibilityRole="button"
          accessibilityLabel="Submit rating"
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={rating === 0 ? '#9CA3AF' : '#FFFFFF'} />
              <Text className={`font-bold text-base ${rating === 0 ? 'text-gray-400' : 'text-white'}`}>
                Submit Rating
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
