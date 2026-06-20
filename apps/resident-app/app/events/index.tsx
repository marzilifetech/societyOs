import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

const CATEGORY_COLORS: Record<string, string> = {
  CULTURAL: 'bg-purple-100 text-purple-700',
  SPORTS: 'bg-green-100 text-green-700',
  MEETING: 'bg-blue-100 text-blue-700',
  CELEBRATION: 'bg-amber-100 text-amber-700',
  WORKSHOP: 'bg-teal-100 text-teal-700',
  OTHER: 'bg-gray-100 text-gray-600',
};

type EventRegistration = {
  status: 'REGISTERED' | 'WAITLISTED';
};

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

export default function EventsScreen() {
  const qc = useQueryClient();

  const { data: events, isLoading, isError, refetch } = useQuery<ResidentEvent[]>({
    queryKey: ['events'],
    queryFn: () => api.get<ResidentEvent[]>('/events'),
  });

  const registerMutation = useMutation<void, Error, string>({
    mutationFn: (eventId: string) => api.post<void>(`/events/${eventId}/register`, {}),
    onSuccess: (_data: void, eventId: string) => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', eventId] });
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const cancelMutation = useMutation<void, Error, string>({
    mutationFn: (eventId: string) => api.patch<void>(`/events/${eventId}/cancel-registration`, {}),
    onSuccess: (_data: void, eventId: string) => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', eventId] });
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary-500 text-base mb-4">← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 mb-6">Events</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3B3FBF" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">⚠️</Text>
          <Text className="text-gray-900 text-lg font-semibold mb-2 text-center">Failed to load events</Text>
          <TouchableOpacity className="bg-primary-500 rounded-2xl px-6 py-3 mt-2" onPress={() => refetch()}>
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !events?.length ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">🎉</Text>
          <Text className="text-gray-500 text-center">No upcoming events</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e: ResidentEvent) => e.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View className="h-4" />}
          renderItem={({ item }: { item: ResidentEvent }) => {
            const colorClass = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.OTHER;
            const registered = item.myRegistration?.status === 'REGISTERED';
            const waitlisted = item.myRegistration?.status === 'WAITLISTED';
            const full =
              !!item.capacity &&
              (item.registrationCount ?? 0) >= item.capacity &&
              !registered &&
              !waitlisted;
            const eventDate = new Date(item.eventDate);
            const isPast = eventDate < new Date();

            return (
              <View className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                {/* Header band */}
                <View className="bg-primary-500 px-5 pt-5 pb-4">
                  <View className={`self-start rounded-full px-3 py-0.5 mb-2 ${colorClass.split(' ')[0]}`}>
                    <Text className={`text-xs font-semibold ${colorClass.split(' ')[1]}`}>{item.category}</Text>
                  </View>
                  <Text className="text-white text-lg font-bold leading-snug">{item.title}</Text>
                </View>

                <View className="px-5 py-4">
                  {item.description && (
                    <Text className="text-sm text-gray-600 mb-3 leading-5" numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}

                  <View className="flex-row gap-5 mb-4">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-gray-400 text-xs">📅</Text>
                      <Text className="text-xs text-gray-600">
                        {eventDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    {item.eventTime && (
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-gray-400 text-xs">🕐</Text>
                        <Text className="text-xs text-gray-600">{item.eventTime}</Text>
                      </View>
                    )}
                    {item.venue && (
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-gray-400 text-xs">📍</Text>
                        <Text className="text-xs text-gray-600">{item.venue}</Text>
                      </View>
                    )}
                  </View>

                  {item.capacity && (
                    <View className="mb-3">
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-xs text-gray-400">Registrations</Text>
                        <Text className="text-xs text-gray-600">
                          {item.registrationCount ?? 0} / {item.capacity}
                        </Text>
                      </View>
                      <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <View
                          className="h-full bg-primary-400 rounded-full"
                          style={{ width: `${Math.min(100, ((item.registrationCount ?? 0) / item.capacity) * 100)}%` }}
                        />
                      </View>
                    </View>
                  )}

                  {!isPast && (
                    <>
                      {registered && (
                        <View className="flex-row items-center justify-between">
                          <View className="bg-green-100 rounded-xl px-3 py-2 flex-1 mr-3">
                            <Text className="text-green-700 text-sm font-medium text-center">Registered ✓</Text>
                          </View>
                          <TouchableOpacity
                            className="border border-gray-200 rounded-xl px-3 py-2"
                            onPress={() => cancelMutation.mutate(item.id)}
                            disabled={cancelMutation.isPending}
                          >
                            <Text className="text-gray-500 text-sm">Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {waitlisted && (
                        <View className="bg-amber-50 rounded-xl px-3 py-2">
                          <Text className="text-amber-700 text-sm font-medium text-center">On Waitlist</Text>
                        </View>
                      )}
                      {!registered && !waitlisted && (
                        <TouchableOpacity
                          className={`rounded-2xl py-3 items-center ${full ? 'bg-gray-100' : 'bg-primary-500'}`}
                          onPress={() => registerMutation.mutate(item.id)}
                          disabled={full || registerMutation.isPending}
                        >
                          <Text className={`font-semibold text-sm ${full ? 'text-gray-400' : 'text-white'}`}>
                            {full ? 'Event Full' : 'Register'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
