import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { LeaveTypeCard } from '../../src/components/leave/LeaveTypeCard';

type Balance = {
  casual: { used: number; total: number };
  medical: { used: number; total: number };
  privilege: { used: number; total: number };
};

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

export default function LeaveBalanceScreen() {
  const [year, setYear] = useState(CURRENT_YEAR);

  const { data: balance, isLoading } = useQuery({
    queryKey: ['leave-balance', year],
    queryFn: () =>
      api
        .get<Balance>(`/staff/leave-balance?year=${year}`)
        .catch((e) => {
          console.warn('[leave-balance] fetch failed', e?.message);
          return null;
        }),
  });

  const { data: leaves } = useQuery({
    queryKey: ['leave-history-recent', year],
    queryFn: () =>
      api
        .get<any[]>(`/staff/leaves?year=${year}`)
        .catch((e) => {
          console.warn('[leaves] fetch failed', e?.message);
          return [] as any[];
        }),
  });

  const recent = (leaves ?? []).slice(0, 5);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-4 pb-8">
          <TouchableOpacity onPress={() => router.back()} className="flex-row items-center mb-4">
            <Ionicons name="chevron-back" size={20} color="#821A52" />
            <Text className="text-primary-500 text-base ml-1">Back</Text>
          </TouchableOpacity>
          <View className="flex-row items-center mb-1">
            <View className="w-10 h-10 rounded-2xl bg-primary-50 items-center justify-center mr-3">
              <Ionicons name="airplane" size={20} color="#821A52" />
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-gray-900">Leave Balance</Text>
              <Text className="text-gray-500 text-sm">Track your remaining leaves</Text>
            </View>
          </View>

          {/* Year selector */}
          <View className="flex-row gap-2 mt-5 mb-5">
            {YEARS.map((y) => (
              <TouchableOpacity
                key={y}
                className={`px-3 py-1.5 rounded-full border ${
                  year === y ? 'bg-primary-500 border-primary-500' : 'bg-gray-50 border-gray-200'
                }`}
                onPress={() => setYear(y)}
              >
                <Text className={`text-xs font-medium ${year === y ? 'text-white' : 'text-gray-500'}`}>
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoading ? (
            <ActivityIndicator color="#821A52" />
          ) : !balance ? (
            <View className="bg-gray-50 rounded-2xl p-6 items-center border border-gray-200">
              <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                <Ionicons name="alert-circle" size={32} color="#821A52" />
              </View>
              <Text className="text-gray-500 text-sm">Balance unavailable</Text>
            </View>
          ) : (
            <>
              <LeaveTypeCard
                label="Casual Leave"
                type="CASUAL"
                used={balance.casual?.used ?? 0}
                total={balance.casual?.total ?? 0}
                color="#821A52"
              />
              <LeaveTypeCard
                label="Medical Leave"
                type="MEDICAL"
                used={balance.medical?.used ?? 0}
                total={balance.medical?.total ?? 0}
                color="#DC2626"
              />
              <LeaveTypeCard
                label="Privilege Leave"
                type="PRIVILEGE"
                used={balance.privilege?.used ?? 0}
                total={balance.privilege?.total ?? 0}
                color="#059669"
              />
            </>
          )}

          <View className="mt-6 mb-3 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900">Recent Leaves</Text>
            <TouchableOpacity onPress={() => router.push('/leave/history' as any)} className="flex-row items-center">
              <Text className="text-primary-500 text-xs font-semibold mr-1">View all</Text>
              <Ionicons name="chevron-forward" size={12} color="#821A52" />
            </TouchableOpacity>
          </View>

          {recent.length === 0 ? (
            <View className="bg-gray-50 rounded-2xl p-6 items-center border border-gray-200">
              <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                <Ionicons name="umbrella" size={32} color="#821A52" />
              </View>
              <Text className="text-gray-500 text-sm">No leaves taken yet</Text>
            </View>
          ) : (
            recent.map((l: any) => {
              const from = new Date(l.fromDate);
              const to = new Date(l.toDate);
              const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
              const statusBadge =
                l.status === 'APPROVED'
                  ? 'bg-green-100'
                  : l.status === 'REJECTED'
                  ? 'bg-red-100'
                  : 'bg-amber-100';
              const statusText =
                l.status === 'APPROVED'
                  ? 'text-green-700'
                  : l.status === 'REJECTED'
                  ? 'text-red-700'
                  : 'text-amber-700';
              return (
                <View key={l.id} className="bg-gray-50 rounded-2xl p-4 mb-2 flex-row items-center justify-between border border-gray-200">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-900">
                      {l.leaveType} · {days} day{days !== 1 ? 's' : ''}
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <View className={`rounded-full px-2.5 py-1 ${statusBadge}`}>
                    <Text className={`text-xs font-semibold ${statusText}`}>{l.status}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
