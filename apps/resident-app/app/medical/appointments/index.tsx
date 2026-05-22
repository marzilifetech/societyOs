import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

type Appointment = {
  id: string;
  doctor: { name: string; designation?: string; specialization?: string };
  date: string;
  timeSlot: string;
  status: 'BOOKED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
};

const STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  BOOKED: { label: 'Upcoming', bg: 'bg-blue-100', text: 'text-blue-700' },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-100', text: 'text-blue-700' },
  COMPLETED: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-700' },
  NO_SHOW: { label: 'No-show', bg: 'bg-amber-100', text: 'text-amber-700' },
};

const isUpcoming = (s: Appointment['status']) => s === 'BOOKED' || s === 'CONFIRMED';

export default function MyAppointmentsScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const { data: appointments, isLoading, isError, refetch } = useQuery<Appointment[]>({
    queryKey: ['my-appointments'],
    queryFn: () => api.get<Appointment[]>('/medical/appointments/mine'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/medical/appointments/${id}/cancel`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-appointments'] }),
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const upcoming = appointments?.filter((a) => isUpcoming(a.status)) ?? [];
  const past = appointments?.filter((a) => !isUpcoming(a.status)) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900">My Appointments</Text>
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
          <Text className="text-gray-900 text-lg font-semibold mb-4">Failed to load appointments</Text>
          <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-xl px-6 py-3">
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor="#821A52" />}
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        >
          <Text className="text-gray-900 text-xl font-semibold mb-4">Upcoming</Text>
          {!upcoming.length ? (
            <View className="bg-gray-50 border border-gray-200 rounded-2xl p-8 items-center mb-6">
              <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                <Ionicons name="calendar" size={32} color="#821A52" />
              </View>
              <Text className="text-gray-500 text-sm text-center">No upcoming appointments</Text>
              <TouchableOpacity onPress={() => router.push('/medical' as any)} className="bg-primary-500 rounded-xl px-6 py-3 mt-4">
                <Text className="text-white font-semibold text-sm">Book Now</Text>
              </TouchableOpacity>
            </View>
          ) : (
            upcoming.map((apt) => (
              <AppointmentCard
                key={apt.id}
                apt={apt}
                onPress={() => router.push(`/medical/appointments/${apt.id}` as any)}
                onCancel={() => Alert.alert('Cancel Appointment', 'Are you sure?', [
                  { text: 'No', style: 'cancel' },
                  { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate(apt.id) },
                ])}
                onReschedule={() => router.push({ pathname: '/medical/book', params: { doctorId: apt.id } } as any)}
              />
            ))
          )}

          <TouchableOpacity
            onPress={() => setShowPast(!showPast)}
            className="flex-row items-center justify-between mb-4 mt-2"
          >
            <Text className="text-gray-900 text-xl font-semibold">Past Appointments</Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-primary-500 text-sm font-semibold">{showPast ? 'Hide' : 'Show'}</Text>
              <Ionicons name={showPast ? 'chevron-up' : 'chevron-down'} size={16} color="#821A52" />
            </View>
          </TouchableOpacity>

          {showPast && past.map((apt) => (
            <AppointmentCard
              key={apt.id}
              apt={apt}
              onPress={() => router.push(`/medical/appointments/${apt.id}` as any)}
            />
          ))}
        </ScrollView>
      )}

      <View className="px-6 pb-6">
        <TouchableOpacity onPress={() => router.push('/medical' as any)} className="bg-primary-500 rounded-2xl py-4 items-center flex-row justify-center gap-2">
          <Ionicons name="add" size={20} color="#fff" />
          <Text className="text-white font-bold text-base">Book New Appointment</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function AppointmentCard({
  apt,
  onPress,
  onCancel,
  onReschedule,
}: {
  apt: Appointment;
  onPress: () => void;
  onCancel?: () => void;
  onReschedule?: () => void;
}) {
  const meta = STATUS_META[apt.status] ?? STATUS_META.BOOKED;
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-3"
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-row items-start flex-1 gap-3">
          <View className="w-10 h-10 rounded-xl bg-primary-50 items-center justify-center">
            <Ionicons name="medkit" size={20} color="#821A52" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 font-semibold text-base">Dr. {apt.doctor?.name ?? 'Unknown'}</Text>
            {apt.doctor?.specialization ?? apt.doctor?.designation ? (
              <Text className="text-gray-500 text-sm">{apt.doctor?.specialization ?? apt.doctor?.designation}</Text>
            ) : null}
          </View>
        </View>
        <View className={`rounded-full px-3 py-1 ${meta.bg}`}>
          <Text className={`text-xs font-semibold ${meta.text}`}>{meta.label}</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2 mt-1">
        <Ionicons name="calendar" size={14} color="#6B7280" />
        <Text className="text-gray-500 text-sm">
          {new Date(apt.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {apt.timeSlot}
        </Text>
      </View>
      {isUpcoming(apt.status) && (
        <View className="flex-row gap-3 mt-3">
          {onReschedule && (
            <TouchableOpacity onPress={onReschedule} className="flex-1 bg-primary-50 border border-primary-500/30 rounded-xl py-3 items-center">
              <Text className="text-primary-500 text-sm font-semibold">Reschedule</Text>
            </TouchableOpacity>
          )}
          {onCancel && (
            <TouchableOpacity onPress={onCancel} className="flex-1 bg-red-100 border border-red-200 rounded-xl py-3 items-center">
              <Text className="text-red-700 text-sm font-semibold">Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {apt.status === 'COMPLETED' && (
        <TouchableOpacity className="bg-amber-100 border border-amber-200 rounded-xl py-3 items-center mt-2">
          <Text className="text-amber-700 text-sm font-semibold">Rate this Visit</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}
