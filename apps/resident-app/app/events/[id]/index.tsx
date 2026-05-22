import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';

const CATEGORY_COLORS: Record<string, string> = {
  CULTURAL: 'bg-purple-100 text-purple-700',
  SPORTS: 'bg-green-100 text-green-700',
  MEETING: 'bg-blue-100 text-blue-700',
  CELEBRATION: 'bg-amber-100 text-amber-700',
  WORKSHOP: 'bg-teal-100 text-teal-700',
  OTHER: 'bg-gray-100 text-gray-600',
};

type EventRegistration = { status: 'REGISTERED' | 'WAITLISTED' };

type ResidentEvent = {
  id: string;
  title: string;
  description?: string;
  category: string;
  eventDate: string;
  eventTime?: string;
  venue?: string;
  capacity?: number;
  registrationCount?: number;
  myRegistration?: EventRegistration | null;
};

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: event, isLoading } = useQuery<ResidentEvent>({
    queryKey: ['event', id],
    queryFn: () => api.get<ResidentEvent>(`/events/${id}`),
    enabled: !!id,
  });

  const registerMutation = useMutation<void, Error>({
    mutationFn: () => api.post<void>(`/events/${id}/register`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', id] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const cancelMutation = useMutation<void, Error>({
    mutationFn: () => api.patch<void>(`/events/${id}/cancel-registration`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', id] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  if (isLoading || !event) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#3B3FBF" />
      </SafeAreaView>
    );
  }

  const colorClass = CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.OTHER;
  const registered = event.myRegistration?.status === 'REGISTERED';
  const waitlisted = event.myRegistration?.status === 'WAITLISTED';
  const full =
    !!event.capacity &&
    (event.registrationCount ?? 0) >= event.capacity &&
    !registered &&
    !waitlisted;
  const eventDate = new Date(event.eventDate);
  const isPast = eventDate < new Date();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="bg-primary-500 px-6 pt-4 pb-8">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-white/80 text-base">← Back</Text>
          </TouchableOpacity>
          <View className={`self-start rounded-full px-3 py-0.5 mb-3 ${colorClass.split(' ')[0]}`}>
            <Text className={`text-xs font-semibold ${colorClass.split(' ')[1]}`}>{event.category}</Text>
          </View>
          <Text className="text-white text-2xl font-bold leading-snug">{event.title}</Text>
        </View>

        <View className="px-6 -mt-4">
          <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <View className="flex-row flex-wrap gap-4">
              <View>
                <Text className="text-xs text-gray-400 mb-0.5">Date</Text>
                <Text className="text-sm font-medium text-gray-800">
                  {eventDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </View>
              {event.eventTime && (
                <View>
                  <Text className="text-xs text-gray-400 mb-0.5">Time</Text>
                  <Text className="text-sm font-medium text-gray-800">{event.eventTime}</Text>
                </View>
              )}
              {event.venue && (
                <View>
                  <Text className="text-xs text-gray-400 mb-0.5">Venue</Text>
                  <Text className="text-sm font-medium text-gray-800">{event.venue}</Text>
                </View>
              )}
              {event.capacity && (
                <View>
                  <Text className="text-xs text-gray-400 mb-0.5">Capacity</Text>
                  <Text className="text-sm font-medium text-gray-800">
                    {event.registrationCount ?? 0} / {event.capacity} registered
                  </Text>
                </View>
              )}
            </View>
          </View>

          {event.capacity && (
            <View className="mb-4">
              <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <View
                  className="h-full bg-primary-400 rounded-full"
                  style={{ width: `${Math.min(100, ((event.registrationCount ?? 0) / event.capacity) * 100)}%` }}
                />
              </View>
            </View>
          )}

          {event.description && (
            <View className="bg-gray-50 rounded-2xl p-5 mb-4">
              <Text className="text-xs text-gray-400 uppercase tracking-wide mb-2">About</Text>
              <Text className="text-gray-700 leading-6">{event.description}</Text>
            </View>
          )}

          {!isPast && (
            <View className="gap-3">
              {registered && (
                <>
                  <View className="bg-green-50 border border-green-200 rounded-2xl py-4 items-center">
                    <Text className="text-green-700 font-semibold">You're registered ✓</Text>
                  </View>
                  <TouchableOpacity
                    className="border border-gray-200 rounded-2xl py-3.5 items-center"
                    onPress={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                  >
                    <Text className="text-gray-500 font-medium">Cancel Registration</Text>
                  </TouchableOpacity>
                </>
              )}
              {waitlisted && (
                <View className="bg-amber-50 border border-amber-200 rounded-2xl py-4 items-center">
                  <Text className="text-amber-700 font-semibold">You're on the waitlist</Text>
                </View>
              )}
              {!registered && !waitlisted && (
                <TouchableOpacity
                  className={`rounded-2xl py-4 items-center ${full ? 'bg-gray-100' : 'bg-primary-500'}`}
                  onPress={() => registerMutation.mutate()}
                  disabled={full || registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className={`font-semibold text-base ${full ? 'text-gray-400' : 'text-white'}`}>
                      {full ? 'Event Full' : 'Register'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {isPast && registered && (
            <TouchableOpacity
              className="bg-primary-500 rounded-2xl py-4 items-center mt-2"
              onPress={() => router.push(`/events/${id}/feedback` as any)}
            >
              <Text className="text-white font-semibold text-base">Give Feedback</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
