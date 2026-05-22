import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { unwrapApiEnvelope } from '@societyos/api-client';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type MedicalStaff = {
  id: string;
  schedule: {
    availableDays?: string[];
    timeSlots?: string[];
  } | null;
};

export default function ScheduleScreen() {
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<MedicalStaff>({
    queryKey: ['doctor-schedule'],
    queryFn: async () => {
      const raw = await api.get<object>('/medical/staff');
      return unwrapApiEnvelope<MedicalStaff>(raw);
    },
  });

  const schedule = profile?.schedule ?? {};
  const [selectedDays, setSelectedDays] = useState<string[]>(() => schedule?.availableDays ?? []);
  const [slots, setSlots] = useState<string[]>(() => schedule?.timeSlots ?? []);
  const [newSlot, setNewSlot] = useState('');

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post('/medical/doctor/slots', { availableDays: selectedDays, timeSlots: slots }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-schedule'] });
      Alert.alert('Saved', 'Schedule updated successfully.');
    },
  });

  function toggleDay(day: string) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function addSlot() {
    const s = newSlot.trim();
    if (!s || slots.includes(s)) return;
    setSlots((prev) => [...prev, s].sort());
    setNewSlot('');
  }

  function removeSlot(slot: string) {
    setSlots((prev) => prev.filter((s) => s !== slot));
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#821A52" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="flex-row items-center mb-3">
          <Ionicons name="calendar" size={14} color="#6B7280" />
          <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider ml-1.5">
            Available Days
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2.5 mb-7">
          {DAYS.map((day) => {
            const active = selectedDays.includes(day);
            return (
              <TouchableOpacity
                key={day}
                onPress={() => toggleDay(day)}
                className={`px-4 py-2.5 rounded-xl border ${
                  active ? 'bg-primary-500 border-primary-500' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text className={`font-semibold text-sm ${active ? 'text-white' : 'text-gray-500'}`}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="flex-row items-center mb-3">
          <Ionicons name="time" size={14} color="#6B7280" />
          <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider ml-1.5">
            Time Slots
          </Text>
        </View>

        <View className="flex-row gap-2.5 mb-4">
          <TextInput
            value={newSlot}
            onChangeText={setNewSlot}
            placeholder="e.g. 09:00"
            placeholderTextColor="#9CA3AF"
            className="flex-1 bg-gray-100 rounded-xl border border-gray-200 text-gray-900 px-3.5 py-2.5 text-sm"
          />
          <TouchableOpacity
            onPress={addSlot}
            className="bg-primary-500 rounded-xl px-4 justify-center items-center"
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {slots.length === 0 ? (
          <Text className="text-gray-400 text-sm mb-4">No time slots added yet.</Text>
        ) : (
          <View className="gap-2 mb-4">
            {slots.map((slot) => (
              <View
                key={slot}
                className="bg-gray-50 rounded-xl px-3.5 py-3 flex-row items-center justify-between border border-gray-200"
              >
                <View className="flex-row items-center">
                  <Ionicons name="time-outline" size={16} color="#821A52" />
                  <Text className="text-gray-900 text-sm ml-2">{slot}</Text>
                </View>
                <TouchableOpacity onPress={() => removeSlot(slot)} className="w-7 h-7 items-center justify-center">
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          onPress={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-primary-500 rounded-2xl py-3.5 items-center mt-2"
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Save Schedule</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
