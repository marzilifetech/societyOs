import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

type AppointmentDetail = {
  id: string;
  doctor: { name: string; designation?: string; specialization?: string };
  date: string;
  timeSlot: string;
  status: 'BOOKED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes?: string;
  cancellable?: boolean;
};

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  BOOKED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  CONFIRMED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },
  NO_SHOW: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

const isUpcoming = (s: AppointmentDetail['status']) => s === 'BOOKED' || s === 'CONFIRMED';

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: apt, isLoading, isError, refetch } = useQuery<AppointmentDetail>({
    queryKey: ['appointment', id],
    queryFn: () => api.get<AppointmentDetail>(`/medical/appointments/${id}`),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/medical/appointments/${id}/cancel`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointment', id] });
      qc.invalidateQueries({ queryKey: ['my-appointments'] });
      Alert.alert('Cancelled', 'Your appointment has been cancelled.');
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Appointment Detail</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" size="large" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-2xl bg-amber-100 items-center justify-center mb-4">
            <Ionicons name="warning" size={32} color="#B45309" />
          </View>
          <Text className="text-gray-900 text-lg font-semibold mb-4">Failed to load</Text>
          <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-xl px-6 py-3">
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : apt ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-3">
              <Ionicons name="medkit" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 text-2xl font-bold">Dr. {apt.doctor?.name ?? 'Unknown'}</Text>
            {apt.doctor?.specialization ?? apt.doctor?.designation ? (
              <Text className="text-primary-500 text-base mt-1">{apt.doctor?.specialization ?? apt.doctor?.designation}</Text>
            ) : null}
          </View>

          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4 gap-4">
            <Row label="Date" value={new Date(apt.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
            <Row label="Time" value={apt.timeSlot} />
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-500 text-sm">Status</Text>
              <View className={`rounded-full px-3 py-1 ${STATUS_BADGE[apt.status]?.bg ?? 'bg-gray-100'}`}>
                <Text className={`text-xs font-semibold ${STATUS_BADGE[apt.status]?.text ?? 'text-gray-700'}`}>{apt.status}</Text>
              </View>
            </View>
          </View>

          {apt.notes ? (
            <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4">
              <Text className="text-gray-500 text-sm mb-2">Notes</Text>
              <Text className="text-gray-900 text-base leading-6">{apt.notes}</Text>
            </View>
          ) : null}

          {isUpcoming(apt.status) && (
            <View className="gap-3 mt-2">
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/medical/book', params: { doctorId: apt.id } } as any)}
                className="bg-primary-50 border border-primary-500/30 rounded-2xl py-4 items-center"
              >
                <Text className="text-primary-500 font-bold text-base">Reschedule</Text>
              </TouchableOpacity>
              {apt.cancellable !== false && (
                <TouchableOpacity
                  onPress={() => Alert.alert('Cancel Appointment', 'Are you sure you want to cancel?', [
                    { text: 'No', style: 'cancel' },
                    { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate() },
                  ])}
                  disabled={cancelMutation.isPending}
                  className="bg-red-100 border border-red-200 rounded-2xl py-4 items-center"
                >
                  {cancelMutation.isPending ? (
                    <ActivityIndicator color="#B91C1C" />
                  ) : (
                    <Text className="text-red-700 font-bold text-base">Cancel Appointment</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {apt.status === 'COMPLETED' && (
            <TouchableOpacity className="bg-primary-500 rounded-2xl py-4 items-center mt-2">
              <Text className="text-white font-bold text-base">Rate this Visit</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-gray-500 text-sm">{label}</Text>
      <Text className="text-gray-900 text-base font-medium">{value}</Text>
    </View>
  );
}
