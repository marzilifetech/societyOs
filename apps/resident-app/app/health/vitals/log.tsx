import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

type IoniconName = keyof typeof Ionicons.glyphMap;
type VitalType = 'bp' | 'sugar' | 'weight' | 'spo2';

const TYPES: { key: VitalType; label: string; unit: string; icon: IoniconName; tint: string; placeholder: string }[] = [
  { key: 'bp', label: 'Blood Pressure', unit: 'mmHg', icon: 'pulse', tint: '#DC2626', placeholder: '120/80' },
  { key: 'sugar', label: 'Blood Sugar', unit: 'mg/dL', icon: 'water', tint: '#0EA5E9', placeholder: '95' },
  { key: 'weight', label: 'Weight', unit: 'kg', icon: 'scale', tint: '#16A34A', placeholder: '70.5' },
  { key: 'spo2', label: 'SpO2', unit: '%', icon: 'fitness', tint: '#7C3AED', placeholder: '98' },
];

export default function LogVitalScreen() {
  const qc = useQueryClient();
  const [selectedType, setSelectedType] = useState<VitalType>('bp');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      api.post('/health/vitals', { type: selectedType, value, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vitals'] });
      qc.invalidateQueries({ queryKey: ['health-today'] });
      Alert.alert('Saved', 'Vital reading recorded successfully.');
      router.back();
    },
    onError: () => Alert.alert('Error', 'Could not save reading. Please try again.'),
  });

  const selected = TYPES.find((type) => type.key === selectedType)!;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ minHeight: 48, justifyContent: 'center', marginRight: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900">Log Vital</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Type selector */}
        <Text className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Vital Type</Text>
        <View className="flex-row flex-wrap gap-3 mb-6">
          {TYPES.map((type) => {
            const isActive = selectedType === type.key;
            return (
              <TouchableOpacity
                key={type.key}
                onPress={() => { setSelectedType(type.key); setValue(''); }}
                className="rounded-2xl px-4 flex-row items-center gap-2"
                style={{
                  minHeight: 44,
                  backgroundColor: isActive ? '#821A52' : '#F9FAFB',
                  borderWidth: 1,
                  borderColor: isActive ? '#821A52' : '#E5E7EB',
                }}
                accessibilityRole="button"
                accessibilityLabel={`Select ${type.label} vital type`}
              >
                <Ionicons name={type.icon} size={16} color={isActive ? '#fff' : type.tint} />
                <Text className="font-semibold text-sm" style={{ color: isActive ? '#fff' : '#6B7280' }}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Value input */}
        <Text className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Reading</Text>
        <View className="bg-gray-100 rounded-2xl px-5 py-5 mb-2 flex-row items-center">
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={selected.placeholder}
            placeholderTextColor="#9CA3AF"
            keyboardType={selectedType === 'bp' ? 'default' : 'decimal-pad'}
            className="flex-1 text-gray-900 font-bold"
            style={{ fontSize: 24 }}
          />
          <Text className="text-gray-500 text-sm ml-3">{selected.unit}</Text>
        </View>
        {selectedType === 'bp' && (
          <Text className="text-gray-400 text-sm mb-6">Enter as systolic/diastolic (e.g. 120/80)</Text>
        )}

        {/* Notes */}
        <Text className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide mt-4">Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Any context or notes..."
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
          className="bg-gray-100 rounded-2xl px-4 py-4 text-gray-900"
          style={{ fontSize: 16, textAlignVertical: 'top', minHeight: 80 }}
        />

        {/* Save */}
        <TouchableOpacity
          onPress={() => {
            if (!value.trim()) { Alert.alert('Required', 'Please enter a value.'); return; }
            mutate();
          }}
          disabled={isPending}
          className="bg-primary-500 rounded-xl mt-8 items-center"
          style={{ minHeight: 56, justifyContent: 'center', opacity: isPending ? 0.6 : 1 }}
          accessibilityRole="button"
          accessibilityLabel="Save vital reading"
        >
          <Text className="text-white font-bold text-lg">{isPending ? 'Saving...' : 'Save Reading'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
