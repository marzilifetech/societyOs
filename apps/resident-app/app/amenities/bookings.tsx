import { ScrollView, View, Text, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { ErrorCard } from '../../src/components/ErrorCard';
import { SkeletonPlaceholder } from '../../src/components/common/SkeletonPlaceholder';

type AmenityBooking = {
  id: string;
  amenity: { name: string };
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  totalPrice: number;
};

const STATUS_META: Record<string, { bgClass: string; textClass: string; label: string }> = {
  PENDING: { bgClass: 'bg-amber-100', textClass: 'text-amber-700', label: 'Pending' },
  CONFIRMED: { bgClass: 'bg-green-100', textClass: 'text-green-700', label: 'Confirmed' },
  CANCELLED: { bgClass: 'bg-red-100', textClass: 'text-red-700', label: 'Cancelled' },
};

export default function AmenityBookingsScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<AmenityBooking[]>({
    queryKey: ['amenity-bookings-my'],
    queryFn: () => api.get<AmenityBooking[]>('/amenities/bookings/my'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/amenities/bookings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amenity-bookings-my'] }),
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not cancel booking.'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const today = new Date().toISOString().split('T')[0];
  const upcoming = data?.filter((b: any) => b.date >= today && b.status !== 'CANCELLED') ?? [];
  const past = data?.filter((b: any) => b.date < today || b.status === 'CANCELLED') ?? [];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="flex-1 text-2xl font-bold text-gray-900">My Bookings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48, paddingTop: 8 }}
      >
        {isLoading && (
          <SkeletonPlaceholder count={3} height={100} className="bg-gray-100" borderRadius={20} />
        )}

        {isError && (
          <ErrorCard
            message="Your bookings couldn't be loaded. Please try again — your reservations are safe."
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-8 items-center mt-10">
            <View className="w-16 h-16 rounded-full bg-primary-50 items-center justify-center mb-3">
              <Ionicons name="calendar" size={32} color="#821A52" />
            </View>
            <Text className="text-lg font-semibold text-gray-900">No bookings yet</Text>
            <Text className="text-sm text-gray-500 text-center mt-1">Book an amenity to see your reservations here</Text>
          </View>
        )}

        {upcoming.length > 0 && (
          <>
            <Text className="text-xs font-semibold text-gray-500 mb-2.5 mt-2">UPCOMING</Text>
            {upcoming.map((b: any) => <BookingCard key={b.id} booking={b} onCancel={() => cancelMutation.mutate(b.id)} />)}
          </>
        )}

        {past.length > 0 && (
          <>
            <Text className="text-xs font-semibold text-gray-500 mb-2.5 mt-4">PAST</Text>
            {past.map((b: any) => <BookingCard key={b.id} booking={b} />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BookingCard({ booking, onCancel }: { booking: AmenityBooking; onCancel?: () => void }) {
  const meta = STATUS_META[booking.status] ?? STATUS_META.PENDING;
  return (
    <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-2.5">
      <View className="flex-row justify-between items-start">
        <View className="flex-row items-start flex-1">
          <View className="w-10 h-10 rounded-xl bg-primary-50 items-center justify-center mr-3">
            <Ionicons name="calendar" size={20} color="#821A52" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-gray-900">{booking.amenity.name}</Text>
            <Text className="text-sm text-gray-500 mt-1">
              {new Date(booking.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
            <Text className="text-sm text-gray-500 mt-0.5">{booking.startTime} – {booking.endTime}</Text>
            {booking.totalPrice > 0 && (
              <Text className="text-sm text-primary-500 font-semibold mt-1">₹{booking.totalPrice}</Text>
            )}
          </View>
        </View>
        <View className={`rounded-full px-2.5 py-1 ${meta.bgClass}`}>
          <Text className={`text-xs font-bold ${meta.textClass}`}>{meta.label}</Text>
        </View>
      </View>
      {onCancel && booking.status !== 'CANCELLED' && (
        <TouchableOpacity
          onPress={onCancel}
          className="mt-3 rounded-xl py-2.5 items-center border border-red-200 bg-red-50"
        >
          <Text className="text-red-700 font-semibold text-sm">Cancel Booking</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
