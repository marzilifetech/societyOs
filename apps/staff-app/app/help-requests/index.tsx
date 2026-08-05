import { useMemo, type ComponentProps } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@societyos/theme';
import i18nInstance from '../../src/lib/i18n';
import { api } from '../../src/lib/api';
import { ErrorCard } from '../../src/components/ErrorCard';
import { AppHeader, Card, EmptyState } from '../../src/components/ui';

export interface HelpRequest {
  id: string;
  category: 'HELP_HEAVY' | 'HELP_DOCUMENT' | 'HELP_PACKAGE' | string;
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | string;
  description?: string;
  createdAt: string;
  resident?: { name?: string; flat?: string };
}

type CategoryIcon = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, CategoryIcon> = {
  HELP_HEAVY: 'cube-outline',
  HELP_DOCUMENT: 'document-text-outline',
  HELP_PACKAGE: 'gift-outline',
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
      <AppHeader title={t('helpRequests.title')} />

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
            <Card padding="none" className="mt-4">
              <EmptyState icon="hand-left-outline" title="No help requests yet" />
            </Card>
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
          <View className="w-11 h-11 rounded-full bg-primary-50 items-center justify-center">
            <Ionicons name={ICONS[r.category] ?? 'help-buoy-outline'} size={20} color={colors.primary[500]} />
          </View>
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
