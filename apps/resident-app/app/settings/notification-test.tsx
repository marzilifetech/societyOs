import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Tappable } from '../../src/components/ui/Tappable';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { ThemedText } from '../../src/components/ui';
import { useNotificationPermission } from '../../src/hooks/useNotificationPermission';
import {
  ensureAndroidChannels,
  ensurePermission,
  openNotificationSettings,
  registerDeviceToken,
} from '../../src/lib/push';
import { APP_NAME, APP_VERSION_LABEL } from '../../src/lib/app-version';
import { getSmsRetrieverHash } from '../../src/hooks/useSmsOtpAutoRead';

const BRAND_SOFT = 'rgba(130,26,82,0.08)';

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
} as const;

type PermMeta = { label: string; tone: string; icon: keyof typeof Ionicons.glyphMap };

function permMeta(status: string): PermMeta {
  switch (status) {
    case 'granted':
      return { label: 'Enabled', tone: '#16A34A', icon: 'checkmark-circle' };
    case 'denied':
      return { label: 'Turned off', tone: '#DC2626', icon: 'close-circle' };
    case 'undetermined':
      return { label: 'Not asked yet', tone: '#D97706', icon: 'help-circle' };
    default:
      return { label: 'Checking…', tone: '#6B7280', icon: 'ellipsis-horizontal-circle' };
  }
}

