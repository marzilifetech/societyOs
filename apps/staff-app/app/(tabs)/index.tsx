import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../src/lib/i18n';
import { useQuery } from '@tanstack/react-query';
import type { ServiceRequest } from '@societyos/api-client';
import { useAuthStore } from '../../src/store/auth.store';
import { api } from '../../src/lib/api';
import { getUnwrapped, getUnwrappedArray } from '../../src/lib/unwrapped-get';
import { unwrapApiEnvelope } from '@societyos/api-client';
import { SkeletonCard, SkeletonRow } from '../../src/components/attendance/SkeletonCard';
import { ErrorCard } from '../../src/components/ErrorCard';

type StaffHomeSummary = {
  checkedIn?: boolean;
  checkInTime?: string;
};

type TodayShift = {
  startTime?: string;
  endTime?: string;
  role?: string;
};

type AssignedTask = ServiceRequest & { completedAt?: string | null };

function taskStatusStyleKey(status: string): 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' {
  if (status === 'ASSIGNED' || status === 'IN_PROGRESS') return status;
  return 'PENDING';
}

export default function StaffHomeScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const user = useAuthStore((s) => s.user);
  const [sosNoteOpen, setSosNoteOpen] = useState(false);
  const [sosAlertId, setSosAlertId] = useState<string | null>(null);
  const [sosSending, setSosSending] = useState(false);
  const [sosNote, setSosNote] = useState('');

  const { data: summary, isLoading: loadingSummary, isError: summaryError, isFetching: fetchingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['staff-summary'],
    queryFn: () => getUnwrapped<StaffHomeSummary>('/staff/summary'),
    enabled: !!user,
    retry: false,
    refetchOnMount: true,
  });

  const { data: staffProfile } = useQuery<{ designation?: string }>({
    queryKey: ['staff-profile-brief'],
    queryFn: () => getUnwrapped<{ designation?: string }>('/staff/profile'),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const isDoctor = staffProfile?.designation === 'DOCTOR';

  const { data: myTasks = [], isLoading: loadingTasks, isError: tasksError, isFetching: fetchingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => getUnwrappedArray<AssignedTask>('/service-requests/assigned'),
    enabled: !!user,
    retry: false,
    refetchOnMount: true,
  });

  const { data: todayShifts = [] } = useQuery({
    queryKey: ['shifts-today'],
    queryFn: () =>
      getUnwrappedArray<TodayShift>('/staff/shifts?range=today').catch(() => [] as TodayShift[]),
    enabled: !!user,
  });

  const sendSosImmediate = async () => {
    if (sosSending) return;
    setSosSending(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        } catch {
          // continue without coordinates
        }
      }
      const body: { lat?: number; lng?: number } = {};
      if (lat != null) body.lat = lat;
      if (lng != null) body.lng = lng;
      const raw = await api.post<object>('/sos/staff', body);
      const alert = unwrapApiEnvelope<{ id: string }>(raw);
      setSosAlertId(alert.id);
      setSosNote('');
      setSosNoteOpen(true);
    } catch {
      Alert.alert(t('home.alertSosFailTitle'), t('home.alertSosFailBody'));
    } finally {
      setSosSending(false);
    }
  };

  const submitSosNoteUpdate = async () => {
    const id = sosAlertId;
    const text = sosNote.trim();
    if (!id) {
      setSosNoteOpen(false);
      return;
    }
    if (!text) {
      setSosNoteOpen(false);
      setSosAlertId(null);
      return;
    }
    try {
      await api.patch(`/sos/${id}/note`, { note: text });
      Alert.alert(t('home.alertNoteSentTitle'), t('home.alertNoteSentBody'));
    } catch {
      Alert.alert(t('home.alertNoteFailTitle'), t('home.alertNoteFailBody'));
    } finally {
      setSosNoteOpen(false);
      setSosAlertId(null);
      setSosNote('');
    }
  };

  const skipSosNote = () => {
    setSosNoteOpen(false);
    setSosAlertId(null);
    setSosNote('');
  };

  const pendingTasks = myTasks.filter((task) => task.status !== 'COMPLETED' && task.status !== 'REJECTED');
  const doneToday = myTasks.filter((task) => {
    if (task.status !== 'COMPLETED' || !task.completedAt) return false;
    const d = new Date(task.completedAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;
  const totalToday = pendingTasks.length + doneToday;

  if (summaryError && tasksError && !fetchingSummary && !fetchingTasks) {
    return (
      <ErrorCard
        message={t('home.loadError')}
        onRetry={() => { refetchSummary(); refetchTasks(); }}
      />
    );
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('home.greeting.morning');
    if (h < 17) return t('home.greeting.afternoon');
    return t('home.greeting.evening');
  };

  const todayShift = todayShifts?.[0];
  const weatherIcon = (() => {
    const h = new Date().getHours();
    if (h < 6) return '🌙';
    if (h < 11) return '🌤️';
    if (h < 17) return '☀️';
    return '🌆';
  })();

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-primary-500 dark:bg-primary-900 px-6 pt-4 pb-8">
          <Text className="text-blue-200 dark:text-blue-300 text-sm">{greeting()},</Text>
          <Text className="text-white text-2xl font-bold mt-0.5">{user?.name ?? t('home.staffFallback')}</Text>
          <Text className="text-blue-300 dark:text-blue-200 text-sm mt-1">{user?.department ?? user?.role}</Text>
        </View>

        {/* Daily briefing card (Task 1) */}
        <View className="px-6 -mt-4 mb-4">
          <View className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 border border-transparent dark:border-gray-800">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('home.briefingTitle')}</Text>
              <Text className="text-2xl">{weatherIcon}</Text>
            </View>
            {loadingSummary ? (
              <SkeletonCard height={60} />
            ) : (
              <View>
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {todayShift
                    ? t('home.shiftScheduled', {
                        start: todayShift.startTime ?? '09:00',
                        end: todayShift.endTime ?? '18:00',
                      })
                    : t('home.noShift')}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('home.pendingDoneToday', { pending: pendingTasks.length, done: doneToday })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Mini-stats row (Task 2) */}
        <View className="px-6 mb-4">
          {loadingSummary ? (
            <SkeletonRow />
          ) : (
            <View className="flex-row gap-3">
              <MiniStat label={t('home.statTasks')} value={String(totalToday)} />
              <MiniStat label={t('home.statDone')} value={String(doneToday)} tone="green" />
              <MiniStat label={t('home.statPending')} value={String(pendingTasks.length)} tone="amber" />
            </View>
          )}
        </View>

        {/* Check-in CTA */}
        <View className="px-6 mb-4">
          <View className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 flex-row items-center justify-between border border-transparent dark:border-gray-800">
            <View>
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {summary?.checkedIn ? t('home.checkedIn') : t('home.notCheckedIn')}
              </Text>
              {summary?.checkedIn && summary?.checkInTime && (
                <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {t('home.since', {
                    time: new Date(summary.checkInTime).toLocaleTimeString(
                      i18nInstance.language === 'en' ? 'en-IN' : `${i18nInstance.language}-IN`,
                      { hour: '2-digit', minute: '2-digit' },
                    ),
                  })}
                </Text>
              )}
            </View>
            <TouchableOpacity
              className="bg-primary-500 dark:bg-primary-600 rounded-xl px-5 py-2.5"
              onPress={() => router.push('/(tabs)/attendance' as any)}
            >
              <Text className="text-white font-semibold text-sm">
                {summary?.checkedIn ? t('home.checkOut') : t('home.checkIn')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming shift card (Task 5) */}
        {todayShift && (
          <View className="px-6 mb-4">
            <View className="bg-blue-50 dark:bg-blue-950/80 rounded-2xl p-4 border border-blue-100 dark:border-blue-900">
              <Text className="text-xs text-blue-700 dark:text-blue-300 font-semibold mb-1">{t('home.upcomingShift')}</Text>
              <Text className="text-base font-bold text-gray-900 dark:text-gray-100">
                {todayShift.role ?? t('home.shiftFallback')}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {todayShift.startTime ?? '09:00'} – {todayShift.endTime ?? '18:00'}
              </Text>
              <TouchableOpacity
                className="mt-3 self-start"
                onPress={() => router.push('/attendance/shifts' as any)}
              >
                <Text className="text-xs font-semibold text-blue-700 dark:text-blue-400">{t('home.viewAllShifts')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quick actions grid (Task 3) */}
        <View className="px-6 mb-4">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('home.quickActions')}</Text>
          <View className="flex-row flex-wrap gap-3">
            <QuickAction icon="🕐" label={t('home.actionCheckIn')} onPress={() => router.push('/(tabs)/attendance' as any)} />
            <QuickAction icon="🔧" label={t('home.actionViewTasks')} onPress={() => router.push('/(tabs)/tasks' as any)} />
            <QuickAction icon="📷" label={t('home.actionGateScan')} onPress={() => router.push('/scan/qr' as any)} />
            <QuickAction icon="📅" label={t('home.actionApplyLeave')} onPress={() => router.push('/leave/new' as any)} />
            <QuickAction icon="⭐" label={t('home.actionMyReviews')} onPress={() => router.push('/reviews' as any)} />
            <QuickAction icon="📢" label="Notices" onPress={() => router.push('/welfare' as any)} />
          </View>
        </View>

        {/* Doctor Portal */}
        {isDoctor && (
          <View className="px-6 mb-4">
            <TouchableOpacity
              className="rounded-2xl p-4 flex-row items-center justify-between"
              style={{ backgroundColor: '#0D1F35', borderWidth: 1, borderColor: '#821A52' }}
              onPress={() => router.push('/doctor' as any)}
            >
              <View>
                <Text className="text-white font-semibold text-base">Doctor Portal</Text>
                <Text style={{ color: '#6B9CC8', fontSize: 12, marginTop: 2 }}>Appointments & availability</Text>
              </View>
              <Text style={{ color: '#3B82F6', fontSize: 22 }}>⚕️</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Active tasks */}
        <View className="px-6 pb-32">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('home.activeTasks')}</Text>
          {loadingTasks ? (
            <ActivityIndicator color="#821A52" />
          ) : pendingTasks.length === 0 ? (
            <View className="bg-white dark:bg-gray-900 rounded-2xl p-6 items-center border border-transparent dark:border-gray-800">
              <Text className="text-gray-400 dark:text-gray-500 text-sm">{t('home.noActiveTasks')}</Text>
            </View>
          ) : (
            <View className="gap-3">
              {pendingTasks.slice(0, 5).map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              {pendingTasks.length > 5 && (
                <TouchableOpacity
                  className="items-center py-3"
                  onPress={() => router.push('/(tabs)/tasks' as any)}
                >
                  <Text className="text-primary-500 dark:text-primary-400 text-sm font-medium">
                    {t('home.viewAllTasks', { count: pendingTasks.length })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* SOS: send immediately with location; optional note is a follow-up PATCH */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 bg-red-500 rounded-full w-14 h-14 items-center justify-center shadow-lg"
        onPress={sendSosImmediate}
        disabled={sosSending}
      >
        {sosSending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-bold text-xs">SOS</Text>
        )}
      </TouchableOpacity>

      <Modal visible={sosNoteOpen} transparent animationType="fade" onRequestClose={skipSosNote}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white dark:bg-gray-900 rounded-t-3xl px-6 pt-6 pb-8 border-t border-gray-100 dark:border-gray-800">
              <Text className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{t('home.sosModalTitle')}</Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('home.sosModalBody')}</Text>
              <Text className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">{t('home.noteOptional')}</Text>
              <TextInput
                className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 min-h-[100px]"
                placeholder={t('home.sosNotePlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={sosNote}
                onChangeText={setSosNote}
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />
              <View className="flex-row gap-3 mt-5">
                <TouchableOpacity
                  className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl py-3 items-center"
                  onPress={skipSosNote}
                >
                  <Text className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('home.skip')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-primary-500 dark:bg-primary-600 rounded-xl py-3 items-center"
                  onPress={() => submitSosNoteUpdate()}
                  disabled={sosNote.trim().length === 0}
                >
                  <Text className={`text-sm font-semibold ${sosNote.trim().length === 0 ? 'text-gray-400' : 'text-white'}`}>
                    {t('home.sendNote')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'amber' }) {
  const bg =
    tone === 'green'
      ? 'bg-green-50 dark:bg-green-950/50'
      : tone === 'amber'
        ? 'bg-amber-50 dark:bg-amber-950/50'
        : 'bg-white dark:bg-gray-900';
  const txt =
    tone === 'green'
      ? 'text-green-700 dark:text-green-400'
      : tone === 'amber'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-gray-900 dark:text-gray-100';
  return (
    <View className={`flex-1 rounded-2xl p-3 shadow-sm border border-transparent dark:border-gray-800 ${bg}`}>
      <Text className={`text-xl font-bold ${txt}`}>{value}</Text>
      <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      className="bg-white dark:bg-gray-900 rounded-2xl items-center py-4 shadow-sm border border-transparent dark:border-gray-800"
      style={{ width: '47%' }}
      onPress={onPress}
    >
      <Text className="text-2xl mb-1">{icon}</Text>
      <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</Text>
    </TouchableOpacity>
  );
}

const TASK_STATUS_STYLE: Record<'PENDING' | 'ASSIGNED' | 'IN_PROGRESS', { color: string; bg: string }> = {
  PENDING: { color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-950' },
  ASSIGNED: { color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-950' },
  IN_PROGRESS: { color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-950' },
};

function TaskCard({ task }: { task: AssignedTask }) {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const key = taskStatusStyleKey(task.status);
  const meta = TASK_STATUS_STYLE[key];
  const label = t(`home.taskStatus.${key}`);
  return (
    <TouchableOpacity
      className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm flex-row items-center gap-3 border border-transparent dark:border-gray-800"
      onPress={() => router.push(`/tasks/${task.id}` as any)}
    >
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">{task.category}</Text>
        <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5" numberOfLines={1}>{task.description}</Text>
        {task.unit && (
          <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {t('home.flat', { number: task.unit.flatNumber })}
          </Text>
        )}
      </View>
      <View className={`rounded-full px-2.5 py-1 ${meta.bg}`}>
        <Text className={`text-xs font-semibold ${meta.color}`}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}
