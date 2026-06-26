import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  onClose: (outcome: 'granted' | 'denied' | 'dismissed') => void;
};

/**
 * Staff-side notification permission primer. Bottom-sheet style, matching the
 * resident app so the look + feel stays consistent across both surfaces.
 *
 * Triggered once just-in-time, after the staff user lands on Home post-PIN.
 * Avoids the bare OS prompt — research (Mixpanel, Slack) shows the soft
 * prompt-first approach roughly triples acceptance.
 *
 * Copy is staff-flavoured:
 *   - Tasks & assignments (DEFAULT importance, sound + vibrate)
 *   - Visitors & gate (HIGH importance, lockscreen actions)
 *   - Emergency SOS (MAX importance, siren, always-on)
 */
export function NotificationPrimerModal({ visible, onClose }: Props) {
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
        // Hard-denied — request is a no-op; close as denied and rely on the
        // settings link in Profile to recover.
        onClose('denied');
        return;
      }
      const req = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: true,
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
      transparent
      onRequestClose={() => onClose('dismissed')}
      statusBarTranslucent
    >
      <Pressable onPress={() => onClose('dismissed')} style={styles.backdrop} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <View style={styles.heroWrap}>
            <View style={styles.heroHalo}>
              <View style={styles.heroCircle}>
                <Ionicons name="notifications" size={36} color="#FFFFFF" />
              </View>
            </View>
            <View style={[styles.sparkle, styles.sparkleA]} />
            <View style={[styles.sparkle, styles.sparkleB]} />
            <View style={[styles.sparkle, styles.sparkleC]} />
          </View>

          <Text style={styles.title}>Stay on top of your shift</Text>
          <Text style={styles.subtitle}>
            Three kinds of alerts, tuned for guards. You won&apos;t miss what matters.
          </Text>

          <View style={styles.benefits}>
            <BenefitRow
              tone="#16A34A"
              iconBg="#DCFCE7"
              icon="clipboard"
              title="Tasks & assignments"
              body="A soft ping when a new ticket or rounding task lands."
            />
            <BenefitRow
              tone="#D97706"
              iconBg="#FEF3C7"
              icon="people"
              title="Visitors at the gate"
              body="Heads-up with the resident's reply so you act fast."
            />
            <BenefitRow
              tone="#DC2626"
              iconBg="#FEE2E2"
              icon="warning"
              title="Emergency SOS"
              body="Loud siren + lockscreen. Always reaches you."
            />
          </View>

          <Pressable
            onPress={handleAllow}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Allow notifications"
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.primaryText}>
              {busy ? 'Just a moment…' : 'Allow notifications'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </Pressable>

          <Pressable
            onPress={() => onClose('dismissed')}
            accessibilityRole="button"
            accessibilityLabel="Not right now"
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.55 }]}
          >
            <Text style={styles.secondaryText}>Not right now</Text>
          </Pressable>

          <Text style={styles.footnote}>
            You can change this any time in Profile → Notification settings.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function BenefitRow({
  tone,
  iconBg,
  icon,
  title,
  body,
}: {
  tone: string;
  iconBg: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.benefitRow}>
      <View style={[styles.benefitIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitBody} numberOfLines={2}>{body}</Text>
      </View>
    </View>
  );
}

const PRIMARY = '#1E3A5F'; // staff app primary (navy)

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 10, paddingBottom: 24, maxHeight: '92%',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 }, elevation: 16,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 5, borderRadius: 3,
    backgroundColor: '#E5E7EB', marginBottom: 18,
  },
  heroWrap: { alignItems: 'center', justifyContent: 'center', height: 110, position: 'relative', marginBottom: 8 },
  heroHalo: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#E0EAF7',
    alignItems: 'center', justifyContent: 'center',
  },
  heroCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowOpacity: 0.35, shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  sparkle: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#C5D5EB' },
  sparkleA: { top: 16, left: 60, transform: [{ scale: 1.2 }] },
  sparkleB: { top: 28, right: 56, transform: [{ scale: 0.9 }] },
  sparkleC: { bottom: 14, right: 80, transform: [{ scale: 0.7 }] },
  title: {
    textAlign: 'center', color: '#111827', fontWeight: '800',
    fontSize: 24, marginTop: 6, marginBottom: 8, letterSpacing: -0.4,
  },
  subtitle: {
    textAlign: 'center', color: '#6B7280', fontSize: 14,
    lineHeight: 22, marginBottom: 24, paddingHorizontal: 16,
  },
  benefits: { gap: 14, marginBottom: 28 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  benefitIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  benefitTitle: { color: '#111827', fontWeight: '700', fontSize: 16, marginBottom: 2 },
  benefitBody: { color: '#6B7280', fontSize: 13, lineHeight: 18 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16, minHeight: 56,
    shadowColor: PRIMARY, shadowOpacity: 0.35, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.2 },
  secondaryBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  secondaryText: { color: '#6B7280', fontWeight: '600', fontSize: 13 },
  footnote: { marginTop: 14, textAlign: 'center', color: '#9CA3AF', fontSize: 11 },
});
