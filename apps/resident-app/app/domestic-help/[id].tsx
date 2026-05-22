import { ScrollView, View, Text, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';


type DomHelper = {
  id: string;
  name: string;
  role: string;
  phone: string;
  gateAccess: boolean;
  photoUri?: string;
  lastPayment?: { amount: number; date: string };
  monthlyAttendance: Record<string, 'present' | 'absent' | 'holiday'>;
};

const DOT_COLOR: Record<string, string> = {
  present: '#22C55E',
  absent: '#EF4444',
  holiday: '#9CA3AF',
};

function AttendanceCalendar({ attendance }: { attendance: Record<string, 'present' | 'absent' | 'holiday'> }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const present = Object.values(attendance).filter((v) => v === 'present').length;
  const absent = Object.values(attendance).filter((v) => v === 'absent').length;
  const holiday = Object.values(attendance).filter((v) => v === 'holiday').length;

  return (
    <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4">
      <Text className="text-gray-900 text-base font-bold mb-3">
        {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-3">
        {days.map((day) => {
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const status = attendance[key];
          return (
            <View key={day} className="items-center" style={{ width: 36 }}>
              <Text className="text-gray-500 text-xs mb-1">{day}</Text>
              <View
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: status ? DOT_COLOR[status] : '#E5E7EB' }}
              />
            </View>
          );
        })}
      </View>
      <View className="flex-row gap-4">
        <View className="flex-row items-center gap-1">
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: '#22C55E' }} />
          <Text className="text-gray-500 text-xs">Present: {present}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: '#EF4444' }} />
          <Text className="text-gray-500 text-xs">Absent: {absent}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: '#9CA3AF' }} />
          <Text className="text-gray-500 text-xs">Holiday: {holiday}</Text>
        </View>
      </View>
    </View>
  );
}

export default function DomesticHelpDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [showSalary, setShowSalary] = useState(false);
  const [salaryAmount, setSalaryAmount] = useState('');

  const { data, isLoading, isError, refetch } = useQuery<DomHelper>({
    queryKey: ['domestic-help', id],
    queryFn: () => api.get<DomHelper>(`/domestic-help/${id}`),
  });

  const { mutate: remove, isPending: removing } = useMutation({
    mutationFn: () => api.delete(`/domestic-help/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domestic-help'] });
      router.back();
    },
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not remove.'),
  });

  const salaryMutation = useMutation({
    mutationFn: (amount: number) => api.post(`/domestic-help/${id}/salary`, { amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domestic-help', id] });
      qc.invalidateQueries({ queryKey: ['domestic-help'] });
      setShowSalary(false);
      setSalaryAmount('');
      Alert.alert('Logged', 'Salary payment recorded.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not log salary.'),
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 flex-1">{data?.name ?? 'Helper'}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {isLoading && (
          <>
            <View className="bg-gray-50 border border-gray-200 rounded-2xl h-32 mb-4" />
            <View className="bg-gray-50 border border-gray-200 rounded-2xl h-48 mb-4" />
          </>
        )}
        {isError && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-6 items-center">
            <Text className="text-gray-500 mb-3">Could not load data</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        {data && (
          <>
            {/* Profile card */}
            <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex-row items-center mb-4">
              <View className="w-16 h-16 rounded-full bg-primary-50 items-center justify-center mr-4">
                <Ionicons name="person" size={32} color="#821A52" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 text-xl font-bold">{data.name}</Text>
                <Text className="text-gray-500 text-sm">{data.role}</Text>
                <View className="flex-row items-center gap-1 mt-0.5">
                  <Ionicons name="call-outline" size={12} color="#6B7280" />
                  <Text className="text-gray-500 text-sm">{data.phone}</Text>
                </View>
                <View className="flex-row items-center mt-1 gap-1">
                  <Ionicons
                    name={data.gateAccess ? 'checkmark-circle' : 'close-circle'}
                    size={12}
                    color={data.gateAccess ? '#22C55E' : '#9CA3AF'}
                  />
                  <Text className="text-gray-500 text-xs">{data.gateAccess ? 'Gate access enabled' : 'No gate access'}</Text>
                </View>
              </View>
            </View>

            <AttendanceCalendar attendance={data.monthlyAttendance} />

            {/* Salary */}
            <View className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-4">
              <Text className="text-gray-900 text-base font-bold mb-2">Salary</Text>
              {data.lastPayment ? (
                <Text className="text-gray-500 text-sm">
                  Last paid ₹{data.lastPayment.amount} on {new Date(data.lastPayment.date).toLocaleDateString()}
                </Text>
              ) : (
                <Text className="text-gray-500 text-sm">No payment recorded</Text>
              )}
              {!showSalary ? (
                <TouchableOpacity
                  onPress={() => setShowSalary(true)}
                  className="bg-primary-500 rounded-xl py-3 mt-3 items-center"
                  style={{ minHeight: 48 }}
                  accessibilityRole="button"
                  accessibilityLabel="Log salary payment"
                >
                  <Text className="text-white font-semibold">Log Payment</Text>
                </TouchableOpacity>
              ) : (
                <View className="mt-3">
                  <Text className="text-gray-500 text-xs font-semibold mb-2 uppercase">Amount paid (₹)</Text>
                  <TextInput
                    value={salaryAmount}
                    onChangeText={setSalaryAmount}
                    placeholder="e.g. 5000"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 text-base mb-3"
                    style={{ minHeight: 52 }}
                  />
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => { setShowSalary(false); setSalaryAmount(''); }}
                      className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
                      style={{ minHeight: 48 }}
                    >
                      <Text className="text-gray-600 font-medium">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const n = parseInt(salaryAmount, 10);
                        if (Number.isNaN(n) || n <= 0) {
                          Alert.alert('Required', 'Enter a valid amount.');
                          return;
                        }
                        salaryMutation.mutate(n);
                      }}
                      disabled={salaryMutation.isPending}
                      className="flex-1 bg-primary-500 rounded-xl py-3 items-center"
                      style={{ minHeight: 48 }}
                    >
                      {salaryMutation.isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="text-white font-semibold">Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Actions */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push(`/domestic-help/${id}/attendance` as any)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl py-4 items-center flex-row justify-center gap-2"
                style={{ minHeight: 56 }}
              >
                <Ionicons name="checkmark-circle" size={18} color="#374151" />
                <Text className="text-gray-700 font-semibold">Attendance</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert('Remove', 'Remove this helper?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => remove() },
                  ])
                }
                disabled={removing}
                className="flex-1 bg-red-100 border border-red-200 rounded-xl py-4 items-center flex-row justify-center gap-2"
                style={{ minHeight: 56 }}
              >
                <Ionicons name="trash-outline" size={18} color="#B91C1C" />
                <Text className="text-red-700 font-semibold">Remove</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
