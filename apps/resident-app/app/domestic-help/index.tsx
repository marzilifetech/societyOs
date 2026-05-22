import { ScrollView, View, Text, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type DomesticHelp = {
  id: string;
  name: string;
  role: string;
  photo?: string;
  presentToday: boolean | null;
};

export default function DomesticHelpScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<DomesticHelp[]>({
    queryKey: ['domestic-help'],
    queryFn: () => api.get<DomesticHelp[]>('/domestic-help'),
  });

  const { mutate: markAttendance } = useMutation({
    mutationFn: ({ id, present }: { id: string; present: boolean }) =>
      api.post(`/domestic-help/${id}/attendance`, { present, date: new Date().toISOString().split('T')[0] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domestic-help'] }),
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not mark attendance.'),
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
        <Text className="text-2xl font-bold text-gray-900 flex-1">Domestic Help</Text>
        <TouchableOpacity
          onPress={() => router.push('/domestic-help/add' as any)}
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
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        <Text className="text-gray-500 text-sm mt-2 mb-4">Today's attendance — tap to mark</Text>

        {isLoading && [1, 2, 3].map((i) => (
          <View key={i} className="bg-gray-50 border border-gray-200 rounded-2xl h-24 mb-3" />
        ))}

        {isError && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-6 items-center">
            <Text className="text-gray-500 text-base mb-3">Could not load staff</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {data?.length === 0 && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-8 items-center">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="people" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 text-base font-semibold mb-2">No domestic help registered</Text>
            <Text className="text-gray-500 text-sm text-center">Tap + Add to register a helper</Text>
          </View>
        )}

        {data?.map((person) => {
          const present = person.presentToday;
          const statusBadge =
            present === true ? { bg: 'bg-green-100', text: 'text-green-700', label: 'Present' } :
            present === false ? { bg: 'bg-red-100', text: 'text-red-700', label: 'Absent' } :
            { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Not marked' };
          return (
            <View key={person.id} className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-3">
              <View className="flex-row items-center mb-3">
                {/* Avatar */}
                <View className="w-12 h-12 rounded-full bg-primary-50 items-center justify-center mr-3">
                  <Ionicons name="person" size={24} color="#821A52" />
                </View>
                <TouchableOpacity
                  className="flex-1"
                  onPress={() => router.push(`/domestic-help/${person.id}` as any)}
                >
                  <Text className="text-gray-900 text-base font-bold">{person.name}</Text>
                  <Text className="text-gray-500 text-sm">{person.role}</Text>
                </TouchableOpacity>

                <View className={`rounded-full px-2.5 py-1 ${statusBadge.bg}`}>
                  <Text className={`text-xs font-medium ${statusBadge.text}`}>{statusBadge.label}</Text>
                </View>
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => markAttendance({ id: person.id, present: true })}
                  className="flex-1 rounded-xl py-3 items-center flex-row justify-center gap-1"
                  style={{
                    minHeight: 48,
                    backgroundColor: present === true ? '#DCFCE7' : '#F9FAFB',
                    borderWidth: 1,
                    borderColor: present === true ? '#22C55E' : '#E5E7EB',
                  }}
                >
                  <Ionicons name="checkmark-circle" size={16} color={present === true ? '#15803D' : '#9CA3AF'} />
                  <Text className="text-sm font-semibold" style={{ color: present === true ? '#15803D' : '#6B7280' }}>
                    Present
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => markAttendance({ id: person.id, present: false })}
                  className="flex-1 rounded-xl py-3 items-center flex-row justify-center gap-1"
                  style={{
                    minHeight: 48,
                    backgroundColor: present === false ? '#FEE2E2' : '#F9FAFB',
                    borderWidth: 1,
                    borderColor: present === false ? '#EF4444' : '#E5E7EB',
                  }}
                >
                  <Ionicons name="close-circle" size={16} color={present === false ? '#B91C1C' : '#9CA3AF'} />
                  <Text className="text-sm font-semibold" style={{ color: present === false ? '#B91C1C' : '#6B7280' }}>
                    Absent
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
