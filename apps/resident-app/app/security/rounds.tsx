import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type Checkpoint = {
  name: string;
  scannedAt: string;
};

type Round = {
  id: string;
  startedAt: string;
  completedAt?: string;
  checkpoints: Checkpoint[];
  status: 'COMPLETED' | 'IN_PROGRESS';
  officerName: string;
};

const STATUS_META: Record<string, { bgClass: string; textClass: string; label: string }> = {
  COMPLETED:   { bgClass: 'bg-green-100', textClass: 'text-green-700', label: 'Completed' },
  IN_PROGRESS: { bgClass: 'bg-orange-100', textClass: 'text-orange-700', label: 'In Progress' },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SecurityRoundsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery<Round[]>({
    queryKey: ['security-rounds'],
    queryFn: () => api.get<Round[]>('/security/rounds'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="min-h-[48px] justify-center mr-3">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Security Rounds</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}
      >
        {isLoading && [1, 2, 3].map((i) => (
          <View key={i} className="bg-gray-50 rounded-2xl h-[110px] mb-3.5" />
        ))}

        {isError && (
          <View className="bg-gray-50 rounded-2xl border border-gray-200 p-6 items-center mt-4">
            <Text className="text-gray-500 text-base mb-3">Could not load security rounds</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-2xl px-6 py-3 min-h-[48px] justify-center">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <View className="items-center mt-12 px-6">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="lock-closed" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 font-semibold text-lg">No security rounds logged</Text>
            <Text className="text-gray-400 text-sm text-center mt-2">Security round logs will appear here</Text>
          </View>
        )}

        {data?.map((round: Round) => {
          const meta = STATUS_META[round.status] ?? STATUS_META.IN_PROGRESS;
          const isOpen = expanded.has(round.id);
          return (
            <View key={round.id} className="bg-gray-50 rounded-2xl border border-gray-200 mb-3.5 overflow-hidden">
              <TouchableOpacity
                onPress={() => toggleExpand(round.id)}
                className="p-4 min-h-[48px]"
                activeOpacity={0.7}
              >
                <View className="flex-row justify-between items-start">
                  <View className="w-9 h-9 rounded-lg bg-primary-50 items-center justify-center mr-3">
                    <Ionicons name="walk" size={18} color="#821A52" />
                  </View>
                  <View className="flex-1 mr-2">
                    <Text className="text-gray-900 text-base font-bold">{round.officerName}</Text>
                    <View className="flex-row items-center mt-1">
                      <Ionicons name="time" size={12} color="#9CA3AF" />
                      <Text className="text-gray-500 text-xs ml-1">
                        {fmtDate(round.startedAt)} · {fmtTime(round.startedAt)}
                        {round.completedAt ? ` – ${fmtTime(round.completedAt)}` : ''}
                      </Text>
                    </View>
                    <Text className="text-gray-400 text-xs mt-1">
                      {round.checkpoints?.length ?? 0} checkpoint{round.checkpoints?.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View className="items-end gap-2">
                    <View className={`${meta.bgClass} rounded-lg px-2.5 py-1`}>
                      <Text className={`${meta.textClass} text-xs font-bold`}>{meta.label}</Text>
                    </View>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
                  </View>
                </View>
              </TouchableOpacity>

              {isOpen && round.checkpoints?.length > 0 && (
                <View className="border-t border-gray-200 px-4 pb-3">
                  <Text className="text-gray-400 text-xs font-bold mt-3 mb-2">CHECKPOINTS</Text>
                  {round.checkpoints.map((cp: Checkpoint, idx: number) => (
                    <View key={idx} className={`flex-row justify-between py-1.5 ${idx < round.checkpoints.length - 1 ? 'border-b border-gray-200' : ''}`}>
                      <View className="flex-row items-center">
                        <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                        <Text className="text-gray-900 text-sm ml-2">{cp.name}</Text>
                      </View>
                      <Text className="text-gray-400 text-sm">{fmtTime(cp.scannedAt)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {isOpen && (!round.checkpoints || round.checkpoints.length === 0) && (
                <View className="border-t border-gray-200 p-4">
                  <Text className="text-gray-400 text-sm text-center">No checkpoint data</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
