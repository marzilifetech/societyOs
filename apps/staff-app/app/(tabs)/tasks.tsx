import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../src/lib/i18n';
import * as Haptics from 'expo-haptics';
import type { ServiceRequest } from '@societyos/api-client';
import { api } from '../../src/lib/api';
import { getUnwrappedArray } from '../../src/lib/unwrapped-get';
import { useTimerStore } from '../../src/store/timer.store';
import { ElapsedChip } from '../../src/components/task/ElapsedChip';
import { PriorityBadge } from '../../src/components/task/PriorityBadge';
import { TaskEmptyState } from '../../src/components/task/TaskEmptyState';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';

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

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  PENDING: { color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-950/60' },
  ASSIGNED: { color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-950/60' },
  IN_PROGRESS: { color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-950/60' },
  COMPLETED: { color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-950/60' },
  REJECTED: { color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-950/60' },
};

const FILTER_MAP: Record<FilterId, string[]> = {
  all: [],
  pending: ['PENDING', 'ASSIGNED'],
  inProgress: ['IN_PROGRESS'],
  completed: ['COMPLETED'],
};

type TaskListItem = ServiceRequest & { lat?: number; lng?: number };

function localeTag(lang: string) {
  return lang === 'en' ? 'en-IN' : `${lang}-IN`;
}

export default function TasksScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterId>('all');
  const [view, setView] = useState<'list' | 'map'>('list');
  const startTimer = useTimerStore((s) => s.start);

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

  const { data: tasks = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => getUnwrappedArray<TaskListItem>('/service-requests/assigned'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/service-requests/${id}/status`, { status }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      if (vars.status === 'IN_PROGRESS') {
        startTimer(vars.id);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    },
    onError: (err) =>
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.error')),
  });

  const filtered = tasks.filter((task) => {
    const allowed = FILTER_MAP[filter];
    return allowed.length === 0 || allowed.includes(task.status);
  });

  const onRefresh = useCallback(() => refetch(), [refetch]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <View className="px-6 pt-6 pb-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('tasks.title')}</Text>
          <View className="flex-row bg-gray-200 dark:bg-gray-800 rounded-full p-0.5">
            <TouchableOpacity
              className={`px-3 py-1 rounded-full ${view === 'list' ? 'bg-white dark:bg-gray-900' : ''}`}
              onPress={() => setView('list')}
            >
              <Text className="text-xs font-semibold text-gray-700 dark:text-gray-200">{t('tasks.list')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`px-3 py-1 rounded-full ${view === 'map' ? 'bg-white dark:bg-gray-900' : ''}`}
              onPress={() => setView('map')}
            >
              <Text className="text-xs font-semibold text-gray-700 dark:text-gray-200">{t('tasks.map')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row gap-2 mb-2">
          {FILTER_IDS.map((fid) => (
            <TouchableOpacity
              key={fid}
              className={`px-3 py-1.5 rounded-full border ${
                filter === fid
                  ? 'bg-primary-500 dark:bg-primary-600 border-primary-500 dark:border-primary-600'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
              }`}
              onPress={() => setFilter(fid)}
            >
              <Text
                className={`text-xs font-medium ${filter === fid ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}
              >
                {t(`tasks.filters.${fid}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" />
        </View>
      ) : view === 'map' ? (
        <MapTaskView tasks={filtered} />
      ) : filtered.length === 0 ? (
        <TaskEmptyState />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(task) => task.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <TaskRow
              item={item}
              onUpdate={(status) => updateMutation.mutate({ id: item.id, status })}
              loading={updateMutation.isPending}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function TaskRow({
  item,
  onUpdate,
  loading,
}: {
  item: TaskListItem;
  onUpdate: (status: string) => void;
  loading: boolean;
}) {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const loc = localeTag(i18nInstance.language);
  const style = STATUS_STYLE[item.status] ?? STATUS_STYLE.PENDING;
  const statusKey = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'].includes(item.status)
    ? item.status
    : 'PENDING';
  const statusLabel = t(`tasks.status.${statusKey}`);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/tasks/${item.id}` as any)}
      className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-transparent dark:border-gray-800"
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-3">
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.category}</Text>
          {item.unit && (
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {t('home.flat', { number: item.unit.flatNumber })}
            </Text>
          )}
        </View>
        <View className={`rounded-full px-2.5 py-1 ${style.bg}`}>
          <Text className={`text-xs font-semibold ${style.color}`}>{statusLabel}</Text>
        </View>
      </View>

      <Text className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-5" numberOfLines={2}>
        {item.description}
      </Text>

      <View className="flex-row items-center gap-2 mb-3">
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
        <View className="flex-row items-center gap-1.5 mb-3">
          <Text className="text-xs text-primary-500 dark:text-primary-400">
            Scheduled: {new Date((item as any).scheduledTime).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}

      {item.status === 'ASSIGNED' && (
        <TouchableOpacity
          className="bg-amber-500 dark:bg-amber-600 rounded-xl py-2.5 items-center"
          onPress={() => onUpdate('IN_PROGRESS')}
          disabled={loading}
        >
          <Text className="text-white font-semibold text-sm">{t('tasks.startWork')}</Text>
        </TouchableOpacity>
      )}
      {item.status === 'IN_PROGRESS' && (
        <TouchableOpacity
          className="bg-green-500 dark:bg-green-600 rounded-xl py-2.5 items-center"
          onPress={() =>
            Alert.alert(t('tasks.completeTitle'), t('tasks.completeConfirm'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('tasks.completeAction'), onPress: () => onUpdate('COMPLETED') },
            ])
          }
          disabled={loading}
        >
          <Text className="text-white font-semibold text-sm">{t('tasks.markComplete')}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

type TaskWithCoords = TaskListItem & { lat: number; lng: number };

function MapTaskView({ tasks }: { tasks: TaskListItem[] }) {
  const withCoords: TaskWithCoords[] = tasks.filter(
    (task): task is TaskWithCoords => typeof task.lat === 'number' && typeof task.lng === 'number',
  );
  const first = withCoords[0];
  const initial = first
    ? { latitude: first.lat, longitude: first.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : { latitude: 12.97, longitude: 77.59, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  return (
    <View className="flex-1">
      <MapView style={{ flex: 1 }} initialRegion={initial}>
        {withCoords.map((task) => (
          <Marker
            key={task.id}
            coordinate={{ latitude: task.lat, longitude: task.lng }}
            title={task.category}
            description={task.description}
            onCalloutPress={() => router.push(`/tasks/${task.id}` as any)}
          />
        ))}
      </MapView>
    </View>
  );
}
