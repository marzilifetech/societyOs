import { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../src/lib/i18n';
import { api } from '../../src/lib/api';
import { ErrorCard } from '../../src/components/ErrorCard';

export interface HelpRequest {
  id: string;
  category: 'HELP_HEAVY' | 'HELP_DOCUMENT' | 'HELP_PACKAGE' | string;
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | string;
  description?: string;
  createdAt: string;
  resident?: { name?: string; flat?: string };
}

const ICONS: Record<string, string> = {
  HELP_HEAVY: '📦',
  HELP_DOCUMENT: '📄',
  HELP_PACKAGE: '🎁',
};

const LABELS: Record<string, string> = {
  HELP_HEAVY: 'Heavy item',
  HELP_DOCUMENT: 'Document collection',
  HELP_PACKAGE: 'Package pickup',
};

export default function HelpRequestsScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['help-requests'],
    queryFn: () => api.get<HelpRequest[]>('/staff/help-requests'),
  });

  const grouped = useMemo(() => {
    const list = data ?? [];
    return {
      active: list.filter((r) => r.status !== 'COMPLETED'),
      completed: list.filter((r) => r.status === 'COMPLETED'),
    };
  }, [data]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-primary-500 dark:bg-primary-900 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">{t('helpRequests.title')}</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <ErrorCard
          message="Help requests couldn't be loaded. Please try again."
          onRetry={() => refetch()}
        />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4">
          <Section title={`Active (${grouped.active.length})`} items={grouped.active} />
          <Section title={`Completed (${grouped.completed.length})`} items={grouped.completed} />
          {(data ?? []).length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center mt-4">
              <Text className="text-5xl mb-3">🙋</Text>
              <Text className="text-gray-700 font-semibold text-base">No help requests yet</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({ title, items }: { title: string; items: HelpRequest[] }) {
  if (items.length === 0) return null;
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">{title}</Text>
      {items.map((r) => (
        <TouchableOpacity
          key={r.id}
          onPress={() => router.push(`/help-requests/${r.id}` as any)}
          className="bg-white rounded-2xl p-4 flex-row items-center gap-3 shadow-sm"
        >
          <Text className="text-3xl">{ICONS[r.category] ?? '🆘'}</Text>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900">{LABELS[r.category] ?? r.category}</Text>
            <Text className="text-xs text-gray-500 mt-0.5">
              {r.resident?.name ?? 'Resident'} · {r.resident?.flat ?? '—'}
            </Text>
            <Text className="text-xs text-gray-400 mt-0.5">
              {new Date(r.createdAt).toLocaleString()}
            </Text>
          </View>
          <StatusBadge status={r.status} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'New' },
    ASSIGNED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Assigned' },
    IN_PROGRESS: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'In Progress' },
    COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Done' },
  };
  const s = map[status] ?? { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
  return (
    <View className={`px-2.5 py-1 rounded-full ${s.bg}`}>
      <Text className={`text-xs font-semibold ${s.text}`}>{s.label}</Text>
    </View>
  );
}
