import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

async function scheduleAppointmentReminder(date: string, timeSlot: string) {
  try {
    const perms = await Notifications.requestPermissionsAsync();
    if ((perms as { granted?: boolean }).granted === false) return;
    // Parse "HH:MM" or "HH:MM AM/PM" from timeSlot
    const [datePart] = [date];
    const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!timeMatch) return;
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const meridiem = timeMatch[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    const apptDate = new Date(`${datePart}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    const reminderDate = new Date(apptDate.getTime() - 60 * 60 * 1000); // 1 hour before
    if (reminderDate <= new Date()) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Doctor Appointment Reminder',
        body: `Your appointment is at ${timeSlot}. Please be ready.`,
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
    });
  } catch {
    // non-critical — don't block the UI
  }
}

type Doctor = { id: string; name: string; specialization: string };
type Slot = { timeSlot: string; available: boolean };

function getDateOptions() {
  return Array.from({ length: 7 }, (_: any, i: any) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
      value: d.toISOString().split('T')[0],
    };
  });
}

export default function BookAppointmentScreen() {
  const { doctorId: paramDoctorId } = useLocalSearchParams<{ doctorId?: string }>();
  const qc = useQueryClient();
  const dateOptions = getDateOptions();
  const [selectedDoctorId, setSelectedDoctorId] = useState(paramDoctorId ?? '');
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].value);
  const [confirmed, setConfirmed] = useState(false);

  const { data: doctors } = useQuery<Doctor[]>({
    queryKey: ['doctors'],
    queryFn: () => api.get<Doctor[]>('/medical/doctors'),
    enabled: !paramDoctorId,
  });

  const { data: slots, isLoading: loadingSlots } = useQuery<Slot[]>({
    queryKey: ['slots', selectedDoctorId, selectedDate],
    queryFn: () => api.get<Slot[]>(`/medical/slots?doctorId=${selectedDoctorId}&date=${selectedDate}`),
    enabled: !!selectedDoctorId,
  });

  const bookMutation = useMutation({
    mutationFn: (slot: string) =>
      api.post('/medical/appointments', { doctorId: selectedDoctorId, date: selectedDate, timeSlot: slot }),
    onSuccess: (_data: unknown, slot: string) => {
      qc.invalidateQueries({ queryKey: ['slots'] });
      qc.invalidateQueries({ queryKey: ['my-appointments'] });
      scheduleAppointmentReminder(selectedDate, slot);
      setConfirmed(true);
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  if (confirmed) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <View className="w-20 h-20 rounded-3xl bg-primary-50 items-center justify-center mb-6">
          <Ionicons name="checkmark-circle" size={56} color="#821A52" />
        </View>
        <Text className="text-gray-900 text-2xl font-bold mb-3 text-center">Appointment Booked!</Text>
        <Text className="text-gray-500 text-base text-center mb-8">Your appointment has been confirmed. You'll receive a reminder before the visit.</Text>
        <TouchableOpacity onPress={() => router.push('/medical/appointments' as any)} className="bg-primary-500 rounded-2xl py-4 px-10 mb-3 w-full items-center">
          <Text className="text-white font-bold text-base">View My Appointments</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/medical' as any)} className="py-4 px-10 w-full items-center">
          <Text className="text-gray-500 font-semibold">Back to Medical</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-gray-900 text-xl font-bold">Book Appointment</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        {/* Doctor selection if not pre-selected */}
        {!paramDoctorId && doctors?.length ? (
          <View className="mb-6">
            <Text className="text-gray-900 text-base font-semibold mb-3">Select Doctor</Text>
            {doctors.map((doc: any) => {
              const selected = selectedDoctorId === doc.id;
              return (
                <TouchableOpacity
                  key={doc.id}
                  onPress={() => setSelectedDoctorId(doc.id)}
                  className={`rounded-2xl p-4 mb-3 flex-row items-center gap-3 border ${selected ? 'bg-primary-50 border-primary-500' : 'bg-gray-50 border-gray-200'}`}
                >
                  <View className={`w-11 h-11 rounded-xl items-center justify-center ${selected ? 'bg-white' : 'bg-primary-50'}`}>
                    <Ionicons name="medkit" size={22} color="#821A52" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 font-semibold">Dr. {doc.name}</Text>
                    <Text className="text-gray-500 text-sm">{doc.specialization}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={22} color="#821A52" />}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* Date picker */}
        <Text className="text-gray-900 text-base font-semibold mb-3">Select Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 -mx-1">
          <View className="flex-row gap-2 px-1 py-1">
            {dateOptions.map((opt: any) => {
              const selected = selectedDate === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setSelectedDate(opt.value)}
                  className={`rounded-2xl border px-4 py-2.5 justify-center ${selected ? 'bg-primary-500 border-primary-500' : 'bg-gray-100 border-gray-200'}`}
                  style={{ minHeight: 48 }}
                >
                  <Text className={`font-semibold text-sm ${selected ? 'text-white' : 'text-gray-700'}`}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Slots */}
        {selectedDoctorId ? (
          <>
            <Text className="text-gray-900 text-base font-semibold mb-3">Available Slots</Text>
            {loadingSlots ? (
              <View className="items-center py-10">
                <ActivityIndicator color="#821A52" />
              </View>
            ) : !slots?.length ? (
              <View className="bg-gray-50 border border-gray-200 rounded-2xl p-8 items-center">
                <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                  <Ionicons name="calendar" size={32} color="#821A52" />
                </View>
                <Text className="text-gray-500 text-sm text-center">No slots available for this date</Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-3">
                {slots.map((slot: any) => (
                  <TouchableOpacity
                    key={slot.timeSlot}
                    onPress={() => slot.available && bookMutation.mutate(slot.timeSlot)}
                    disabled={!slot.available || bookMutation.isPending}
                    className={`rounded-2xl border px-4 py-3 justify-center ${slot.available ? 'bg-primary-50 border-primary-500' : 'bg-gray-100 border-gray-200'}`}
                    style={{ minHeight: 48, opacity: slot.available ? 1 : 0.5 }}
                  >
                    <View className="flex-row items-center gap-1.5">
                      <Ionicons name="time" size={14} color={slot.available ? '#821A52' : '#9CA3AF'} />
                      <Text className={`font-semibold text-sm ${slot.available ? 'text-primary-500' : 'text-gray-400'}`}>{slot.timeSlot}</Text>
                    </View>
                    {!slot.available && <Text className="text-gray-400 text-[10px] mt-0.5">Booked</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        ) : (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-8 items-center">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="medkit" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-500 text-sm">Select a doctor to view available slots</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
