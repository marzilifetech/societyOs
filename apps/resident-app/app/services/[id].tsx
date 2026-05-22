import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import { STATUS_STEPS, STATUS_META, canRate, canConfirmOrDispute } from '../../src/lib/serviceStatus';
import { useServiceRequest } from '../../src/hooks/useServiceRequest';
import { StatusBadge } from '../../src/components/common/StatusBadge';

export default function ServiceDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rating, setRating] = useState(0);
  const [ratingNote, setRatingNote] = useState('');
  const [showRating, setShowRating] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const { data: sr, isLoading } = useQuery({
    queryKey: ['service-request', id],
    queryFn: () => api.get<any>(`/service-requests/${id}`),
  });

  const { confirm: confirmMutation, dispute: disputeMutation, rate: rateMutation } = useServiceRequest(id, {
    disputeReason,
    rating,
    ratingNote,
    onDisputed: () => { setShowDispute(false); setDisputeReason(''); },
    onRated: () => setShowRating(false),
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3B3FBF" />
      </SafeAreaView>
    );
  }

  if (!sr) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">Request not found</Text>
      </SafeAreaView>
    );
  }

  const currentStep = STATUS_STEPS.indexOf(sr.status);
  const showRate = canRate(sr.status, !!sr.rating);
  const showConfirmOrDispute = canConfirmOrDispute(sr.status, !!sr.confirmedAt);
  // Standalone "dispute resolution" link — visible whenever the SR is COMPLETED
  // (or CLOSED) within the last 7 days. Lets residents revisit the dispute flow
  // even after they've confirmed completion.
  const completedAt = sr.completedAt ? new Date(sr.completedAt) : null;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const showDisputeLink =
    sr.status === 'COMPLETED' && completedAt && completedAt.getTime() >= sevenDaysAgo && !showConfirmOrDispute;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-4 pb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text className="text-primary-500 mb-4" style={{ fontSize: t.fontBase }}>← Back</Text>
          </TouchableOpacity>
          <View className="flex-row items-start justify-between mb-6">
            <View className="flex-1">
              <Text className="font-bold text-gray-900" style={{ fontSize: t.font2xl }}>{sr.category}</Text>
              <Text className="text-gray-400 mt-1" style={{ fontSize: t.fontXs }}>#{sr.id.slice(0, 8).toUpperCase()}</Text>
            </View>
            <StatusBadge status={sr.status} config={STATUS_META} />
          </View>
        </View>

        {/* Progress tracker */}
        {!['REJECTED', 'CLOSED'].includes(sr.status) && (
          <View className="px-6 mb-6">
            <View className="flex-row items-center">
              {STATUS_STEPS.map((step, i) => {
                const done = i <= currentStep;
                return (
                  <View key={step} className="flex-1 flex-row items-center">
                    <View
                      className={`w-7 h-7 rounded-full items-center justify-center ${done ? 'bg-primary-500' : 'bg-gray-200'}`}
                    >
                      {done && <Text className="text-white text-xs font-bold">✓</Text>}
                    </View>
                    {i < STATUS_STEPS.length - 1 && (
                      <View className={`flex-1 h-1 ${i < currentStep ? 'bg-primary-500' : 'bg-gray-200'}`} />
                    )}
                  </View>
                );
              })}
            </View>
            <View className="flex-row justify-between mt-2">
              {STATUS_STEPS.map((step) => (
                <Text key={step} className="text-gray-400 flex-1 text-center" style={{ fontSize: t.fontXs }}>
                  {STATUS_META[step].label}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Details */}
        <View className="px-6 mb-6">
          <View className="bg-gray-50 rounded-2xl p-5 gap-4">
            <View>
              <Text className="text-gray-500 mb-1" style={{ fontSize: t.fontXs }}>Description</Text>
              <Text className="text-gray-900" style={{ fontSize: t.fontBase, lineHeight: t.fontBase * t.lineHeight }}>{sr.description}</Text>
            </View>
            {sr.preferredTime && (
              <View>
                <Text className="text-gray-500 mb-1" style={{ fontSize: t.fontXs }}>Preferred Time</Text>
                <Text className="text-gray-900" style={{ fontSize: t.fontBase }}>{sr.preferredTime}</Text>
              </View>
            )}
            {sr.scheduledTime && (
              <View>
                <Text className="text-gray-500 mb-1" style={{ fontSize: t.fontXs }}>Scheduled Arrival</Text>
                <Text className="font-medium text-primary-600" style={{ fontSize: t.fontBase }}>
                  {new Date(sr.scheduledTime).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
            {sr.assignedTo && (
              <View>
                <Text className="text-gray-500 mb-1" style={{ fontSize: t.fontXs }}>Assigned To</Text>
                <Text className="font-medium text-gray-900" style={{ fontSize: t.fontBase }}>
                  {sr.assignedTo.user?.name ?? sr.assignedTo.name ?? 'Society staff'}
                </Text>
              </View>
            )}
            {sr.disputeReason && (
              <View>
                <Text className="text-gray-500 mb-1" style={{ fontSize: t.fontXs }}>Dispute Reason</Text>
                <Text className="text-red-600 italic" style={{ fontSize: t.fontBase }}>{sr.disputeReason}</Text>
              </View>
            )}
            <View>
              <Text className="text-gray-500 mb-1" style={{ fontSize: t.fontXs }}>Submitted</Text>
              <Text className="text-gray-900" style={{ fontSize: t.fontBase }}>
                {new Date(sr.createdAt).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
            {sr.adminNote && (
              <View>
                <Text className="text-gray-500 mb-1" style={{ fontSize: t.fontXs }}>Note from Management</Text>
                <Text className="text-gray-700 italic" style={{ fontSize: t.fontBase }}>{sr.adminNote}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Confirm or Dispute */}
        {showConfirmOrDispute && (
          <View className="px-6 mb-6">
            <View className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <Text className="font-semibold text-amber-900 mb-1" style={{ fontSize: t.fontBase }}>Work Completed — Your Action Needed</Text>
              <Text className="text-amber-700 mb-4" style={{ fontSize: t.fontSm }}>Staff has marked this as done. Please confirm or raise a dispute.</Text>
              {!showDispute ? (
                <View className="gap-3">
                  <TouchableOpacity
                    className="bg-green-500 rounded-xl py-3.5 items-center"
                    onPress={() => confirmMutation.mutate()}
                    disabled={confirmMutation.isPending}
                    style={{ minHeight: t.touchTarget }}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm work is done"
                  >
                    {confirmMutation.isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-semibold" style={{ fontSize: t.fontBase }}>Confirm Completion</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-white border border-red-300 rounded-xl py-3.5 items-center"
                    onPress={() => setShowDispute(true)}
                    style={{ minHeight: t.touchTarget }}
                    accessibilityRole="button"
                    accessibilityLabel="Raise a dispute"
                  >
                    <Text className="text-red-600 font-semibold" style={{ fontSize: t.fontBase }}>Raise Dispute</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Text className="font-medium text-gray-700 mb-1.5" style={{ fontSize: t.fontSm }}>Reason for dispute *</Text>
                  <TextInput
                    className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-3 min-h-[80px]"
                    style={{ fontSize: t.fontBase }}
                    value={disputeReason}
                    onChangeText={setDisputeReason}
                    placeholder="Describe the issue with the completed work..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    textAlignVertical="top"
                  />
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      className="flex-1 bg-gray-100 rounded-xl py-3.5 items-center"
                      onPress={() => { setShowDispute(false); setDisputeReason(''); }}
                      style={{ minHeight: t.touchTarget }}
                    >
                      <Text className="text-gray-600 font-medium" style={{ fontSize: t.fontBase }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 rounded-xl py-3.5 items-center ${disputeReason.trim().length > 5 ? 'bg-red-500' : 'bg-gray-200'}`}
                      onPress={() => disputeMutation.mutate()}
                      disabled={disputeReason.trim().length <= 5 || disputeMutation.isPending}
                      style={{ minHeight: t.touchTarget }}
                    >
                      {disputeMutation.isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className={`font-semibold ${disputeReason.trim().length > 5 ? 'text-white' : 'text-gray-400'}`} style={{ fontSize: t.fontBase }}>Submit</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Existing rating */}
        {sr.rating && (
          <View className="px-6 mb-6">
            <View className="bg-green-50 rounded-2xl p-5">
              <Text className="font-medium text-gray-700 mb-2" style={{ fontSize: t.fontSm }}>Your Rating</Text>
              <Text className="text-2xl mb-1">{'★'.repeat(sr.rating)}{'☆'.repeat(5 - sr.rating)}</Text>
              {sr.ratingNote && <Text className="text-gray-600 italic" style={{ fontSize: t.fontSm }}>{sr.ratingNote}</Text>}
            </View>
          </View>
        )}

        {/* Dispute resolution link (within 7 days of completion) */}
        {showDisputeLink && (
          <View className="px-6 mb-6">
            {!showDispute ? (
              <TouchableOpacity
                onPress={() => setShowDispute(true)}
                className="bg-white border border-red-200 rounded-2xl py-4 items-center flex-row justify-center gap-2"
                style={{ minHeight: t.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel="Open dispute resolution"
              >
                <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                <Text className="text-red-600 font-semibold" style={{ fontSize: t.fontBase }}>
                  Dispute resolution
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="bg-gray-50 rounded-2xl p-5">
                <Text className="font-medium text-gray-700 mb-1.5" style={{ fontSize: t.fontSm }}>Reason for dispute *</Text>
                <TextInput
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-3 min-h-[80px]"
                  style={{ fontSize: t.fontBase }}
                  value={disputeReason}
                  onChangeText={setDisputeReason}
                  placeholder="Describe the issue with the completed work..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  textAlignVertical="top"
                />
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className="flex-1 bg-gray-100 rounded-xl py-3.5 items-center"
                    onPress={() => { setShowDispute(false); setDisputeReason(''); }}
                    style={{ minHeight: t.touchTarget }}
                  >
                    <Text className="text-gray-600 font-medium" style={{ fontSize: t.fontBase }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 rounded-xl py-3.5 items-center ${disputeReason.trim().length > 5 ? 'bg-red-500' : 'bg-gray-200'}`}
                    onPress={() => disputeMutation.mutate()}
                    disabled={disputeReason.trim().length <= 5 || disputeMutation.isPending}
                    style={{ minHeight: t.touchTarget }}
                  >
                    {disputeMutation.isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className={`font-semibold ${disputeReason.trim().length > 5 ? 'text-white' : 'text-gray-400'}`} style={{ fontSize: t.fontBase }}>Submit</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Rate now */}
        {showRate && (
          <View className="px-6 mb-8">
            {!showRating ? (
              <TouchableOpacity
                className="bg-primary-500 rounded-2xl py-4 items-center"
                onPress={() => setShowRating(true)}
                style={{ minHeight: t.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel="Rate and review this service"
              >
                <Text className="text-white font-semibold" style={{ fontSize: t.fontBase }}>Rate This Service</Text>
              </TouchableOpacity>
            ) : (
              <View className="bg-gray-50 rounded-2xl p-5">
                <Text className="font-medium text-gray-700 mb-3" style={{ fontSize: t.fontSm }}>How was the service?</Text>
                <View className="flex-row gap-3 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setRating(star)}
                      accessibilityRole="button"
                      accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`}
                    >
                      <Text className={`text-3xl ${star <= rating ? 'opacity-100' : 'opacity-30'}`}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-4"
                  style={{ fontSize: t.fontBase }}
                  value={ratingNote}
                  onChangeText={setRatingNote}
                  placeholder="Add a comment (optional)"
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity
                  className={`rounded-2xl py-4 items-center ${rating > 0 ? 'bg-primary-500' : 'bg-gray-200'}`}
                  onPress={() => rateMutation.mutate()}
                  disabled={rating === 0 || rateMutation.isPending}
                  style={{ minHeight: t.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel="Submit rating"
                >
                  {rateMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className={`font-semibold ${rating > 0 ? 'text-white' : 'text-gray-400'}`} style={{ fontSize: t.fontBase }}>
                      Submit Rating
                    </Text>
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
