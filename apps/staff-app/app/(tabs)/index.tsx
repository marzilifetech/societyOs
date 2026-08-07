import type { ComponentProps } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../src/lib/i18n';
import { useQuery } from '@tanstack/react-query';
import type { ServiceRequest } from '@societyos/api-client';
import { useAuthStore } from '../../src/store/auth.store';
import { getUnwrapped, getUnwrappedArray } from '../../src/lib/unwrapped-get';
import { SkeletonCard, SkeletonRow } from '../../src/components/attendance/SkeletonCard';
import { ErrorCard } from '../../src/components/ErrorCard';
import { isSecurityStaff } from '../../src/lib/security-staff';
import { HEALTH_ENABLED } from '../../src/lib/features';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@societyos/theme';
import { Card, EmptyState, StatusChip } from '../../src/components/ui';
import { TASK_STATUS_TONES, toneFor } from '../../src/lib/status-theme';

type QuickActionIcon = ComponentProps<typeof Ionicons>['name'];

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

  const { data: summary, isLoading: loadingSummary, isError: summaryError, error: summaryErr, isFetching: fetchingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['staff-summary'],
    queryFn: () => getUnwrapped<StaffHomeSummary>('/staff/summary'),
    enabled: !!user,
    // Inherit the client default (retry: 2 with backoff). This was `retry:
    // false`, so a SINGLE transient failure — a backend 502 blip, a lost
    // packet as the phone switches cell towers — dropped the user straight
    // onto the full-screen "couldn't be loaded" state, and nothing ever
    // recovered it: the query was settled, so no refetch was scheduled and
    // the screen stayed broken long after the server came back. Observed
    // live against a ~2 minute dev-backend outage.
    refetchOnMount: true,
    refetchOnReconnect: 'always',
    // The app is often opened straight from a push at the gate; re-checking
    // on foreground is what makes a stale error self-heal.
    refetchOnWindowFocus: true,
  });

  const { data: staffProfile } = useQuery<{ designation?: string; categories?: string[]; department?: string }>({
    queryKey: ['staff-profile-brief'],
    queryFn: () => getUnwrapped<{ designation?: string; categories?: string[]; department?: string }>('/staff/profile'),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const isDoctor = staffProfile?.designation === 'DOCTOR';
  const isSecurity = isSecurityStaff(staffProfile);

  const { data: pendingVisitors = [] } = useQuery<{ id: string }[]>({
    queryKey: ['staff-visitors-pending-count'],
    queryFn: () => getUnwrappedArray<{ id: string }>('/staff/visitors?approvalStatus=PENDING'),
    enabled: !!user && isSecurity,
    refetchInterval: 60_000,
  });

  const { data: myTasks = [], isLoading: loadingTasks, isError: tasksError, error: tasksErr, isFetching: fetchingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => getUnwrappedArray<AssignedTask>('/service-requests/assigned'),
    enabled: !!user,
    // See the summary query above — `retry: false` made one blip terminal.
    refetchOnMount: true,
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: todayShifts = [] } = useQuery({
    queryKey: ['shifts-today'],
    queryFn: () =>
      getUnwrappedArray<TodayShift>('/staff/shifts?range=today').catch(() => [] as TodayShift[]),
    enabled: !!user,
  });

  // Bell-badge — unread NotificationLog rows. Polled rather than push-driven so
  // the count stays roughly fresh even when the app missed a foreground listener.
  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => getUnwrapped<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
    enabled: !!user,
  });
  const unreadInbox = unread?.count ?? 0;

  const pendingTasks = myTasks.filter((task) => task.status !== 'COMPLETED' && task.status !== 'REJECTED');
  const doneToday = myTasks.filter((task) => {
    if (task.status !== 'COMPLETED' || !task.completedAt) return false;
    const d = new Date(task.completedAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;
  const totalToday = pendingTasks.length + doneToday;

  if (summaryError && tasksError && !fetchingSummary && !fetchingTasks) {
    // A 403 is NOT a loading failure — the account simply is not a staff
    // member (e.g. a resident signed into the staff app), so the backend's
    // role guard rejects /staff/* outright. Offering "Try Again" for that is
    // a trap: it can never succeed, and the real fix is to sign in with a
    // staff number. Observed on device with a RESIDENT-designation account,
    // where the screen said only "Your home screen couldn't be loaded".
    const forbidden =
      (summaryErr as any)?.status === 403 || (tasksErr as any)?.status === 403;

    if (forbidden) {
      return (
        <ErrorCard
          message="This account doesn't have staff access."
          detail="You're signed in with a number that isn't registered as staff for this society. Sign in with your staff number, or ask your supervisor to register this one."
          retryLabel="Sign in with a different number"
          onRetry={() => {
            // clearAuth() alone only nulls the store — the router still sits on
            // (tabs), and the root layout's auth gate has already run once
            // (gatedRef), so nothing re-routes. Without the explicit replace
            // the button appeared to do nothing at all.
            void (async () => {
              await useAuthStore.getState().clearAuth();
              router.replace('/(auth)/society-select' as any);
            })();
          }}
        />
      );
    }

    return (
      <ErrorCard
        message={t('home.loadError')}
        detail={(summaryErr as any)?.message ?? (tasksErr as any)?.message ?? undefined}
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
        <View className="bg-primary-500 dark:bg-primary-900 px-6 pt-4 pb-8 flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-primary-100 text-sm font-body">{greeting()},</Text>
            <Text className="text-white text-2xl font-heading mt-0.5">
              {user?.name ?? t('home.staffFallback')}
            </Text>
            <Text className="text-primary-200 text-sm font-body mt-1">
              {user?.department ?? user?.role}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/notifications' as any)}
            accessibilityRole="button"
            accessibilityLabel={
              unreadInbox > 0
                ? t('notifications.bell.unread', { count: unreadInbox, defaultValue: `Notifications, ${unreadInbox} unread` })
                : t('notifications.inbox.title', 'Notifications')
            }
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 6,
            }}
          >
            <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
            {unreadInbox > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: '#DC2626',
                  paddingHorizontal: 3,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>
                  {unreadInbox > 99 ? '99+' : unreadInbox}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Daily briefing card (Task 1) */}
        <View className="px-6 -mt-4 mb-4">
          <Card>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="font-heading text-sm text-gray-900 dark:text-gray-100">{t('home.briefingTitle')}</Text>
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
          </Card>
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
          <Card className="flex-row items-center justify-between">
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
              className="bg-primary-500 dark:bg-primary-600 rounded-full px-5 py-2.5"
              onPress={() => router.push('/(tabs)/attendance' as any)}
            >
              <Text className="text-white font-semibold text-sm">
                {summary?.checkedIn ? t('home.checkOut') : t('home.checkIn')}
              </Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Upcoming shift card (Task 5) */}
        {todayShift && (
          <View className="px-6 mb-4">
            <View className="bg-primary-50 dark:bg-primary-900/40 rounded-2xl p-4 border border-primary-100 dark:border-primary-800">
              <Text className="text-xs text-primary-600 dark:text-primary-200 font-semibold mb-1">{t('home.upcomingShift')}</Text>
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
                <Text className="text-xs font-semibold text-primary-600 dark:text-primary-300">{t('home.viewAllShifts')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quick actions grid (Task 3) */}
        <View className="px-6 mb-4">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('home.quickActions')}</Text>
          <View className="flex-row flex-wrap gap-3">
            <QuickAction icon="time-outline" label={t('home.actionCheckIn')} onPress={() => router.push('/(tabs)/attendance' as any)} />
            <QuickAction icon="construct-outline" label={t('home.actionViewTasks')} onPress={() => router.push('/(tabs)/tasks' as any)} />
            <QuickAction icon="qr-code-outline" label={t('home.actionGateScan')} onPress={() => router.push('/scan/qr' as any)} />
            {isSecurity && (
              <QuickAction
                icon="shield-checkmark-outline"
                label={`Visitors${pendingVisitors.length ? ` (${pendingVisitors.length})` : ''}`}
                onPress={() => router.push('/visitors' as any)}
              />
            )}
            <QuickAction icon="calendar-outline" label={t('home.actionApplyLeave')} onPress={() => router.push('/leave/new' as any)} />
            <QuickAction icon="star-outline" label={t('home.actionMyReviews')} onPress={() => router.push('/reviews' as any)} />
            <QuickAction icon="megaphone-outline" label="Notices" onPress={() => router.push('/welfare' as any)} />
          </View>
        </View>

        {/* Doctor Portal — gated by HEALTH_ENABLED (Play health-policy) — see src/lib/features.ts. */}
        {HEALTH_ENABLED && isDoctor && (
          <View className="px-6 mb-4">
            <TouchableOpacity
              className="rounded-2xl p-4 flex-row items-center justify-between bg-primary-500 dark:bg-primary-600"
              onPress={() => router.push('/doctor' as any)}
            >
              <View>
                <Text className="text-white font-heading text-base">Doctor Portal</Text>
                <Text className="text-primary-100 text-xs font-body mt-0.5">Appointments & availability</Text>
              </View>
              <Ionicons name="medkit-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Active tasks */}
        <View className="px-6 pb-32">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('home.activeTasks')}</Text>
          {loadingTasks ? (
            <ActivityIndicator color={colors.primary[500]} />
          ) : pendingTasks.length === 0 ? (
            <Card padding="none">
              <EmptyState icon="checkmark-done-outline" title={t('home.noActiveTasks')} />
            </Card>
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

      {/* Add Entry — opens the new guest/delivery entry form. SOS moved to
          Profile → Emergency / SOS. Keeping a single primary FAB on Home
          per the user's request; emergencies are a Profile menu item now. */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 bg-primary-500 dark:bg-primary-600 rounded-full px-5 h-14 flex-row items-center shadow-lg"
        onPress={() => router.push('/entry/new' as any)}
        accessibilityRole="button"
        accessibilityLabel="Add visitor or delivery entry"
      >
        <Ionicons name="add" size={22} color="#fff" />
        <Text className="text-white font-bold ml-1.5">Add Entry</Text>
      </TouchableOpacity>
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
    <View className={`flex-1 rounded-2xl p-3 shadow-sm border border-black/5 dark:border-gray-800 ${bg}`}>
      <Text className={`text-xl font-heading ${txt}`}>{value}</Text>
      <Text className="text-xs font-body text-gray-500 dark:text-gray-400 mt-0.5">{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: QuickActionIcon; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      className="bg-white dark:bg-gray-900 rounded-2xl items-center py-4 shadow-sm border border-black/5 dark:border-gray-800"
      style={{ width: '47%' }}
      onPress={onPress}
    >
      <View className="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-900/50 items-center justify-center mb-1.5">
        <Ionicons name={icon} size={20} color={colors.primary[500]} />
      </View>
      <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</Text>
    </TouchableOpacity>
  );
}

function TaskCard({ task }: { task: AssignedTask }) {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const key = taskStatusStyleKey(task.status);
  const label = t(`home.taskStatus.${key}`);
  return (
    <TouchableOpacity onPress={() => router.push(`/tasks/${task.id}` as any)}>
      <Card className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">{task.category}</Text>
          <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5" numberOfLines={1}>{task.description}</Text>
          {task.unit && (
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {t('home.flat', { number: task.unit.flatNumber })}
            </Text>
          )}
        </View>
        <StatusChip tone={toneFor(TASK_STATUS_TONES, key, 'PENDING')} label={label} />
      </Card>
    </TouchableOpacity>
  );
}
