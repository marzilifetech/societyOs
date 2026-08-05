import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { colors } from '@societyos/theme';
import i18nInstance from '../../src/lib/i18n';
import { api } from '../../src/lib/api';
import { AppHeader, EmptyState, FilterChips } from '../../src/components/ui';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
  APPROVED: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-100' },
  REJECTED: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100' },
};

const TYPE_LABELS: Record<string, string> = {
  CASUAL: 'Casual',
  SICK: 'Sick',
  MEDICAL: 'Medical',
  EARNED: 'Earned',
  PRIVILEGE: 'Privilege',
  EMERGENCY: 'Emergency',
};

const FILTERS = ['All', 'Pending', 'Approved', 'Rejected'] as const;
type Filter = typeof FILTERS[number];

export default function LeaveHistoryScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const [filter, setFilter] = useState<Filter>('All');

  const { data: leaves, isLoading } = useQuery({
    queryKey: ['leave-history'],
    queryFn: () =>
      api
        .get<any[]>('/staff/leaves')
        .catch((e) => {
          console.warn('[leaves] fetch failed', e?.message);
          return [] as any[];
        }),
  });

  const filtered = (leaves ?? []).filter((l) =>
    filter === 'All' ? true : l.status === filter.toUpperCase(),
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <AppHeader
        title={t('leave.historyTitle')}
        right={
          <TouchableOpacity
            className="bg-white/20 rounded-full px-4 py-2"
            onPress={() => router.push('/leave/new' as any)}
          >
            <Text className="text-white font-semibold text-sm">+ Request</Text>
          </TouchableOpacity>
        }
      />
      <View className="px-6 pt-4 pb-3">
        <FilterChips
          options={FILTERS.map((f) => ({ id: f, label: f }))}
          selected={filter}
          onSelect={setFilter}
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      ) : !filtered.length ? (
        <View className="flex-1 items-center justify-center">
          <EmptyState icon="calendar-outline" title="No leave requests yet" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(l) => l.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status] ?? STATUS_META.PENDING;
            const from = new Date(item.fromDate);
            const to = new Date(item.toDate);
            const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
            return (
              <View className="bg-white rounded-2xl p-4 shadow-sm">
                <View className="flex-row items-start justify-between mb-2">
                  <View>
                    <Text className="text-sm font-semibold text-gray-900">
                      {TYPE_LABELS[item.leaveType] ?? item.leaveType} Leave
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {days > 1 ? ` – ${to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                      {' '}· {days} day{days !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View className={`rounded-full px-2.5 py-1 ${meta.bg}`}>
                    <Text className={`text-xs font-semibold ${meta.color}`}>{meta.label}</Text>
                  </View>
                </View>
                {item.reason && (
                  <Text className="text-sm text-gray-500 leading-5" numberOfLines={2}>{item.reason}</Text>
                )}
                {item.status === 'REJECTED' && item.adminNote && (
                  <View className="mt-2 bg-red-50 rounded-xl px-3 py-2">
                    <Text className="text-xs text-red-500">Manager note:</Text>
                    <Text className="text-xs text-red-700 mt-0.5">{item.adminNote}</Text>
                  </View>
                )}
                {item.status !== 'REJECTED' && item.adminNote && (
                  <View className="mt-2 bg-gray-50 rounded-xl px-3 py-2">
                    <Text className="text-xs text-gray-400">Manager note:</Text>
                    <Text className="text-xs text-gray-700 mt-0.5">{item.adminNote}</Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
