import { useTheme } from '../../src/hooks/useTheme';
import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { DateField } from '../../src/components/common/DateField';

const SERVICE_TYPES = ['Car Booking', 'Airport Transfer', 'Errand', 'Restaurant Booking', 'Delivery Collection', 'Other'];

export default function NewConciergeScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [service, setService] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  const mutation = useMutation({
    mutationFn: (body: object) => api.post('/concierge', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concierge'] });
      Alert.alert('Request Submitted', 'Our concierge team will be in touch shortly.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message ?? 'Could not submit request. Please try again.');
    },
  });

  const handleSubmit = () => {
    if (!service) { Alert.alert('Required', 'Please select a service type.'); return; }
    if (!description.trim()) { Alert.alert('Required', 'Please describe your request.'); return; }
    mutation.mutate({
      service,
      description: description.trim(),
      scheduledAt: scheduledAt.trim() || undefined,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="min-h-[52px] justify-center mr-3">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">New Request</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        <Text className="text-gray-500 text-xs font-semibold mb-2.5">SERVICE TYPE *</Text>
        <View className="flex-row flex-wrap gap-2.5 mb-6">
          {SERVICE_TYPES.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setService(s)}
              className={`rounded-xl px-3.5 py-2.5 min-h-[52px] justify-center border ${service === s ? 'bg-primary-500 border-primary-500' : 'bg-gray-100 border-gray-200'}`}
            >
              <Text className={`font-semibold text-sm ${service === s ? 'text-white' : 'text-gray-700'}`}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-gray-500 text-xs font-semibold mb-2">DESCRIPTION *</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what you need…"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
          className="bg-gray-100 rounded-2xl border border-gray-200 text-gray-900 text-base p-4 min-h-[120px] mb-6"
          style={{ textAlignVertical: 'top' }}
        />

        <View className="mb-8">
          <DateField label="Preferred Date & Time" value={scheduledAt} onChange={setScheduledAt} mode="datetime" minimumDate={new Date()} />
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={mutation.isPending}
          className="bg-primary-500 rounded-2xl py-4 items-center min-h-[56px] justify-center"
        >
          <Text className="text-white text-base font-bold">
            {mutation.isPending ? 'Submitting…' : 'Submit Request'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
