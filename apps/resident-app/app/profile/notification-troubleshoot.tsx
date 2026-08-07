import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNotificationPermission } from '../../src/hooks/useNotificationPermission';
import {
  ensurePermission,
  openChannelSettings,
  openNotificationSettings,
} from '../../src/lib/push';
import { Display, rd } from '../../src/components/ui/redesign';
import { Tappable } from '../../src/components/ui/Tappable';
import { APP_NAME } from '../../src/lib/app-version';

/**
 * Notification setup. Reached from Settings, or when a resident says alerts are
 * not arriving — never pushed at them unprompted.
 *
 * Design rule: every action here hands off to a REAL OS screen rather than
 * describing where to tap. The old version spelled out paths like
 * "Settings → Apps → … → Battery → Unrestricted", which are Pixel wording and
 * do not exist on the MIUI / ColorOS / FuntouchOS skins most residents run, so
 * people went hunting for options their phone does not have. Anything we cannot
 * deep-link to reliably does not belong on this screen.
 */
export default function NotificationSetupScreen() {
  const { status, refresh } = useNotificationPermission();
  const [busy, setBusy] = useState(false);
  const granted = status === 'granted';

  const allow = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      // 'denied' is terminal: Android will not re-show the dialog, so the only
      // route left is the settings screen. 'undetermined' still gets the native
      // prompt, which is always nicer than sending someone into Settings.
      if (status === 'denied') {
        await openNotificationSettings();
      } else {
        const ok = await ensurePermission();
        if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (!ok) await openNotificationSettings();
      }
    } finally {
      setBusy(false);
      refresh();
    }
  }, [busy, status, refresh]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Tappable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          pressedStyle={{ opacity: 0.7 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color="#141414" />
        </Tappable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Display size="lg">Notification setup</Display>
          <Text style={styles.headerSub}>
            {granted
              ? `${APP_NAME} can alert you. Fine-tune what you hear below.`
              : 'Two taps and you will never miss a visitor at your gate.'}
          </Text>
        </View>

        {/* Hero status — the one thing that actually gates everything else. */}
        <View style={[styles.hero, granted ? styles.heroOk : styles.heroOff]}>
          <View style={[styles.heroIcon, { backgroundColor: granted ? '#FFFFFF' : '#FFFFFF' }]}>
            <Ionicons
              name={granted ? 'notifications' : 'notifications-off'}
              size={26}
              color={granted ? rd.green : '#B45309'}
            />
          </View>
          <Text style={[styles.heroTitle, { color: granted ? '#14532D' : '#7C2D12' }]}>
            {granted ? 'Notifications are on' : 'Notifications are off'}
          </Text>
          <Text style={[styles.heroText, { color: granted ? '#166534' : '#92400E' }]}>
            {granted
              ? 'You will hear about visitors, deliveries and emergencies.'
              : 'Right now your phone is blocking every alert from this app, including emergencies.'}
          </Text>
          {!granted && (
            <Tappable
              onPress={allow}
              style={styles.heroBtn}
              pressedStyle={{ opacity: 0.85 }}
              accessibilityRole="button"
              accessibilityLabel="Turn on notifications"
            >
              <Text style={styles.heroBtnText}>
                {busy ? 'Opening…' : status === 'denied' ? 'Turn on in Settings' : 'Turn on'}
              </Text>
            </Tappable>
          )}
        </View>

        {/* Fine-tuning. Only useful once alerts can actually arrive, so it is
            hidden while permission is off rather than shown as dead rows. */}
        {granted && (
          <>
            <Text style={styles.sectionTitle}>Fine-tune</Text>
            <View style={styles.card}>
              <Row
                icon="notifications-outline"
                tint="#821A52"
                label="All notification settings"
                sub="Sounds, badges and lock-screen preview"
                onPress={() => openNotificationSettings()}
              />
              {Platform.OS === 'android' && (
                <>
                  <Row
                    icon="alert-circle-outline"
                    tint={rd.crimson}
                    label="Emergency alerts"
                    sub="Make SOS ring even in Do Not Disturb"
                    onPress={() => openChannelSettings('emergency_sos')}
                  />
                  <Row
                    icon="people-outline"
                    tint="#B45309"
                    label="Visitors & deliveries"
                    sub="Someone at your gate needs approval"
                    onPress={() => openChannelSettings('deliveries')}
                  />
                  <Row
                    icon="megaphone-outline"
                    tint="#0284C7"
                    label="Notices & community"
                    sub="Society announcements"
                    onPress={() => openChannelSettings('community')}
                    last
                  />
                </>
              )}
            </View>
            <Text style={styles.footnote}>
              These open your phone's own settings, so the choices stick even if you reinstall.
            </Text>
          </>
        )}

        <Text style={styles.sectionTitle}>Still not arriving?</Text>
        <View style={styles.card}>
          <Row
            icon="flask-outline"
            tint="#F59E0B"
            label="Send a test notification"
            sub="Confirm alerts reach this phone"
            onPress={() => router.push('/settings/notification-test' as any)}
          />
          <Row
            icon="options-outline"
            tint="#7C3AED"
            label="Choose what you get alerted about"
            sub="Turn individual alert types on or off"
            onPress={() => router.push('/settings/notifications' as any)}
            last
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  icon,
  tint,
  label,
  sub,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  sub: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Tappable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={[styles.row, !last && styles.rowDivider]}
      pressedStyle={styles.rowPressed}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={sub}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${tint}1A` }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  topBar: { paddingHorizontal: 16, paddingTop: 8 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: rd.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingBottom: 48 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  headerSub: { fontSize: 14, color: '#6B7280', marginTop: 6, lineHeight: 20 },

  hero: {
    marginHorizontal: 16,
    marginTop: 18,
    padding: 20,
    borderRadius: rd.radiusCardLg,
    alignItems: 'center',
  },
  heroOk: { backgroundColor: rd.greenSoft },
  heroOff: { backgroundColor: rd.amberSoft },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontWeight: '700' },
  heroText: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  heroBtn: {
    marginTop: 16,
    alignSelf: 'stretch',
    backgroundColor: '#B45309',
    paddingVertical: 15,
    borderRadius: rd.radiusPill,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  heroBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    paddingHorizontal: 22,
    marginTop: 26,
    marginBottom: 8,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: rd.radiusCardLg,
    borderWidth: 1,
    borderColor: rd.cardBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 64,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  rowPressed: { backgroundColor: '#F4F4F6' },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#141414' },
  rowSub: { fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 16 },

  footnote: {
    fontSize: 12,
    color: '#9CA3AF',
    paddingHorizontal: 22,
    marginTop: 10,
    lineHeight: 17,
  },
});
