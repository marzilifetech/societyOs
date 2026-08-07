import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18nInstance from '../../src/lib/i18n';
import { AppHeader, Card } from '../../src/components/ui';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  registerForPushNotifications,
  type NotificationPreference,
} from '../../src/lib/notifications';
import {
  DIAGNOSTIC_CHANNELS,
  areNotificationsEnabled,
  getChannelStatus,
  nativeNotificationsAvailable,
  openAppNotificationSettings,
  openChannelSettings,
  type ChannelStatus,
} from '../../src/lib/native-notifications';

const PREFS_KEY = ['notification-preferences'];

/**
 * Android importance values worth naming. Anything at or above HIGH pops a
 * heads-up banner; DEFAULT lands silently in the tray; NONE means the user
 * switched that specific alert type off.
 */
const IMPORTANCE_NONE = 0;
const IMPORTANCE_HIGH = 4;

type Health = 'ok' | 'partial' | 'off' | 'checking';

export default function NotificationsSettingsScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const queryClient = useQueryClient();

  const [osEnabled, setOsEnabled] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<Notifications.PermissionStatus | null>(null);
  const [channels, setChannels] = useState<ChannelStatus[]>([]);
  const [testing, setTesting] = useState(false);

  /**
   * Re-read the real OS state every time the screen regains focus. This is the
   * whole point of the screen: the user leaves to flip a system toggle and
   * comes back, and the status must reflect what they just did rather than a
   * stale snapshot from mount.
   */
  const refreshOsState = useCallback(async () => {
    const [perm, enabled, chans] = await Promise.all([
      Notifications.getPermissionsAsync().then((r) => r.status).catch(() => null),
      areNotificationsEnabled(),
      getChannelStatus(),
    ]);
    setPermission(perm);
    setOsEnabled(enabled);
    setChannels(chans);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshOsState();
    }, [refreshOsState]),
  );

  const { data: prefs, isLoading, isError, refetch } = useQuery({
    queryKey: PREFS_KEY,
    queryFn: fetchNotificationPreferences,
  });

  const mutation = useMutation({
    mutationFn: (next: NotificationPreference) =>
      updateNotificationPreferences([{ category: next.key, enabled: next.enabled }]),
    // Optimistic toggle — flip locally, roll back on failure.
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: PREFS_KEY });
      const prev = queryClient.getQueryData<NotificationPreference[]>(PREFS_KEY);
      queryClient.setQueryData<NotificationPreference[]>(PREFS_KEY, (cur) =>
        (cur ?? []).map((p) => (p.key === next.key ? { ...p, enabled: next.enabled } : p)),
      );
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(PREFS_KEY, ctx.prev);
      Alert.alert(t('common.error'), t('settings.notificationUpdateFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PREFS_KEY });
    },
  });

  const byId = new Map(channels.map((c) => [c.id, c]));
  const trackedChannels = DIAGNOSTIC_CHANNELS.map((d) => ({ ...d, status: byId.get(d.id) }));
  const mutedChannels = trackedChannels.filter(
    (c) => c.status && (c.status.blocked || c.status.groupBlocked),
  );

  const granted = permission === 'granted';
  const allowedByOs = osEnabled !== false;

  const health: Health =
    permission === null
      ? 'checking'
      : !granted || !allowedByOs
        ? 'off'
        : mutedChannels.length > 0
          ? 'partial'
          : 'ok';

  const handleEnable = async () => {
    // `undetermined` is the only state where the OS will still show its own
    // dialog. Once denied, Android 13+ silently ignores the request, so the
    // honest action is to send the user to system settings instead of firing a
    // prompt that visibly does nothing.
    if (permission === 'undetermined') {
      await registerForPushNotifications();
      await refreshOsState();
      return;
    }
    await openAppNotificationSettings();
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test notification ✅',
          body: 'Notifications are working on this phone.',
          data: { type: 'TEST' },
        },
        // Android routes by CHANNEL, and the channel is read from the TRIGGER.
        // A `channelId` inside `content` is silently ignored, which dumps the
        // notification into the fallback channel with the wrong importance.
        trigger: Platform.OS === 'android' ? ({ channelId: 'system' } as any) : null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Sent', 'Check your notification tray (swipe down from the top).');
    } catch (e) {
      Alert.alert('Could not send', (e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title={t('settings.notifications')} subtitle="Control what reaches your phone" />

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4 pb-10">
        <StatusHero
          health={health}
          mutedCount={mutedChannels.length}
          onPrimary={handleEnable}
          onTest={sendTest}
          testing={testing}
        />

        {/* ─── What you get notified about (server-side opt-out) ─────────── */}
        <View>
          <SectionLabel>What you get notified about</SectionLabel>
          <Card padding="none" className="overflow-hidden">
            {isLoading ? (
              <View className="px-5 py-8 items-center">
                <ActivityIndicator color="#821A52" />
              </View>
            ) : isError ? (
              <TouchableOpacity
                className="px-5 py-8 items-center"
                onPress={() => refetch()}
                accessibilityRole="button"
              >
                <Ionicons name="refresh" size={20} color="#9CA3AF" />
                <Text className="text-sm text-gray-500 mt-2">{t('common.retry')}</Text>
              </TouchableOpacity>
            ) : (
              (prefs ?? []).map((p, i) => (
                <Toggle
                  key={p.key}
                  label={p.label}
                  description={p.mutable ? p.description : t('settings.alwaysOn')}
                  value={p.enabled}
                  locked={!p.mutable}
                  disabled={!p.mutable || mutation.isPending}
                  onChange={(v) => mutation.mutate({ ...p, enabled: v })}
                  last={i === (prefs ?? []).length - 1}
                />
              ))
            )}
          </Card>
        </View>

        {/* ─── Per-channel OS state ──────────────────────────────────────────
            Only meaningful once the app itself is allowed to notify, and only
            on Android where channels exist at all. The single most common
            "notifications don't work" report is ONE of these switched off
            while the app-level permission still reads as granted — which no
            JS-side API can see. */}
        {nativeNotificationsAvailable && granted && allowedByOs ? (
          <View>
            <SectionLabel>Alert types on this phone</SectionLabel>
            <Card padding="none" className="overflow-hidden">
              {trackedChannels.map((c, i) => (
                <ChannelRow
                  key={c.id}
                  label={c.label}
                  why={c.why}
                  status={c.status}
                  last={i === trackedChannels.length - 1}
                  onPress={() => openChannelSettings(c.id)}
                />
              ))}
            </Card>
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-2 px-1">
              These are your phone&apos;s own settings. Tap any row to change it in Android
              settings.
            </Text>
          </View>
        ) : null}

        {/* ─── Escape hatch ──────────────────────────────────────────────── */}
        <View>
          <SectionLabel>Still not arriving?</SectionLabel>
          <Card padding="none" className="overflow-hidden">
            <LinkRow
              icon="settings-outline"
              label="Open phone notification settings"
              onPress={() => openAppNotificationSettings()}
            />
            <LinkRow
              icon="refresh-outline"
              label="Re-register this device for push"
              onPress={async () => {
                const token = await registerForPushNotifications();
                Alert.alert(
                  token ? 'Device registered' : 'Could not register',
                  token
                    ? 'This phone is now registered to receive alerts.'
                    : 'Check that notifications are allowed and you are online, then try again.',
                );
                await refreshOsState();
              }}
              last
            />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ────────────────────────────── pieces ────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-xs font-heading text-gray-500 dark:text-gray-400 uppercase mb-2 px-1">
      {children}
    </Text>
  );
}

const HERO: Record<
  Exclude<Health, 'checking'>,
  { tint: string; bg: string; icon: keyof typeof Ionicons.glyphMap; title: string; cta: string | null }
> = {
  ok: {
    tint: '#16A34A',
    bg: 'bg-green-50 dark:bg-green-950/40',
    icon: 'checkmark-circle',
    title: 'Alerts are on',
    cta: null,
  },
  partial: {
    tint: '#D97706',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    icon: 'alert-circle',
    title: 'Some alerts are muted',
    cta: 'Review settings',
  },
  off: {
    tint: '#DC2626',
    bg: 'bg-red-50 dark:bg-red-950/40',
    icon: 'notifications-off',
    title: 'Alerts are off',
    cta: 'Turn on alerts',
  },
};

function StatusHero({
  health,
  mutedCount,
  onPrimary,
  onTest,
  testing,
}: {
  health: Health;
  mutedCount: number;
  onPrimary: () => void;
  onTest: () => void;
  testing: boolean;
}) {
  if (health === 'checking') {
    return (
      <Card padding="lg" className="items-center">
        <ActivityIndicator color="#821A52" />
      </Card>
    );
  }

  const meta = HERO[health];
  const body =
    health === 'ok'
      ? 'You will get gate, task and emergency alerts on this phone.'
      : health === 'partial'
        ? `${mutedCount} alert ${mutedCount === 1 ? 'type is' : 'types are'} switched off in your phone settings.`
        : 'You will miss gate entries, task assignments and emergency alerts until you turn these on.';

  return (
    <Card padding="lg" className={meta.bg}>
      <View className="flex-row items-start">
        <View
          className="w-11 h-11 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: `${meta.tint}1A` }}
        >
          <Ionicons name={meta.icon} size={22} color={meta.tint} />
        </View>
        <View className="flex-1">
          <Text className="font-heading text-base" style={{ color: meta.tint }}>
            {meta.title}
          </Text>
          <Text className="font-body text-sm text-gray-600 dark:text-gray-300 mt-1">{body}</Text>
        </View>
      </View>

      <View className="flex-row gap-3 mt-4">
        {meta.cta ? (
          <TouchableOpacity
            onPress={onPrimary}
            accessibilityRole="button"
            className="flex-1 rounded-xl py-3 items-center"
            style={{ backgroundColor: meta.tint }}
          >
            <Text className="text-white font-heading text-sm">{meta.cta}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={onTest}
          disabled={testing}
          accessibilityRole="button"
          accessibilityLabel="Send a test notification"
          className="flex-1 rounded-xl py-3 items-center border border-black/10 dark:border-white/15"
        >
          <Text className="font-heading text-sm text-gray-800 dark:text-gray-100">
            {testing ? 'Sending…' : 'Send a test'}
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

function ChannelRow({
  label,
  why,
  status,
  last,
  onPress,
}: {
  label: string;
  why: string;
  status?: ChannelStatus;
  last?: boolean;
  onPress: () => void;
}) {
  // A channel that does not exist yet is not an error worth alarming about —
  // it simply has not been created on this build. Treat it as neutral.
  const missing = !status;
  const off = !!status && (status.blocked || status.groupBlocked);
  const quiet = !!status && !off && status.importance < IMPORTANCE_HIGH;

  const tint = off ? '#DC2626' : quiet ? '#D97706' : '#16A34A';
  const state = missing
    ? '—'
    : status!.groupBlocked
      ? 'Group off'
      : status!.importance === IMPORTANCE_NONE
        ? 'Off'
        : quiet
          ? 'Silent'
          : 'On';

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${state}. Opens phone settings.`}
      className={`px-5 py-4 flex-row items-center ${
        !last ? 'border-b border-gray-100 dark:border-gray-800' : ''
      }`}
    >
      <View className="flex-1 pr-3">
        <Text className="font-heading text-sm text-gray-900 dark:text-gray-100">{label}</Text>
        <Text className="font-body text-xs text-gray-400 dark:text-gray-500 mt-0.5">{why}</Text>
      </View>
      {!missing ? (
        <View className="rounded-full px-2.5 py-1 mr-2" style={{ backgroundColor: `${tint}1A` }}>
          <Text className="text-[11px] font-heading" style={{ color: tint }}>
            {state}
          </Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      className={`px-5 py-4 flex-row items-center ${
        !last ? 'border-b border-gray-100 dark:border-gray-800' : ''
      }`}
    >
      <View className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/50 items-center justify-center mr-3">
        <Ionicons name={icon} size={16} color="#821A52" />
      </View>
      <Text className="flex-1 font-body text-sm text-gray-900 dark:text-gray-100">{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
  last,
  disabled,
  locked,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
  disabled?: boolean;
  locked?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.6}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={label}
      className={`px-5 py-4 flex-row items-center ${
        !last ? 'border-b border-gray-100 dark:border-gray-800' : ''
      }`}
    >
      <View className="flex-1 pr-3">
        <Text className="font-heading text-sm text-gray-900 dark:text-gray-100">{label}</Text>
        {description ? (
          <Text className="font-body text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {description}
          </Text>
        ) : null}
      </View>
      {locked ? (
        // A force-on category can't be toggled. Showing a disabled switch reads
        // as "broken"; a lock pill reads as "deliberate".
        <View className="rounded-full px-2.5 py-1 bg-gray-100 dark:bg-gray-800 flex-row items-center">
          <Ionicons name="lock-closed" size={11} color="#6B7280" />
          <Text className="text-[11px] font-heading text-gray-500 ml-1">Always</Text>
        </View>
      ) : (
        <View
          className={`w-11 h-6 rounded-full ${
            value ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
          } ${disabled ? 'opacity-50' : ''} px-0.5 justify-center`}
        >
          <View
            className={`w-5 h-5 rounded-full bg-white ${value ? 'self-end' : 'self-start'}`}
            style={{ elevation: 2 }}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}
