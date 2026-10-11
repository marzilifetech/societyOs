import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Tappable } from './ui/Tappable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

/**
 * Full-screen takeover for an incoming delivery approval push when the app
 * is in the FOREGROUND. Resident sees a giant photo + the courier badge +
 * three big stacked decision buttons.
 *
 * Deliberately NOT dismissible:
 *  - No close button.
 *  - onRequestClose is a no-op so Android's hardware back doesn't sneak past.
 *  - User must pick one of the three actions; each is idempotent at the
 *    backend (a duplicate tap, or a competing lockscreen tap, collapses
 *    safely — see VisitorService.decide).
 *  - If the decision can't be sent, the resident is told and can retry or
 *    close (and decide from the Visitors tab) — never a silent close.
 *
 * For GUEST pushes the existing InAppBanner keeps working — only deliveries
 * trigger this modal. Wired in app/_layout.tsx's ForegroundBannerBridge
 * which inspects data.type before deciding which UI to surface.
 */
export type DeliveryPayload = {
  visitId: string;
  visitorName: string;
  deliveryPartner: string | null;
  photoUrl: string | null;
};

type Decision = 'APPROVE' | 'LEAVE_AT_SECURITY' | 'REJECT';

const PRIMARY = '#821A52';
const APPROVE_GREEN = '#16A34A';
const LEAVE_AMBER = '#D97706';
const REJECT_RED = '#DC2626';

export function DeliveryApprovalModal({
  payload,
  onResolved,
}: {
  payload: DeliveryPayload | null;
  onResolved: () => void;
}) {
  const [busy, setBusy] = useState<Decision | null>(null);
  const qc = useQueryClient();

  const submit = async (decision: Decision) => {
    if (!payload || busy) return;
    setBusy(decision);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      // Idempotent: a duplicate or competing (lockscreen) tap returns the
      // decision that actually won rather than erroring.
      await api.post(`/visitors/${payload.visitId}/decision`, { action: decision });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ['my-visitors'] });
      qc.invalidateQueries({ queryKey: ['visitor', payload.visitId] });
      setBusy(null);
      onResolved();
    } catch (err) {
      setBusy(null);
      Alert.alert(
        'Not sent',
        `${err instanceof Error && err.message ? err.message : 'Your answer did not reach security.'} You can also answer from the Visitors tab.`,
        [
          { text: 'Close', style: 'cancel', onPress: onResolved },
          { text: 'Try again', onPress: () => submit(decision) },
        ],
      );
    }
  };

  return (
    <Modal
      visible={!!payload}
      animationType="slide"
      transparent={false}
      // Block the OS back gesture — the resident MUST decide. They can
      // dismiss only by tapping one of the three action buttons.
      onRequestClose={() => {}}
      statusBarTranslucent
    >
      {payload && (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
              <Ionicons name="cube" size={20} color={PRIMARY} />
              <Text style={styles.headerText}>Delivery at the gate</Text>
            </View>

            <View style={styles.photoWrap}>
              {payload.photoUrl ? (
                <Image
                  source={{ uri: payload.photoUrl }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.photo, styles.photoFallback]}>
                  <Ionicons name="person" size={88} color="#9CA3AF" />
                </View>
              )}
            </View>

            {payload.deliveryPartner ? (
              <View style={styles.partnerPill}>
                <Text style={styles.partnerText}>{payload.deliveryPartner.toUpperCase()}</Text>
              </View>
            ) : null}
            <Text style={styles.name} numberOfLines={1}>
              {payload.visitorName}
            </Text>
            <Text style={styles.sub}>What should we do?</Text>

            <View style={styles.buttons}>
              <Tappable
                onPress={() => submit('APPROVE')}
                disabled={!!busy}
                accessibilityRole="button"
                accessibilityLabel="Approve and let them come up"
                style={[styles.actionBtn, { backgroundColor: APPROVE_GREEN, opacity: busy ? 0.85 : 1 }]}
                pressedStyle={{ opacity: 0.85 }}
              >
                {busy === 'APPROVE' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color="#fff" />
                    <Text style={styles.actionText}>Approve & let them in</Text>
                  </>
                )}
              </Tappable>

              <Tappable
                onPress={() => submit('LEAVE_AT_SECURITY')}
                disabled={!!busy}
                accessibilityRole="button"
                accessibilityLabel="Leave at security"
                style={[styles.actionBtn, { backgroundColor: LEAVE_AMBER, opacity: busy ? 0.85 : 1 }]}
                pressedStyle={{ opacity: 0.85 }}
              >
                {busy === 'LEAVE_AT_SECURITY' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="arrow-down-circle" size={22} color="#fff" />
                    <Text style={styles.actionText}>Leave at security</Text>
                  </>
                )}
              </Tappable>

              <Tappable
                onPress={() => submit('REJECT')}
                disabled={!!busy}
                accessibilityRole="button"
                accessibilityLabel="Reject"
                style={[styles.rejectBtn, { opacity: busy ? 0.7 : 1 }]}
                pressedStyle={{ opacity: 0.7 }}
              >
                {busy === 'REJECT' ? (
                  <ActivityIndicator color={REJECT_RED} />
                ) : (
                  <Text style={styles.rejectText}>Reject</Text>
                )}
              </Tappable>
            </View>
          </ScrollView>
        </SafeAreaView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  headerText: { fontSize: 14, fontWeight: '700', color: PRIMARY, letterSpacing: 0.5 },
  photoWrap: { width: '100%', alignItems: 'center', marginBottom: 20 },
  photo: { width: '100%', height: 320, borderRadius: 20, backgroundColor: '#F3F4F6' },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  partnerPill: {
    alignSelf: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  partnerText: { fontSize: 12, fontWeight: '800', color: '#92400E', letterSpacing: 1 },
  name: { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 6 },
  sub: { fontSize: 15, color: '#4B5563', textAlign: 'center', marginBottom: 24 },
  buttons: { width: '100%', gap: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 60,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  actionText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  rejectBtn: {
    minHeight: 56,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: REJECT_RED,
  },
  rejectText: { color: REJECT_RED, fontSize: 16, fontWeight: '700' },
});
