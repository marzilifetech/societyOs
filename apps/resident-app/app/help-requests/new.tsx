import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

const CATEGORIES = ['Plumbing', 'Electrical', 'Carpentry', 'Cleaning', 'Other'];
const URGENCIES: { value: 'LOW' | 'MEDIUM' | 'HIGH'; label: string; activeBg: string; activeText: string; activeBorder: string }[] = [
  { value: 'LOW', label: 'Low', activeBg: 'bg-gray-100', activeText: 'text-gray-700', activeBorder: 'border-gray-300' },
  { value: 'MEDIUM', label: 'Medium', activeBg: 'bg-orange-100', activeText: 'text-orange-700', activeBorder: 'border-orange-300' },
  { value: 'HIGH', label: 'High', activeBg: 'bg-red-100', activeText: 'text-red-700', activeBorder: 'border-red-300' },
];

export default function NewHelpRequestScreen() {
  const qc = useQueryClient();
  const [category, setCategory] = useState('');
  const [urgency, setUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: (body: object) => api.post('/help-requests', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['help-requests'] });
      Alert.alert('Request Submitted', 'Staff have been notified of your request.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message ?? 'Could not submit request. Please try again.');
    },
  });

  const handleSubmit = () => {
    if (!category) { Alert.alert('Required', 'Please select a category.'); return; }
    if (!description.trim()) { Alert.alert('Required', 'Please describe your issue.'); return; }
    mutation.mutate({ category, urgency, description: description.trim() });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="min-h-[52px] justify-center mr-3">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">New Help Request</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}>
        <Text className="text-gray-500 text-xs font-semibold mb-2.5">CATEGORY *</Text>
        <View className="flex-row flex-wrap gap-2.5 mb-6">
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setCategory(c)}
              className={`rounded-xl px-3.5 py-2.5 min-h-[48px] justify-center border ${category === c ? 'bg-primary-500 border-primary-500' : 'bg-gray-100 border-gray-200'}`}
            >
              <Text className={`font-semibold text-sm ${category === c ? 'text-white' : 'text-gray-700'}`}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-gray-500 text-xs font-semibold mb-2.5">URGENCY</Text>
        <View className="flex-row gap-2.5 mb-6">
          {URGENCIES.map((u) => {
            const isActive = urgency === u.value;
            return (
              <TouchableOpacity
                key={u.value}
                onPress={() => setUrgency(u.value)}
                className={`flex-1 rounded-xl py-3 min-h-[48px] justify-center items-center border ${isActive ? `${u.activeBg} ${u.activeBorder}` : 'bg-gray-100 border-gray-200'}`}
              >
                <Text className={`font-bold text-sm ${isActive ? u.activeText : 'text-gray-500'}`}>{u.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="text-gray-500 text-xs font-semibold mb-2">DESCRIPTION *</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the issue in detail…"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={5}
          className="bg-gray-100 rounded-2xl border border-gray-200 text-gray-900 text-base p-4 min-h-[140px] mb-8"
          style={{ textAlignVertical: 'top' }}
        />

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
