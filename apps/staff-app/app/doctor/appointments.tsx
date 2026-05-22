import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { getUnwrappedArray } from '../../src/lib/unwrapped-get';

type Appointment = {
  id: string;
  date: string;
  timeSlot: string;
  status: string;
  notes?: string | null;
  resident?: { user?: { name?: string | null } };
};

const STATUS_STYLE: Record<string, { badge: string; text: string }> = {
  BOOKED: { badge: 'bg-amber-100', text: 'text-amber-700' },
  COMPLETED: { badge: 'bg-green-100', text: 'text-green-700' },
  CANCELLED: { badge: 'bg-red-100', text: 'text-red-700' },
};

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function AppointmentsScreen() {
  const qc = useQueryClient();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['doctor-appointments'],
    queryFn: () => getUnwrappedArray<Appointment>('/medical/doctor/my-appointments'),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/medical/appointments/${id}/complete`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-appointments'] }),
  });

  function handleComplete(id: string) {
    Alert.alert('Complete Appointment', 'Mark this appointment as completed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: () => completeMutation.mutate(id) },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="flex-row items-center mb-3.5">
          <Ionicons name="calendar" size={14} color="#6B7280" />
          <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider ml-1.5">
            Upcoming Appointments
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#821A52" style={{ marginTop: 40 }} />
        ) : appointments.length === 0 ? (
          <View className="bg-gray-50 rounded-2xl p-6 items-center border border-gray-200">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="calendar" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-500 text-sm">No upcoming appointments</Text>
          </View>
        ) : (
          <View className="gap-3">
            {appointments.map((appt) => {
              const name = appt.resident?.user?.name ?? 'Patient';
              const meta = STATUS_STYLE[appt.status] ?? { badge: 'bg-gray-100', text: 'text-gray-700' };
              return (
                <View
                  key={appt.id}
                  className="bg-gray-50 rounded-2xl p-4 border border-gray-200"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center flex-1">
                      <View className="w-9 h-9 rounded-xl bg-primary-50 items-center justify-center mr-3">
                        <Ionicons name="person" size={16} color="#821A52" />
                      </View>
                      <Text className="text-gray-900 font-semibold text-base flex-1">{name}</Text>
                    </View>
                    <View className={`rounded-lg px-2.5 py-1 ${meta.badge}`}>
                      <Text className={`text-xs font-semibold ${meta.text}`}>{appt.status}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={12} color="#6B7280" />
                    <Text className="text-gray-500 text-xs ml-1">{fmt(appt.date)} · {appt.timeSlot}</Text>
                  </View>
                  {appt.notes ? (
                    <Text className="text-gray-500 text-xs mt-1.5" numberOfLines={2}>{appt.notes}</Text>
                  ) : null}
                  {appt.status === 'BOOKED' && (
                    <TouchableOpacity
                      onPress={() => handleComplete(appt.id)}
                      disabled={completeMutation.isPending}
                      className="mt-3 bg-green-100 rounded-xl py-2.5 items-center flex-row justify-center"
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                      <Text className="text-green-700 font-semibold text-sm ml-1.5">Mark Complete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
