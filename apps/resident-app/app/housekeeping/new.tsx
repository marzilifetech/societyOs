import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { DateField } from '../../src/components/common/DateField';

const TYPES = ['Deep Clean', 'Regular', 'Bathroom', 'Kitchen', 'Windows'];

export default function NewHousekeepingScreen() {
  const qc = useQueryClient();
  const [type, setType] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: (body: object) => api.post('/housekeeping', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeeping'] });
      router.back();
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message ?? 'Could not submit request. Please try again.');
    },
  });

  const handleSubmit = () => {
    if (!type) { Alert.alert('Required', 'Please select a cleaning type.'); return; }
    if (!scheduledAt.trim()) { Alert.alert('Required', 'Please enter a date and time.'); return; }
    mutation.mutate({
      type,
      scheduledAt: scheduledAt.trim(),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 min-h-[48px] justify-center">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Book Housekeeping</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}>
        <Text className="text-gray-500 text-xs font-semibold mb-2.5 mt-2">CLEANING TYPE *</Text>
        <View className="flex-row flex-wrap gap-2.5 mb-6">
          {TYPES.map((tp) => (
            <TouchableOpacity
              key={tp}
              onPress={() => setType(tp)}
              className={`rounded-xl px-3.5 py-2.5 min-h-[48px] justify-center border ${type === tp ? 'bg-primary-500 border-primary-500' : 'bg-gray-100 border-gray-200'}`}
            >
              <Text className={`font-semibold text-sm ${type === tp ? 'text-white' : 'text-gray-700'}`}>{tp}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="mb-6">
          <DateField label="Date & Time *" value={scheduledAt} onChange={setScheduledAt} mode="datetime" minimumDate={new Date()} />
        </View>

        <Text className="text-gray-500 text-xs font-semibold mb-2">NOTES (OPTIONAL)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Any special instructions…"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
          className="bg-gray-100 rounded-2xl border border-gray-200 text-gray-900 text-base p-4 min-h-[120px] mb-8"
          style={{ textAlignVertical: 'top' }}
        />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={mutation.isPending}
          className="bg-primary-500 rounded-2xl py-4 items-center min-h-[56px] justify-center"
        >
          <Text className="text-white text-base font-bold">
            {mutation.isPending ? 'Booking…' : 'Book Now'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
