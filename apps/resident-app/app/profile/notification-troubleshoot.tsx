import { useCallback, useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../../src/hooks/useTheme';
import { useNotificationPermission } from '../../src/hooks/useNotificationPermission';

/**
 * Troubleshoot screen modeled on the NoBrokerHood "Notifications Setup" flow.
 * Walks the user through each Android-specific knob that can silently drop
 * pushes (system permission, battery optimization, lockscreen visibility,
 * MIUI-style autostart). Each step is its own card with a clear status pill
 * and a Fix button that deep-links to the most useful Settings screen we can
 * reach from a non-system app.
 *
 * Senior-citizen UX: large taps (>=56px), big body text, plain language —
 * "ringtone for visitor alerts" beats "notification channel sound".
 */
export default function NotificationTroubleshootScreen() {
  const t = useTheme();
  const { status: permStatus, refresh } = useNotificationPermission();
  const [requesting, setRequesting] = useState(false);

  const requestPermission = useCallback(async () => {
    setRequesting(true);
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing === 'granted') {
        refresh();
        return;
      }
      if (existing === 'denied') {
        // Once denied at the system layer, requestPermissionsAsync is a no-op
        // on most Android versions — the user must visit Settings. We surface
        // a clear nudge instead of pretending the dialog will appear.
        Alert.alert(
          'Notifications are turned off',
          'Open Settings → Notifications and allow this app to send notifications.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      const { status: next } = await Notifications.requestPermissionsAsync();
      if (next !== 'granted') {
        Alert.alert(
          'Notifications are still off',
          'Tap Open Settings to allow them. We will let you know about visitors, packages, and emergencies.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      }
    } finally {
      setRequesting(false);
      refresh();
    }
  }, [refresh]);

  const isAndroid = Platform.OS === 'android';
  const allowedToBypassBatterySaving = isAndroid; // Step only shown on Android

  const openBatterySettings = () => {
    // Android-only: opens the app's per-app battery info where the user can
    // pick "Unrestricted". On iOS this is N/A; we hide the step entirely.
    Linking.openSettings().catch(() => {
      Alert.alert('Could not open Settings', 'Please open Settings → Apps → SocietyOS → Battery.');
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View
        className="flex-row items-center"
        style={{ paddingHorizontal: t.screenPadding, paddingVertical: 12, gap: 8 }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-gray-900 font-bold" style={{ fontSize: t.fontXl }}>
          Fix notifications
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.screenPadding,
          paddingBottom: 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-gray-500 mb-6 leading-6" style={{ fontSize: t.fontBase }}>
          Visitors at the gate, package arrivals, and emergencies all use phone notifications. If
          notifications are off, you won&apos;t hear them. Follow the steps below to make sure they
          come through.
        </Text>

        {/* STEP 1 — System permission */}
        <Step
          number={1}
          title="Allow notifications"
          description="The phone needs your permission to show notifications from SocietyOS."
          status={
            permStatus === 'granted'
              ? 'done'
              : permStatus === 'unknown'
              ? 'pending'
              : 'action'
          }
          actionLabel={
            permStatus === 'granted'
              ? null
              : permStatus === 'denied'
              ? 'Open Settings'
              : 'Allow notifications'
          }
          onAction={
            permStatus === 'denied' ? () => Linking.openSettings() : requestPermission
          }
          loading={requesting}
          t={t}
        />

        {/* STEP 2 — Android battery */}
        {allowedToBypassBatterySaving ? (
          <Step
            number={2}
            title="Stop battery saver from blocking us"
            description={
              'Some phones (Xiaomi, Vivo, Oppo) put apps to sleep to save battery and notifications stop arriving.\n\nIn Settings → Apps → SocietyOS → Battery, choose "Unrestricted" (or "No restrictions").'
            }
            status="action"
            actionLabel="Open Battery Settings"
            onAction={openBatterySettings}
            t={t}
          />
        ) : null}

        {/* STEP 3 — Lockscreen visibility */}
        <Step
          number={allowedToBypassBatterySaving ? 3 : 2}
          title="Show notifications on the lock screen"
          description={
            'You want to see visitor names and approve/reject without unlocking the phone.\n\nIn Settings → Notifications → SocietyOS, turn on "Show on lock screen" and set content to "Show all".'
          }
          status="action"
          actionLabel="Open Notification Settings"
          onAction={() => Linking.openSettings()}
          t={t}
        />

        {/* STEP 4 — Do Not Disturb (Android) */}
        {isAndroid ? (
          <Step
            number={allowedToBypassBatterySaving ? 4 : 3}
            title="Let urgent alerts through Do Not Disturb"
            description={
              'When Do Not Disturb is on, only "priority" notifications come through. Make sure SocietyOS is in your priority list so emergency and gate alerts always ring.\n\nSettings → Sound → Do Not Disturb → Apps → Add SocietyOS.'
            }
            status="action"
            actionLabel="Open Settings"
            onAction={() => Linking.openSettings()}
            t={t}
          />
        ) : null}

        {/* Reassurance footer */}
        <View
          className="bg-primary-50 border border-primary-500 rounded-2xl mt-2"
          style={{ padding: t.cardPadding }}
        >
          <Text className="text-primary-500 font-bold mb-1" style={{ fontSize: t.fontBase }}>
            Test it
          </Text>
          <Text className="text-gray-700 leading-6" style={{ fontSize: t.fontSm }}>
            After fixing the settings above, open this app again. If the warning banner on Profile
            disappears, notifications are working.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * One troubleshooting step card. Status pill at the top, big readable
 * description, and a single primary action that opens the right Settings
 * screen (or runs the permission prompt directly).
 */
function Step({
  number,
  title,
  description,
  status,
  actionLabel,
  onAction,
  loading,
  t,
}: {
  number: number;
  title: string;
  description: string;
  status: 'done' | 'action' | 'pending';
  actionLabel: string | null;
  onAction: () => void;
  loading?: boolean;
  t: any;
}) {
  const pill = (() => {
    switch (status) {
      case 'done':
        return { bg: '#DCFCE7', fg: '#166534', label: 'Done' };
      case 'pending':
        return { bg: '#F3F4F6', fg: '#6B7280', label: 'Checking…' };
      default:
        return { bg: '#FEE2E2', fg: '#B91C1C', label: 'Needs your action' };
    }
  })();
  return (
    <View
      className="border border-gray-200 rounded-2xl mb-4"
      style={{ padding: t.cardPadding, backgroundColor: '#FFFFFF' }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: '#821A52',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text className="text-white font-bold" style={{ fontSize: 14 }}>
              {number}
            </Text>
          </View>
          <Text className="text-gray-900 font-bold" style={{ fontSize: t.fontLg }}>
            {title}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: pill.bg,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: pill.fg, fontSize: 11, fontWeight: '700' }}>{pill.label}</Text>
        </View>
      </View>
      <Text
        className="text-gray-600 leading-6"
        style={{ fontSize: t.fontBase }}
      >
        {description}
      </Text>
      {actionLabel ? (
        <TouchableOpacity
          onPress={onAction}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          className="bg-primary-500 rounded-xl items-center justify-center mt-4"
          style={{ minHeight: t.touchTarget, opacity: loading ? 0.6 : 1 }}
        >
          <Text className="text-white font-bold" style={{ fontSize: t.fontBase }}>
            {loading ? 'Opening…' : actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
