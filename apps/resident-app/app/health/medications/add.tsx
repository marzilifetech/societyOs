import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';
import { DateField } from '../../../src/components/common/DateField';

type Frequency = 'once' | 'twice' | 'thrice' | 'custom';

const FREQ_OPTIONS: { key: Frequency; label: string; slots: number }[] = [
  { key: 'once', label: 'Once Daily', slots: 1 },
  { key: 'twice', label: 'Twice Daily', slots: 2 },
  { key: 'thrice', label: 'Thrice Daily', slots: 3 },
  { key: 'custom', label: 'Custom', slots: 4 },
];

const SLOT_NAMES = ['Morning', 'Afternoon', 'Evening', 'Night'];

export default function AddMedicationScreen() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('once');
  const [times, setTimes] = useState(['08:00', '', '', '']);

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const freq = FREQ_OPTIONS.find((f) => f.key === frequency)!;
      return api.post('/health/medications', {
        name,
        dosage,
        frequency,
        times: times.slice(0, freq.slots).filter(Boolean),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] });
      Alert.alert('Saved', 'Medication added successfully.');
      router.back();
    },
    onError: () => Alert.alert('Error', 'Could not add medication. Please try again.'),
  });

  const selectedFreq = FREQ_OPTIONS.find((f) => f.key === frequency)!;

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Required', 'Please enter medication name.'); return; }
    if (!dosage.trim()) { Alert.alert('Required', 'Please enter dosage.'); return; }
    mutate();
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900">Add Medication</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Name */}
        <Text className="text-gray-500 text-sm font-semibold mb-2 uppercase tracking-wide">Medication Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Metformin"
          placeholderTextColor="#9CA3AF"
          className="bg-gray-100 rounded-2xl px-4 py-4 text-gray-900 text-lg mb-5"
          style={{ minHeight: 56 }}
        />

        {/* Dosage */}
        <Text className="text-gray-500 text-sm font-semibold mb-2 uppercase tracking-wide">Dosage</Text>
        <TextInput
          value={dosage}
          onChangeText={setDosage}
          placeholder="e.g. 500mg"
          placeholderTextColor="#9CA3AF"
          className="bg-gray-100 rounded-2xl px-4 py-4 text-gray-900 text-lg mb-5"
          style={{ minHeight: 56 }}
        />

        {/* Frequency */}
        <Text className="text-gray-500 text-sm font-semibold mb-3 uppercase tracking-wide">Frequency</Text>
        <View className="flex-row flex-wrap gap-3 mb-6">
          {FREQ_OPTIONS.map((f) => {
            const isActive = frequency === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFrequency(f.key)}
                className="rounded-2xl px-4 py-3"
                style={{
                  minHeight: 52,
                  backgroundColor: isActive ? '#821A52' : '#F9FAFB',
                  borderWidth: 1,
                  borderColor: isActive ? '#821A52' : '#E5E7EB',
                }}
              >
                <Text className="font-semibold text-base" style={{ color: isActive ? '#fff' : '#6B7280' }}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Time pickers */}
        <Text className="text-gray-500 text-sm font-semibold mb-3 uppercase tracking-wide">Dose Times</Text>
        {Array.from({ length: selectedFreq.slots }).map((_, i) => (
          <View key={i} className="flex-row items-center mb-3">
            <Text className="text-gray-500 text-sm w-24">{SLOT_NAMES[i]}</Text>
            <View className="flex-1">
              <DateField
                value={times[i] ?? null}
                onChange={(hhmm) => {
                  const updated = [...times];
                  updated[i] = hhmm;
                  setTimes(updated);
                }}
                mode="time"
                timeAsHHMM
                placeholder="Pick time"
              />
            </View>
          </View>
        ))}

        <TouchableOpacity
          onPress={handleSave}
          disabled={isPending}
          className="bg-primary-500 rounded-xl py-4 mt-6 items-center"
          style={{ minHeight: 56, opacity: isPending ? 0.6 : 1 }}
        >
          <Text className="text-white text-lg font-bold">{isPending ? 'Saving...' : 'Save Medication'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
