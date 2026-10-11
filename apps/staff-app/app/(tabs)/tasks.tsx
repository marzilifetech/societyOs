import { memo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../src/lib/i18n';
import { flatLabel, type ServiceRequest } from '@societyos/api-client';
import { getUnwrappedArray } from '../../src/lib/unwrapped-get';
import { ElapsedChip } from '../../src/components/task/ElapsedChip';
import { PriorityBadge } from '../../src/components/task/PriorityBadge';
import { TaskEmptyState } from '../../src/components/task/TaskEmptyState';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@societyos/theme';
import { Card, FilterChips, StatusChip } from '../../src/components/ui';
import { TASK_STATUS_TONES, toneFor } from '../../src/lib/status-theme';

const FILTER_IDS = ['all', 'pending', 'inProgress', 'completed'] as const;
type FilterId = (typeof FILTER_IDS)[number];
const FILTER_KEY = 'staff:tasks:filter';

/** Migrate from older builds that stored English chip labels. */
const LEGACY_TO_ID: Record<string, FilterId> = {
  All: 'all',
  Pending: 'pending',
  'In Progress': 'inProgress',
  Completed: 'completed',
};

const FILTER_MAP: Record<FilterId, string[]> = {
  all: [],
  pending: ['PENDING', 'ASSIGNED'],
  inProgress: ['IN_PROGRESS'],
  completed: ['COMPLETED'],
};

type TaskListItem = ServiceRequest;

function localeTag(lang: string) {
  return lang === 'en' ? 'en-IN' : `${lang}-IN`;
}

export default function TasksScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const [filter, setFilter] = useState<FilterId>('all');

  useEffect(() => {
    AsyncStorage.getItem(FILTER_KEY).then((v: string | null) => {
      if (!v) return;
      if ((FILTER_IDS as readonly string[]).includes(v)) setFilter(v as FilterId);
      else if (LEGACY_TO_ID[v]) setFilter(LEGACY_TO_ID[v]);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(FILTER_KEY, filter).catch(() => {});
  }, [filter]);

  const {
    data: tasks = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => getUnwrappedArray<TaskListItem>('/service-requests/assigned'),
  });

  const filtered = tasks.filter((task) => {
    const allowed = FILTER_MAP[filter];
    return allowed.length === 0 || allowed.includes(task.status);
  });

  const onRefresh = useCallback(() => refetch(), [refetch]);
  const renderTask = useCallback(({ item }: { item: TaskListItem }) => <TaskRow item={item} />, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <View className="px-6 pb-4 pt-6">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="font-heading text-2xl text-gray-900 dark:text-gray-100">
            {t('tasks.title')}
          </Text>
        </View>

        <FilterChips
          className="mb-2"
          options={FILTER_IDS.map((fid) => ({ id: fid, label: t(`tasks.filters.${fid}`) }))}
          selected={filter}
          onSelect={setFilter}
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      ) : filtered.length === 0 ? (
        <TaskEmptyState />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(task) => task.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
          renderItem={renderTask}
        />
      )}
    </SafeAreaView>
  );
}

/**
 * One task. "Start work" and "Mark complete" open the screens that take the
 * before/after photos — they used to change the status straight from the
 * list, which skipped the proof-of-work photos entirely.
 */
const TaskRow = memo(function TaskRow({ item }: { item: TaskListItem }) {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const loc = localeTag(i18nInstance.language);
  const statusKey = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'].includes(
    item.status,
  )
    ? item.status
    : 'PENDING';
  const statusLabel = t(`tasks.status.${statusKey}`);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => router.push(`/tasks/${item.id}` as any)}>
      <Card>
        <View className="mb-2 flex-row items-start justify-between">
          <View className="mr-3 flex-1">
            <Text className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              {item.category}
            </Text>
            {flatLabel(item.resident?.flat) ? (
              <Text className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                {item.resident?.user?.name ? `${item.resident.user.name} · ` : ''}
                {t('home.flat', { number: flatLabel(item.resident?.flat) })}
              </Text>
            ) : null}
          </View>
          <StatusChip tone={toneFor(TASK_STATUS_TONES, statusKey, 'PENDING')} label={statusLabel} />
        </View>

        <Text className="mb-3 text-sm leading-5 text-gray-600 dark:text-gray-400" numberOfLines={2}>
          {item.description}
        </Text>

        <View className="mb-3 flex-row items-center gap-2">
          <Text className="text-xs text-gray-400 dark:text-gray-500">
            {new Date(item.createdAt).toLocaleDateString(loc, {
              day: 'numeric',
              month: 'short',
            })}
          </Text>
          <PriorityBadge createdAt={item.createdAt} status={item.status} />
          {item.status === 'IN_PROGRESS' && <ElapsedChip taskId={item.id} />}
        </View>
        {(item as any).scheduledTime && (
          <View className="mb-3 flex-row items-center gap-1.5">
            <Text className="text-xs text-primary-500 dark:text-primary-400">
              Scheduled:{' '}
              {new Date((item as any).scheduledTime).toLocaleString(loc, {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}

        {item.status === 'ASSIGNED' && (
          <TouchableOpacity
            className="items-center rounded-full bg-amber-500 py-2.5 dark:bg-amber-600"
            onPress={() => router.push(`/tasks/${item.id}/start` as never)}
            accessibilityRole="button"
          >
            <Text className="font-semibold text-sm text-white">{t('tasks.startWork')}</Text>
          </TouchableOpacity>
        )}
        {item.status === 'IN_PROGRESS' && (
          <TouchableOpacity
            className="items-center rounded-full bg-green-500 py-2.5 dark:bg-green-600"
            onPress={() => router.push(`/tasks/${item.id}/complete` as never)}
            accessibilityRole="button"
          >
            <Text className="font-semibold text-sm text-white">{t('tasks.markComplete')}</Text>
          </TouchableOpacity>
        )}
      </Card>
    </TouchableOpacity>
  );
});
