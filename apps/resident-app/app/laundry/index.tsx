import { useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { ErrorCard } from '../../src/components/ErrorCard';
import { DateField } from '../../src/components/common/DateField';

type Slot = string;
type LaundryBooking = {
  id: string; date: string; timeSlot: string; type: string; status: string; createdAt: string;
};

const TYPE_OPTIONS = ['WASH', 'DRY', 'WASH_AND_DRY', 'IRON'] as const;
const TYPE_LABELS: Record<string, string> = {
  WASH: 'Wash', DRY: 'Dry', WASH_AND_DRY: 'Wash & Dry', IRON: 'Iron',
};
const STATUS_META: Record<string, { bgClass: string; textClass: string; label: string }> = {
  PENDING:   { bgClass: 'bg-amber-100', textClass: 'text-amber-700', label: 'Pending' },
  CONFIRMED: { bgClass: 'bg-blue-100', textClass: 'text-blue-700', label: 'Confirmed' },
  COMPLETED: { bgClass: 'bg-green-100', textClass: 'text-green-700', label: 'Completed' },
  CANCELLED: { bgClass: 'bg-red-100', textClass: 'text-red-700', label: 'Cancelled' },
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function LaundryScreen() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const [type, setType] = useState<string>('WASH_AND_DRY');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showBook, setShowBook] = useState(false);

  const { data: slots, isLoading: slotsLoading, isError: slotsError, refetch: refetchSlots } = useQuery<Slot[]>({
    queryKey: ['laundry-slots', date],
    queryFn: () => api.get<Slot[]>(`/laundry/slots?date=${date}`),
    enabled: !!date,
  });

  const { data: bookings, isLoading: bookingsLoading, isError: bookingsError, refetch: refetchBookings } = useQuery<LaundryBooking[]>({
    queryKey: ['laundry-bookings'],
    queryFn: () => api.get<LaundryBooking[]>('/laundry/bookings/my'),
  });

  const bookMutation = useMutation({
    mutationFn: () => api.post('/laundry/bookings', { date, timeSlot: selectedSlot, type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['laundry-bookings'] });
      qc.invalidateQueries({ queryKey: ['laundry-slots', date] });
      setShowBook(false);
      setSelectedSlot(null);
      Alert.alert('Booked', `Your laundry slot on ${date} at ${selectedSlot} has been booked.`);
    },
    onError: (e: any) => {
      Alert.alert(
        'Could not book slot',
        e?.message ?? 'Something went wrong. Please try again or contact the society office.',
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/laundry/bookings/${id}/cancel`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['laundry-bookings'] });
      Alert.alert('Cancelled', 'Your laundry booking has been cancelled.');
    },
    onError: (e: any) => {
      Alert.alert('Could not cancel', e?.message ?? 'Please try again or contact the society office.');
    },
  });

  const handleCancel = (id: string) => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate(id) },
    ]);
  };

  const activeBookings = (bookings ?? []).filter((b: any) => ['PENDING', 'CONFIRMED'].includes(b.status));
  const pastBookings = (bookings ?? []).filter((b: any) => ['COMPLETED', 'CANCELLED'].includes(b.status));

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 min-h-[44px] min-w-[44px] justify-center">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-gray-900 text-2xl font-bold">Laundry</Text>
          <Text className="text-gray-500 text-sm">Book a laundry time slot</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowBook(!showBook)}
          className="bg-primary-500 rounded-xl px-3.5 py-2.5 min-h-[44px] justify-center"
        >
          <Text className="text-white text-sm font-semibold">{showBook ? 'Close' : 'Book Slot'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={bookingsLoading} onRefresh={refetchBookings} tintColor="#821A52" />}
      >
        {showBook && (
          <View className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-5">
            <View className="flex-row items-center mb-3">
              <View className="w-9 h-9 rounded-lg bg-primary-50 items-center justify-center mr-2.5">
                <Ionicons name="shirt" size={18} color="#821A52" />
              </View>
              <Text className="text-gray-900 text-base font-semibold">New Booking</Text>
            </View>

            <View className="mb-3.5">
              <DateField label="Date" value={date} onChange={(iso) => setDate(iso.slice(0, 10))} mode="date" minimumDate={new Date()} />
            </View>

            <Text className="text-gray-500 text-xs font-semibold mb-2">SERVICE TYPE</Text>
            <View className="flex-row flex-wrap gap-2 mb-3.5">
              {TYPE_OPTIONS.map((t: any) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setType(t)}
                  className={`px-3 py-2 rounded-xl min-h-[36px] border ${type === t ? 'bg-primary-500 border-primary-500' : 'bg-gray-100 border-gray-200'}`}
                >
                  <Text className={`text-sm ${type === t ? 'text-white font-semibold' : 'text-gray-700'}`}>{TYPE_LABELS[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-gray-500 text-xs font-semibold mb-2">AVAILABLE SLOTS</Text>
            {slotsLoading ? (
              <ActivityIndicator color="#821A52" style={{ marginVertical: 12 }} />
            ) : slotsError ? (
              <ErrorCard
                onRetry={refetchSlots}
                message="Available slots couldn't be loaded. Please try again."
              />
            ) : !slots?.length ? (
              <Text className="text-gray-400 text-sm my-2">
                No slots available for this date. Please try a different date.
              </Text>
            ) : (
              <View className="flex-row flex-wrap gap-2 mb-3.5">
                {slots.map((slot: any) => (
                  <TouchableOpacity
                    key={slot}
                    onPress={() => setSelectedSlot(slot)}
                    className={`px-3.5 py-2.5 rounded-xl min-h-[44px] justify-center border ${selectedSlot === slot ? 'bg-primary-500 border-primary-500' : 'bg-gray-100 border-gray-200'}`}
                  >
                    <Text className={`text-sm ${selectedSlot === slot ? 'text-white font-semibold' : 'text-gray-700'}`}>{slot}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              onPress={() => {
                if (!selectedSlot) { Alert.alert('Select a slot', 'Please choose a time slot first.'); return; }
                bookMutation.mutate();
              }}
              disabled={bookMutation.isPending}
              className={`rounded-2xl py-3.5 items-center min-h-[52px] justify-center ${bookMutation.isPending ? 'bg-primary-500/60' : 'bg-primary-500'}`}
            >
              {bookMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text className="text-white text-base font-semibold">Confirm Booking</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {bookingsError ? (
          <ErrorCard onRetry={refetchBookings} message="Your bookings couldn't be loaded. Please try again." />
        ) : (
          <>
            <Text className="text-gray-500 text-xs font-semibold mb-2.5">UPCOMING</Text>
            {bookingsLoading ? (
              <ActivityIndicator color="#821A52" style={{ marginVertical: 16 }} />
            ) : activeBookings.length === 0 ? (
              <View className="items-center mt-6 px-6">
                <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                  <Ionicons name="shirt" size={32} color="#821A52" />
                </View>
                <Text className="text-gray-900 font-semibold text-base">No upcoming bookings</Text>
                <Text className="text-gray-400 text-sm text-center mt-1">Tap "Book Slot" to schedule laundry.</Text>
              </View>
            ) : activeBookings.map((b: any) => {
              const meta = STATUS_META[b.status] ?? STATUS_META.PENDING;
              return (
                <View key={b.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-3.5 mb-2.5">
                  <View className="flex-row justify-between items-center mb-1.5">
                    <View className="flex-row items-center flex-1">
                      <Ionicons name="time" size={16} color="#9CA3AF" />
                      <Text className="text-gray-900 text-sm font-semibold ml-1.5">
                        {b.date} at {b.timeSlot}
                      </Text>
                    </View>
                    <View className={`${meta.bgClass} px-2.5 py-1 rounded-lg`}>
                      <Text className={`${meta.textClass} text-xs font-semibold`}>{meta.label}</Text>
                    </View>
                  </View>
                  <Text className="text-gray-500 text-sm mb-2">
                    {TYPE_LABELS[b.type] ?? b.type}
                  </Text>
                  {b.status === 'PENDING' && (
                    <TouchableOpacity
                      onPress={() => handleCancel(b.id)}
                      className="self-start px-3 py-2 rounded-lg border border-red-200 min-h-[36px]"
                    >
                      <Text className="text-red-600 text-sm">Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            <Text className="text-gray-500 text-xs font-semibold mt-3 mb-2.5">PAST BOOKINGS</Text>
            {pastBookings.length === 0 ? (
              <Text className="text-gray-400 text-sm">No past bookings.</Text>
            ) : pastBookings.slice(0, 10).map((b: any) => {
              const meta = STATUS_META[b.status] ?? STATUS_META.PENDING;
              return (
                <View key={b.id} className="bg-gray-50 rounded-xl border border-gray-200 p-3 mb-2">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-gray-500 text-sm flex-1 mr-2">
                      {b.date} at {b.timeSlot} — {TYPE_LABELS[b.type] ?? b.type}
                    </Text>
                    <View className={`${meta.bgClass} px-2 py-0.5 rounded`}>
                      <Text className={`${meta.textClass} text-xs font-semibold`}>{meta.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
