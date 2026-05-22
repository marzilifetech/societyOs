import { ScrollView, View, Text, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

type IoniconName = keyof typeof Ionicons.glyphMap;
type DoseEntry = { id: string; medicationId: string; name: string; dosage: string; time: string; taken: boolean };
type Medication = { id: string; name: string; dosage: string; frequency: string; times: string[] };

type MedData = {
  todayDoses: { morning: DoseEntry[]; afternoon: DoseEntry[]; evening: DoseEntry[]; night: DoseEntry[] };
  allMedications: Medication[];
};

const SLOT_META: Record<string, { label: string; icon: IoniconName; tint: string }> = {
  morning: { label: 'Morning', icon: 'sunny-outline', tint: '#F59E0B' },
  afternoon: { label: 'Afternoon', icon: 'partly-sunny-outline', tint: '#F97316' },
  evening: { label: 'Evening', icon: 'cloudy-night-outline', tint: '#7C3AED' },
  night: { label: 'Night', icon: 'moon-outline', tint: '#1E40AF' },
};

export default function MedicationsScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<MedData>({
    queryKey: ['medications'],
    queryFn: () => api.get<MedData>('/health/medications/today'),
  });

  const { mutate: toggleDose } = useMutation({
    mutationFn: ({ id, taken }: { id: string; taken: boolean }) =>
      api.patch(`/health/medications/doses/${id}`, { taken }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medications'] }),
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not update dose.'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Medications</Text>
        <TouchableOpacity
          onPress={() => router.push('/health/medications/add' as any)}
          className="bg-primary-500 rounded-xl px-4 py-3 flex-row items-center gap-1"
          style={{ minHeight: 48 }}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text className="text-white font-semibold text-sm">Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}
      >
        {isLoading && (
          <>
            {[1, 2, 3].map((i) => (
              <View key={i} className="bg-gray-50 border border-gray-200 rounded-2xl h-20 mb-3" />
            ))}
          </>
        )}

        {isError && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-6 items-center mt-4">
            <Text className="text-gray-500 text-base mb-3">Could not load medications</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {data && (
          <>
            <Text className="text-gray-900 text-lg font-bold mt-2 mb-3">Today's Schedule</Text>

            {(['morning', 'afternoon', 'evening', 'night'] as const).map((slot) => {
              const doses = data.todayDoses[slot];
              if (doses.length === 0) return null;
              const meta = SLOT_META[slot];
              return (
                <View key={slot} className="mb-5">
                  <View className="flex-row items-center gap-2 mb-2">
                    <Ionicons name={meta.icon} size={16} color={meta.tint} />
                    <Text className="text-gray-500 text-sm font-semibold">{meta.label}</Text>
                  </View>
                  {doses.map((dose) => (
                    <TouchableOpacity
                      key={dose.id}
                      onPress={() => toggleDose({ id: dose.id, taken: !dose.taken })}
                      className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-3 flex-row items-center"
                      style={{ minHeight: 72 }}
                    >
                      <View
                        className="w-8 h-8 rounded-full border-2 items-center justify-center mr-4"
                        style={{ borderColor: dose.taken ? '#821A52' : '#9CA3AF', backgroundColor: dose.taken ? '#FCE7F3' : 'transparent' }}
                      >
                        {dose.taken && <Ionicons name="checkmark" size={16} color="#821A52" />}
                      </View>
                      <View className="flex-1">
                        <Text className="text-gray-900 text-base font-semibold" style={{ textDecorationLine: dose.taken ? 'line-through' : 'none', opacity: dose.taken ? 0.6 : 1 }}>
                          {dose.name}
                        </Text>
                        <Text className="text-gray-500 text-sm">{dose.dosage} · {dose.time}</Text>
                      </View>
                      {dose.taken && <Text className="text-primary-500 text-sm font-semibold">Taken</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}

            {/* All medications collapsible */}
            <TouchableOpacity
              onPress={() => setShowAll(!showAll)}
              className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 flex-row justify-between items-center mb-3"
              style={{ minHeight: 56 }}
            >
              <Text className="text-gray-900 text-base font-semibold">All Medications ({data.allMedications.length})</Text>
              <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={20} color="#821A52" />
            </TouchableOpacity>

            {showAll && data.allMedications.map((med) => (
              <View key={med.id} className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-3 flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-xl bg-primary-50 items-center justify-center">
                  <Ionicons name="medical" size={20} color="#821A52" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 text-base font-semibold">{med.name}</Text>
                  <Text className="text-gray-500 text-sm mt-1">{med.dosage} · {med.frequency}</Text>
                  <Text className="text-gray-400 text-sm mt-0.5">Times: {med.times.join(', ')}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {data && Object.values(data.todayDoses).every((d) => d.length === 0) && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-8 items-center mt-4">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="medkit" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 text-base font-semibold mb-2">No medications today</Text>
            <Text className="text-gray-500 text-sm text-center">Tap + Add to register a medication</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
