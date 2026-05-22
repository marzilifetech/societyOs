import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';

const STATUS_STEPS = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED'];
const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Raised',
  UNDER_REVIEW: 'Under Review',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
};

export default function ComplaintDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');

  const { data: complaint, isLoading } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => api.get<any>(`/complaints/${id}`),
  });

  const rateMutation = useMutation({
    mutationFn: () => api.post(`/complaints/${id}/rate`, { rating, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaint', id] });
      qc.invalidateQueries({ queryKey: ['my-complaints'] });
      Alert.alert('Thank you', 'Your feedback has been saved.');
    },
    onError: (err: any) => Alert.alert('Error', err.message ?? 'Could not save your feedback'),
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#821A52" />
      </SafeAreaView>
    );
  }

  if (!complaint) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
          <Ionicons name="alert-circle" size={32} color="#821A52" />
        </View>
        <Text className="text-gray-500">Complaint not found</Text>
      </SafeAreaView>
    );
  }

  const currentStep = STATUS_STEPS.indexOf(complaint.status);
  const canRate = ['RESOLVED', 'CLOSED'].includes(complaint.status) && !complaint.rating;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-4 pb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="flex-row items-center -ml-1"
          >
            <Ionicons name="chevron-back" size={24} color="#821A52" />
            <Text className="text-primary-500" style={{ fontSize: t.fontBase }}>Back</Text>
          </TouchableOpacity>

          <Text className="mt-5 font-bold text-gray-900" style={{ fontSize: t.font2xl }}>{complaint.title}</Text>
          <Text className="mt-1 text-gray-500" style={{ fontSize: t.fontSm }}>{complaint.category}</Text>
        </View>

        {!['REJECTED'].includes(complaint.status) && (
          <View className="px-6">
            <View className="flex-row items-center">
              {STATUS_STEPS.map((step, index) => {
                const complete = index <= currentStep;
                return (
                  <View key={step} className="flex-1 flex-row items-center">
                    <View className={`h-8 w-8 items-center justify-center rounded-full ${complete ? 'bg-primary-500' : 'bg-gray-200'}`}>
                      {complete ? (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      ) : (
                        <Text className="text-xs font-semibold text-gray-500">
                          {index + 1}
                        </Text>
                      )}
                    </View>
                    {index < STATUS_STEPS.length - 1 ? (
                      <View className={`h-1 flex-1 ${index < currentStep ? 'bg-primary-500' : 'bg-gray-200'}`} />
                    ) : null}
                  </View>
                );
              })}
            </View>
            <View className="mt-2 flex-row justify-between">
              {STATUS_STEPS.map((step) => (
                <Text key={step} className="flex-1 text-center text-gray-400" style={{ fontSize: t.fontXs }}>
                  {STATUS_LABELS[step]}
                </Text>
              ))}
            </View>
          </View>
        )}

        <View className="mx-6 mt-6 rounded-2xl bg-gray-50 border border-gray-200 p-5">
          <Text className="font-semibold uppercase tracking-wide text-gray-500" style={{ fontSize: t.fontSm }}>Details</Text>
          <Text className="mt-3 text-gray-700" style={{ fontSize: t.fontBase, lineHeight: t.fontBase * t.lineHeight }}>{complaint.description}</Text>
          <Text className="mt-4 font-bold text-gray-900" style={{ fontSize: t.fontBase }}>
            Status: {STATUS_LABELS[complaint.status] ?? complaint.status}
          </Text>
          <Text className="mt-2 text-gray-500" style={{ fontSize: t.fontSm }}>
            Filed on {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          {complaint.adminNote ? (
            <View className="mt-4 rounded-xl bg-white border border-gray-200 p-4">
              <Text className="font-semibold text-gray-700" style={{ fontSize: t.fontSm }}>Society Note</Text>
              <Text className="mt-2 text-gray-600" style={{ fontSize: t.fontSm, lineHeight: t.fontSm * t.lineHeight }}>{complaint.adminNote}</Text>
            </View>
          ) : null}
        </View>

        {complaint.rating ? (
          <View className="mx-6 mt-6 rounded-2xl bg-green-50 border border-green-100 p-5">
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle" size={18} color="#15803D" />
              <Text className="font-semibold uppercase tracking-wide text-green-700" style={{ fontSize: t.fontSm }}>Your feedback</Text>
            </View>
            <View className="mt-3 flex-row gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= complaint.rating ? 'star' : 'star-outline'}
                  size={24}
                  color="#F59E0B"
                />
              ))}
            </View>
            {complaint.ratingNote ? (
              <Text className="mt-2 text-gray-600" style={{ fontSize: t.fontSm, lineHeight: t.fontSm * t.lineHeight }}>{complaint.ratingNote}</Text>
            ) : null}
          </View>
        ) : null}

        {canRate ? (
          <View className="mx-6 mt-6 mb-8 rounded-2xl bg-gray-50 border border-gray-200 p-5">
            <Text className="font-semibold text-gray-900" style={{ fontSize: t.fontBase }}>How was the resolution?</Text>
            <View className="mt-4 flex-row gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= rating ? '#F59E0B' : '#D1D5DB'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              className="mt-4 rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-gray-900"
              style={{ fontSize: t.fontBase }}
              value={note}
              onChangeText={setNote}
              placeholder="Add a short comment (optional)"
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              className={`mt-4 rounded-2xl px-4 py-4 ${rating > 0 ? 'bg-primary-500' : 'bg-gray-200'}`}
              disabled={rating === 0 || rateMutation.isPending}
              onPress={() => rateMutation.mutate()}
              style={{ minHeight: t.touchTarget }}
              accessibilityRole="button"
              accessibilityLabel="Submit feedback"
            >
              {rateMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className={`text-center font-semibold ${rating > 0 ? 'text-white' : 'text-gray-400'}`} style={{ fontSize: t.fontBase }}>
                  Submit Feedback
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
