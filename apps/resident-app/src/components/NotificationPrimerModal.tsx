import { useCallback, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

type Props = {
  visible: boolean;
  onClose: (outcome: 'granted' | 'denied' | 'dismissed') => void;
};

/**
 * Pre-permission soft prompt — explains the 3 notification types BEFORE
 * the OS dialog ever appears. Industry research (Mixpanel, NoBrokerHood,
 * Swiggy) shows this triples acceptance vs. the bare OS prompt.
 *
 * Triggered ONCE, just-in-time: after a brand-new resident has uploaded
 * their KYC documents and arrives on Home. Triggering before that point
 * (e.g. on first launch) is the most common mistake — the user hasn't
 * invested anything yet and reflexively denies.
 *
 * On "Allow":
 *   - Already granted → close silently.
 *   - undetermined    → fire requestPermissionsAsync, return outcome.
 *   - denied (hard)   → Android won't re-prompt; bounce to troubleshoot.
 *
 * On "Maybe later" → outcome = 'dismissed'. Caller persists a flag so the
 * modal never opens twice; the persistent banner takes over the nagging.
 *
 * Senior-grade: large fonts via the theme hook, big buttons (56+ px hit
 * target), plain language ("we'll tell you" beats "send notifications").
 */
export function NotificationPrimerModal({ visible, onClose }: Props) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);

  const handleAllow = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const existing = await Notifications.getPermissionsAsync();
      if (existing.status === 'granted') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onClose('granted');
        return;
      }
      if (existing.status === 'denied') {
        // Hard-denied on Android — requestPermissionsAsync is a no-op,
        // user must visit Settings. Bounce to our troubleshoot flow
        // which explains every step.
        onClose('denied');
        router.push('/profile/notification-troubleshoot' as any);
        return;
      }
      const req = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          // Same options as push.ts ensurePermission — iOS shows the system
          // dialog only once, so every request path must ask for the same
          // grants. allowCriticalAlerts is deliberately omitted until the
          // critical-alerts entitlement is granted and declared in app.json;
          // requesting it unentitled risks burning this one-shot dialog with
          // a failed authorization request.
          allowProvisional: false,
        },
      });
      if (req.status === 'granted') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onClose('granted');
      } else {
        onClose('denied');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => onClose('dismissed')}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? 48 : 64 }]}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="notifications" size={36} color="#FFFFFF" />
            </View>
          </View>
          <Text style={[styles.title, { fontSize: t.font2xl }]}>
            Stay safe. Stay connected.
          </Text>
          <Text style={[styles.subtitle, { fontSize: t.fontBase }]}>
            We use three types of alerts so you only get interrupted when it really matters.
          </Text>

          <TypeRow
            tone="#16A34A"
            iconBg="#DCFCE7"
            icon="megaphone"
            title="News & Updates"
            example="“Diwali pooja in clubhouse at 7 pm”"
            note="Soft sound. No lockscreen takeover."
            t={t}
          />
          <TypeRow
            tone="#D97706"
            iconBg="#FEF3C7"
            icon="cube"
            title="Deliveries & Visitors"
            example="“Amazon delivery is at the gate”"
            note="Chime + lockscreen. Approve or reject from the lock screen."
            t={t}
          />
          <TypeRow
            tone="#DC2626"
            iconBg="#FEE2E2"
            icon="warning"
            title="Emergency"
            example="“SOS — Mrs. Sharma needs help”"
            note="Loud siren + full lockscreen. Always on."
            t={t}
          />

          <View style={{ height: 24 }} />

          <Pressable
            onPress={handleAllow}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Allow notifications"
            style={({ pressed }) => [
              styles.primaryBtn,
              { minHeight: t.touchTarget, opacity: pressed || busy ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.primaryText, { fontSize: t.fontBase }]}>
              {busy ? 'Just a moment…' : 'Allow notifications'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onClose('dismissed')}
            accessibilityRole="button"
            accessibilityLabel="Maybe later"
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.secondaryText, { fontSize: t.fontBase }]}>Maybe later</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function TypeRow({
  tone,
  iconBg,
  icon,
  title,
  example,
  note,
  t,
}: {
  tone: string;
  iconBg: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  example: string;
  note: string;
  t: any;
}) {
  return (
    <View style={[styles.card, { borderLeftColor: tone }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={tone} />
        </View>
        <Text style={[styles.cardTitle, { fontSize: t.fontLg }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Text style={[styles.cardExample, { fontSize: t.fontBase }]} numberOfLines={2}>
        {example}
      </Text>
      <Text style={[styles.cardNote, { fontSize: t.fontSm }]} numberOfLines={2}>
        {note}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  iconHeader: { alignItems: 'center', marginBottom: 16 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#821A52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    color: '#111827',
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 4,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: '#111827', fontWeight: '700', flex: 1 },
  cardExample: { color: '#1F2937', fontStyle: 'italic', marginBottom: 4 },
  cardNote: { color: '#6B7280' },
  primaryBtn: {
    backgroundColor: '#821A52',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryBtn: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  secondaryText: { color: '#6B7280', fontWeight: '600' },
});
