import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@societyos/theme';
import { flatLabel } from '@societyos/api-client';
import i18nInstance from '../../src/lib/i18n';
import { ErrorCard } from '../../src/components/ErrorCard';
import { AppHeader, Card, EmptyState } from '../../src/components/ui';
import {
  HELP_REQUESTS_KEY,
  HELP_TYPE_ICONS,
  fetchHelpRequests,
  helpTypeLabel,
  isMineActive,
  isUnclaimed,
  type HelpRequestRow,
} from '../../src/lib/help-requests';

export default function HelpRequestsScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: HELP_REQUESTS_KEY,
    queryFn: fetchHelpRequests,
    refetchInterval: 60_000,
  });

  const groups = useMemo(() => {
    const list = data ?? [];
    return {
      waiting: list.filter(isUnclaimed),
      mine: list.filter(isMineActive),
      done: list.filter((r) => r.status === 'COMPLETED'),
    };
  }, [data]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title={t('helpRequests.title')} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      ) : isError ? (
        <ErrorCard
          message="Help requests couldn't be loaded."
          detail={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-5 gap-5"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
        >
          <Section title="Waiting for someone" items={groups.waiting} />
          <Section title="Yours" items={groups.mine} />
          <Section title="Done" items={groups.done} />
          {(data ?? []).length === 0 ? (
            <Card padding="none">
              <EmptyState
                icon="hand-left-outline"
                title="No help requests right now"
                body="You'll get a notification when a resident needs a hand."
              />
            </Card>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({ title, items }: { title: string; items: HelpRequestRow[] }) {
  if (items.length === 0) return null;
  return (
    <View className="gap-2">
      <Text className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {title} ({items.length})
      </Text>
      {items.map((r) => (
        <HelpRequestCard key={r.id} request={r} />
      ))}
    </View>
  );
}

function HelpRequestCard({ request: r }: { request: HelpRequestRow }) {
  const flat = flatLabel(r.resident?.flat);
  return (
    <TouchableOpacity
      onPress={() => router.push(`/help-requests/${r.id}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`${helpTypeLabel(r.type)} for ${r.resident?.user?.name ?? 'a resident'}`}
    >
      <Card className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/50">
          <Ionicons name={HELP_TYPE_ICONS[r.type] ?? 'help-buoy-outline'} size={20} color={colors.primary[500]} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">{helpTypeLabel(r.type)}</Text>
          <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
            {r.resident?.user?.name ?? 'Resident'}
            {flat ? ` · Flat ${flat}` : ''}
          </Text>
          <Text className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            {new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <StatusBadge request={r} />
      </Card>
    </TouchableOpacity>
  );
}

function StatusBadge({ request }: { request: HelpRequestRow }) {
  const s = isUnclaimed(request)
    ? { bg: 'bg-amber-100', text: 'text-amber-700', label: 'New' }
    : request.status === 'IN_PROGRESS'
      ? { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'In progress' }
      : request.status === 'COMPLETED'
        ? { bg: 'bg-green-100', text: 'text-green-700', label: 'Done' }
        : { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Yours' };
  return (
    <View className={`rounded-full px-2.5 py-1 ${s.bg}`}>
      <Text className={`text-xs font-semibold ${s.text}`}>{s.label}</Text>
    </View>
  );
}
