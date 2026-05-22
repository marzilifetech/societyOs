import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { unwrapApiEnvelope } from '@societyos/api-client';
import { getUnwrappedArray } from '../../src/lib/unwrapped-get';

type DoctorAvailability = { id: string; isAvailable: boolean; name: string };

type Appointment = {
  id: string;
  date: string;
  timeSlot: string;
  status: string;
  resident?: { user?: { name?: string | null } };
};

export default function DoctorHome() {
  const qc = useQueryClient();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['doctor-appointments'],
    queryFn: () => getUnwrappedArray<Appointment>('/medical/doctor/my-appointments'),
  });

  const { data: profile } = useQuery<DoctorAvailability>({
    queryKey: ['doctor-profile'],
    queryFn: async () => {
      const raw = await api.get<object>('/medical/staff');
      return unwrapApiEnvelope<DoctorAvailability>(raw);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: () => api.patch('/medical/doctor/availability', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-profile'] });
      qc.invalidateQueries({ queryKey: ['doctor-appointments'] });
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayAppts = appointments.filter((a) => {
    const d = new Date(a.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="flex-row items-center mb-1">
          <View className="w-10 h-10 rounded-2xl bg-primary-50 items-center justify-center mr-3">
            <Ionicons name="medkit" size={22} color="#821A52" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 text-2xl font-bold">Doctor Portal</Text>
            <Text className="text-gray-500 text-sm mt-0.5">
              {today.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Availability toggle */}
        <View className="bg-gray-50 rounded-2xl p-4 mt-5 mb-4 flex-row items-center justify-between border border-gray-200">
          <View className="flex-row items-center flex-1">
            <Ionicons name="medical" size={20} color="#821A52" />
            <View className="ml-3 flex-1">
              <Text className="text-gray-900 font-semibold text-base">Availability</Text>
              <Text className={`text-xs mt-0.5 ${profile?.isAvailable ? 'text-green-700' : 'text-gray-500'}`}>
                {profile?.isAvailable ? 'Available for bookings' : 'Not accepting bookings'}
              </Text>
            </View>
          </View>
          <Switch
            value={profile?.isAvailable ?? false}
            onValueChange={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            trackColor={{ false: '#E5E7EB', true: '#821A52' }}
            thumbColor="#fff"
          />
        </View>

        {/* Today's appointments */}
        <View className="flex-row items-center mb-2.5">
          <Ionicons name="calendar" size={14} color="#6B7280" />
          <Text className="text-gray-500 text-xs font-semibold ml-1.5 uppercase tracking-wider">
            Today — {todayAppts.length} appointments
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#821A52" style={{ marginVertical: 20 }} />
        ) : todayAppts.length === 0 ? (
          <View className="bg-gray-50 rounded-2xl p-6 items-center border border-gray-200 mb-4">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="calendar" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-500 text-sm">No appointments today</Text>
          </View>
        ) : (
          <View className="gap-2.5 mb-4">
            {todayAppts.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} />
            ))}
          </View>
        )}

        {/* Quick nav */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-primary-500 rounded-2xl p-4 items-center"
            onPress={() => router.push('/doctor/appointments' as any)}
          >
            <Ionicons name="calendar" size={20} color="#fff" />
            <Text className="text-white font-semibold text-sm mt-1.5">All Appointments</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-gray-50 rounded-2xl p-4 items-center border border-gray-200"
            onPress={() => router.push('/doctor/schedule' as any)}
          >
            <Ionicons name="time" size={20} color="#821A52" />
            <Text className="text-gray-900 font-semibold text-sm mt-1.5">My Schedule</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AppointmentRow({ appt }: { appt: Appointment }) {
  const name = appt.resident?.user?.name ?? 'Patient';
  const statusBadge =
    appt.status === 'COMPLETED' ? 'bg-green-100' :
    appt.status === 'CANCELLED' ? 'bg-red-100' :
    'bg-amber-100';
  const statusText =
    appt.status === 'COMPLETED' ? 'text-green-700' :
    appt.status === 'CANCELLED' ? 'text-red-700' :
    'text-amber-700';
  return (
    <View className="bg-gray-50 rounded-2xl p-3.5 flex-row items-center justify-between border border-gray-200">
      <View className="flex-row items-center flex-1">
        <View className="w-9 h-9 rounded-xl bg-primary-50 items-center justify-center mr-3">
          <Ionicons name="person" size={16} color="#821A52" />
        </View>
        <View className="flex-1">
          <Text className="text-gray-900 font-semibold text-sm">{name}</Text>
          <Text className="text-gray-500 text-xs mt-0.5">{appt.timeSlot}</Text>
        </View>
      </View>
      <View className={`rounded-lg px-2.5 py-1 ${statusBadge}`}>
        <Text className={`text-xs font-semibold ${statusText}`}>{appt.status}</Text>
      </View>
    </View>
  );
}
