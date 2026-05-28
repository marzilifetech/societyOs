import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import {
  ScreenHeader,
  BottomActionBar,
  RadioCard,
} from '../../src/components/ui';

// Public Figma reference (Staff Help Requests frame): node-id=101-22188
// Behaviour-preserving redesign — same /help-requests POST, same validation;
// new ScreenHeader / RadioCard / BottomActionBar primitives.

type IoniconName = keyof typeof Ionicons.glyphMap;

const CATEGORIES: { value: string; label: string; icon: IoniconName; subtitle: string }[] = [
  { value: 'Plumbing', label: 'Plumbing', icon: 'water', subtitle: 'Leaks, drainage, taps' },
  { value: 'Electrical', label: 'Electrical', icon: 'flash', subtitle: 'Wiring, outlets, lights' },
  { value: 'Carpentry', label: 'Carpentry', icon: 'hammer', subtitle: 'Doors, locks, fittings' },
  { value: 'Cleaning', label: 'Cleaning', icon: 'sparkles', subtitle: 'Common-area cleanup' },
  { value: 'Other', label: 'Other', icon: 'help-circle', subtitle: 'Anything not above' },
];

type Urgency = 'LOW' | 'MEDIUM' | 'HIGH';
const URGENCIES: { value: Urgency; label: string; activeBg: string; activeText: string; activeBorder: string }[] = [
  { value: 'LOW', label: 'Low', activeBg: 'bg-gray-100', activeText: 'text-gray-700', activeBorder: 'border-gray-300' },
  { value: 'MEDIUM', label: 'Medium', activeBg: 'bg-orange-100', activeText: 'text-orange-700', activeBorder: 'border-orange-300' },
  { value: 'HIGH', label: 'High', activeBg: 'bg-red-100', activeText: 'text-red-700', activeBorder: 'border-red-300' },
];

export default function NewHelpRequestScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [category, setCategory] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('LOW');
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

  const isValid = category.length > 0 && description.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="New Help Request" subtitle="Tell us what needs attention" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingBottom: 24, paddingTop: 8 }}
      >
        <Text className="text-gray-500 font-semibold mb-3" style={{ fontSize: t.fontXs, letterSpacing: 0.5 }}>
          CATEGORY *
        </Text>
        <View style={{ gap: 10, marginBottom: 24 }}>
          {CATEGORIES.map((c) => (
            <RadioCard
              key={c.value}
              title={c.label}
              subtitle={c.subtitle}
              icon={c.icon}
              selected={category === c.value}
              onPress={() => setCategory(c.value)}
              accessibilityHint={`Select ${c.label} category`}
            />
          ))}
        </View>

        <Text className="text-gray-500 font-semibold mb-3" style={{ fontSize: t.fontXs, letterSpacing: 0.5 }}>
          URGENCY
        </Text>
        <View className="flex-row gap-2.5 mb-6">
          {URGENCIES.map((u) => {
            const isActive = urgency === u.value;
            return (
              <TouchableOpacity
                key={u.value}
                onPress={() => setUrgency(u.value)}
                className={`flex-1 rounded-xl py-3 justify-center items-center border ${isActive ? `${u.activeBg} ${u.activeBorder}` : 'bg-gray-100 border-gray-200'}`}
                style={{ minHeight: t.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel={`Set urgency to ${u.label}`}
                accessibilityState={{ selected: isActive }}
              >
                <Text className={`font-bold ${isActive ? u.activeText : 'text-gray-500'}`} style={{ fontSize: t.fontSm }}>
                  {u.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="text-gray-500 font-semibold mb-2" style={{ fontSize: t.fontXs, letterSpacing: 0.5 }}>
          DESCRIPTION *
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the issue in detail…"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={5}
          accessibilityLabel="Help request description"
          className="bg-gray-100 rounded-2xl border border-gray-200 text-gray-900 p-4 min-h-[140px]"
          style={{ textAlignVertical: 'top', fontSize: t.fontBase }}
        />
      </ScrollView>

      <BottomActionBar
        primary={{
          label: mutation.isPending ? 'Submitting…' : 'Submit Request',
          onPress: handleSubmit,
          loading: mutation.isPending,
          disabled: mutation.isPending || !isValid,
          accessibilityLabel: 'Submit help request',
        }}
      />
    </View>
  );
}