export default function NotificationTestScreen() {
  const t = useTheme();
  const { status, refresh } = useNotificationPermission();
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState<'send' | 'enable' | 'register' | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [smsHash, setSmsHash] = useState<string | null>(null);

  useEffect(() => {
    getSmsRetrieverHash().then(setSmsHash);
  }, []);

  const meta = permMeta(status);

  const enable = async () => {
    setBusy('enable');
    setNote(null);
    try {
      const granted = await ensurePermission();
      await refresh();
      if (granted) {
        setNote({ kind: 'ok', text: 'Notifications are enabled on this device.' });
      } else {
        setNote({
          kind: 'err',
          text: 'Permission is off. Opening system settings so you can turn it on…',
        });
        openNotificationSettings();
      }
    } finally {
      setBusy(null);
    }
  };

  const sendLocal = async () => {
    setBusy('send');
    setNote(null);
    try {
      await ensureAndroidChannels();
      const granted = await ensurePermission();
      await refresh();
      if (!granted) {
        setNote({ kind: 'err', text: 'Turn on notifications first, then try again.' });
        return;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test notification ✅',
          body: 'If you can see this, notifications are working on this device.',
          data: { type: 'TEST' },
        },
        // Android routes by CHANNEL, and the channel is read from the trigger —
        // a `channelId` inside `content` is silently ignored, which dumped this
        // notification into expo's fallback channel (wrong importance, and it
        // shows up under a junk name in system settings). A channel-aware
        // trigger still delivers immediately, exactly like `trigger: null`.
        trigger: Platform.OS === 'android' ? { channelId: 'system' } : null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setNote({
        kind: 'ok',
        text: 'Sent! Check your notification tray (pull down from the top).',
      });
    } catch (e) {
      setNote({ kind: 'err', text: `Could not send: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  };

  const registerDevice = async () => {
    setBusy('register');
    setNote(null);
    try {
      await ensureAndroidChannels();
      await registerDeviceToken();
      const data = await Notifications.getDevicePushTokenAsync();
      const tk = typeof data.data === 'string' ? data.data : null;
      setToken(tk);
      setNote({
        kind: tk ? 'ok' : 'err',
        text: tk
          ? 'Device registered for push with the server.'
          : 'No push token available (needs a real device with Google Play services).',
      });
    } catch (e) {
      setNote({ kind: 'err', text: `Registration failed: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bgPrimary }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: t.screenPadding,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ padding: 4, marginRight: 6 }}
        >
          <Ionicons name="chevron-back" size={24} color={t.textPrimary} />
        </Pressable>
        <ThemedText variant="subheading" weight="bold">
          Notification test
        </ThemedText>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText variant="body" color={t.textSecondary} style={{ marginBottom: t.sectionGap }}>
          Use this to confirm alerts show up on this phone.
        </ThemedText>

        {/* Permission status */}
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: t.bgPrimary,
              borderRadius: t.radiusLg,
              padding: t.cardPadding,
              marginBottom: t.sectionGap,
            },
            cardShadow,
          ]}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: `${meta.tone}1A`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Ionicons name={meta.icon} size={22} color={meta.tone} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText variant="caption" color={t.textMuted}>
              Permission
            </ThemedText>
            <ThemedText weight="semibold" style={{ fontSize: t.fontLg, color: meta.tone }}>
              {meta.label}
            </ThemedText>
          </View>
        </View>

        {/* Result note */}
        {note && (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              backgroundColor: note.kind === 'ok' ? '#DCFCE7' : '#FEE2E2',
              borderRadius: t.radiusMd,
              padding: 12,
              marginBottom: t.sectionGap,
            }}
          >
            <Ionicons
              name={note.kind === 'ok' ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={note.kind === 'ok' ? '#16A34A' : '#DC2626'}
            />
            <ThemedText
              variant="caption"
              color={note.kind === 'ok' ? '#166534' : '#991B1B'}
              style={{ flex: 1 }}
            >
              {note.text}
            </ThemedText>
          </View>
        )}

        {/* Primary: send a local test notification */}
        <Tappable
          onPress={sendLocal}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel="Send a test notification"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: t.accentPrimary,
            borderRadius: t.radiusLg,
            minHeight: t.touchTargetLg,
            opacity: busy ? 0.85 : 1,
            marginBottom: 12,
          }}
          pressedStyle={{ opacity: 0.85 }}
        >
          <Ionicons name="notifications" size={18} color="#FFFFFF" />
          <ThemedText weight="bold" color="#FFFFFF" style={{ fontSize: t.fontBase }}>
            {busy === 'send' ? 'Sending…' : 'Send a test notification'}
          </ThemedText>
        </Tappable>

        {/* Secondary: enable / register */}
        {status !== 'granted' && (
          <Tappable
            onPress={enable}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel="Enable notifications"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: BRAND_SOFT,
              borderRadius: t.radiusLg,
              minHeight: t.touchTargetLg,
              opacity: busy ? 0.85 : 1,
              marginBottom: 12,
            }}
          pressedStyle={{ opacity: 0.85 }}
          >
            <Ionicons name="power" size={18} color={t.accentPrimary} />
            <ThemedText weight="semibold" color={t.accentPrimary} style={{ fontSize: t.fontBase }}>
              {busy === 'enable' ? 'Working…' : 'Enable notifications'}
            </ThemedText>
          </Tappable>
        )}

        <Tappable
          onPress={registerDevice}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel="Register this device for push"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: BRAND_SOFT,
            borderRadius: t.radiusLg,
            minHeight: t.touchTargetLg,
            opacity: busy ? 0.85 : 1,
          }}
          pressedStyle={{ opacity: 0.85 }}
        >
          <Ionicons name="cloud-upload-outline" size={18} color={t.accentPrimary} />
          <ThemedText weight="semibold" color={t.accentPrimary} style={{ fontSize: t.fontBase }}>
            {busy === 'register' ? 'Registering…' : 'Register this device for push'}
          </ThemedText>
        </Tappable>

        {/* Device token (for debugging server pushes) */}
        {token && (
          <View
            style={{
              backgroundColor: t.bgCard,
              borderRadius: t.radiusMd,
              padding: 12,
              marginTop: t.sectionGap,
            }}
          >
            <ThemedText variant="caption" color={t.textMuted} style={{ marginBottom: 4 }}>
              Device push token
            </ThemedText>
            <ThemedText variant="caption" color={t.textSecondary} style={{ fontSize: 11 }}>
              {token}
            </ThemedText>
          </View>
        )}

        {/* SMS Retriever app hash. Belongs on this diagnostics screen because
            the value is BUILD-SPECIFIC: it is derived from the package name
            plus the SIGNING certificate, so the debug, upload-key and
            Play-signed builds each produce a different hash. Whoever owns the
            SMS template needs the one from the build users actually install
            (i.e. read it from a Play-installed copy), and there is no way to
            compute that off-device once Play re-signs the bundle. */}
        {smsHash && (
          <View
            style={{
              backgroundColor: t.bgCard,
              borderRadius: t.radiusMd,
              padding: 12,
              marginTop: t.sectionGap,
            }}
          >
            <ThemedText variant="caption" color={t.textMuted} style={{ marginBottom: 4 }}>
              SMS auto-read hash (this build)
            </ThemedText>
            <ThemedText
              weight="bold"
              color={t.textPrimary}
              style={{ fontSize: 15, letterSpacing: 0.5 }}
            >
              {smsHash}
            </ThemedText>
            <ThemedText variant="caption" color={t.textMuted} style={{ fontSize: 11, marginTop: 6 }}>
              The OTP SMS must end with this exact string for the code to fill in
              automatically.
            </ThemedText>
          </View>
        )}

        <ThemedText
          variant="caption"
          color={t.textMuted}
          style={{ textAlign: 'center', marginTop: t.sectionGap * 1.5 }}
        >
          {APP_NAME} · {APP_VERSION_LABEL}
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}
