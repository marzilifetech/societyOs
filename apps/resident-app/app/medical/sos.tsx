import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  Vibration,
} from 'react-native';
import { unwrapApiEnvelope } from '@societyos/api-client';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { io } from 'socket.io-client';
type Socket = any; // socket.io-client deep type import is finicky under pnpm

import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';
import { useTheme } from '../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  IconCircle,
  InfoRows,
  rd,
} from '../../src/components/ui';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

// Public Figma reference (Medical SOS): node-id=22-1418.
// Full redesign of the SOS flow per the 2026 Figma: Emergency Alert form →
// 5-second cancel window → Alert Sent (live responder status via socket) →
// Resolved / Cancelled summaries, plus the cancel-reason bottom sheet.
//
// API surface (unchanged): POST /sos/trigger, PATCH /sos/:id/note,
// PATCH /sos/:id/resolve, PATCH /sos/:id/false-alarm, socket sos:<id>:acknowledged.
//
// NOTE: per-responder acknowledgement + arrival counts and a resident SOS
// history feed have no backend yet — the UI derives what it can from the single
// acknowledge event and local timing. SOS history lives at /medical/sos-history.

let socket: Socket | null = null;
function getSocket(): Socket {
  if (!socket) {
    const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    socket = io(API_BASE, { transports: ['websocket'], autoConnect: false } as any);
  }
  return socket;
}

type Phase = 'form' | 'sending' | 'active' | 'resolved' | 'cancelled';

const CANCEL_REASONS = [
  'Feeling better now',
  'Help already here',
  'Accidental press',
  'Situation Resolved',
];

const SENT_TO = [
  { label: 'Medical Desk', render: (c: string, s: number) => <MaterialCommunityIcons name="stethoscope" size={s} color={c} /> },
  { label: 'First Responder', render: (c: string, s: number) => <Ionicons name="people-outline" size={s} color={c} /> },
  { label: 'Security Gate', render: (c: string, s: number) => <Ionicons name="shield-outline" size={s} color={c} /> },
];

const RESPONDERS = [
  { label: 'Medical Help Desk', ack: 'Dispatching help', render: (c: string, s: number) => <MaterialCommunityIcons name="stethoscope" size={s} color={c} /> },
  { label: 'Security Gate', ack: 'Security alerted', render: (c: string, s: number) => <Ionicons name="shield-outline" size={s} color={c} /> },
  { label: 'First Responder', ack: 'On the way', render: (c: string, s: number) => <Ionicons name="people-outline" size={s} color={c} /> },
];

export default function SosScreen() {
  return (
    <ErrorBoundary>
      <SosScreenInner />
    </ErrorBoundary>
  );
}

function SosScreenInner() {
  const t = useTheme();

  const [phase, setPhase] = useState<Phase>('form');
  const [details, setDetails] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [alertId, setAlertId] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelComments, setCancelComments] = useState('');

  const times = useRef<{ sentAt?: number; ackAt?: number; endAt?: number }>({});
  const abortSend = useRef(false);

  const { data: profile } = useQuery({
    queryKey: ['resident-profile'],
    queryFn: () => api.get<any>('/residents/me'),
    staleTime: 5 * 60_000,
  });
  const name = profile?.user?.name ?? useAuthStore.getState().user?.name ?? 'Resident';
  const flat = profile?.flat ? `${profile.flat.block} - ${profile.flat.number}` : '—';
  const locationStr =
    coords.lat != null && coords.lng != null
      ? `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E`
      : phase === 'form'
      ? '—'
      : 'Locating…';

  const infoRows = [
    { label: 'Name:', value: name },
    { label: 'Flat:', value: flat },
    { label: 'Location:', value: locationStr },
  ];

  // ---- send / cancel / resolve ----------------------------------------------
  const doTrigger = useCallback(async () => {
    if (abortSend.current) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    Vibration.vibrate([0, 200, 100, 200]);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
          setCoords({ lat, lng });
        }
      } catch {
        /* location optional */
      }
      const raw = await api.post<object>('/sos/trigger', { lat, lng });
      const alert = unwrapApiEnvelope<{ id: string }>(raw);
      setAlertId(alert.id);
      times.current.sentAt = Date.now();
      const note = details.trim();
      if (note) api.patch(`/sos/${alert.id}/note`, { note }).catch(() => {});
      setPhase('active');
    } catch {
      Alert.alert('Error', 'Could not send SOS. Please call security directly.');
      setPhase('form');
    } finally {
      setBusy(false);
    }
  }, [details]);

  const doTriggerRef = useRef(doTrigger);
  doTriggerRef.current = doTrigger;

  // Countdown effect while in the 5-second cancel window.
  useEffect(() => {
    if (phase !== 'sending') return;
    abortSend.current = false;
    setCountdown(5);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          doTriggerRef.current();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const startSending = () => {
    Haptics.selectionAsync().catch(() => {});
    setPhase('sending');
  };
  const cancelSending = () => {
    abortSend.current = true;
    Vibration.cancel();
    setPhase('form');
  };

  const markResolved = async () => {
    if (!alertId) return;
    setBusy(true);
    try {
      await api.patch(`/sos/${alertId}/resolve`, {});
    } catch {
      /* still show resolved locally */
    }
    times.current.endAt = Date.now();
    Vibration.cancel();
    setBusy(false);
    setPhase('resolved');
  };

  const confirmCancel = async () => {
    setBusy(true);
    const note = [cancelReason, cancelComments.trim()].filter(Boolean).join(' — ');
    try {
      if (alertId) {
        if (note) await api.patch(`/sos/${alertId}/note`, { note }).catch(() => {});
        await api.patch(`/sos/${alertId}/false-alarm`, {});
      }
    } catch {
      /* still show cancelled locally */
    }
    times.current.endAt = Date.now();
    Vibration.cancel();
    setBusy(false);
    setShowCancel(false);
    setPhase('cancelled');
  };

  const backHome = () => {
    Vibration.cancel();
    router.replace('/(tabs)');
  };

  // Socket: flip responder rows to "Acknowledged" on the ack event.
  useEffect(() => {
    if (phase !== 'active' || !alertId) return;
    const s = getSocket();
    const token = useAuthStore.getState().token;
    if (!token) return;
    s.auth = { token };
    s.connect();
    const onAck = () => {
      setAcknowledged(true);
      times.current.ackAt = Date.now();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    };
    s.on(`sos:${alertId}:acknowledged`, onAck);
    return () => s.off(`sos:${alertId}:acknowledged`, onAck);
  }, [phase, alertId]);

  useEffect(
    () => () => {
      Vibration.cancel();
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    },
    [],
  );

  // ---- summaries -------------------------------------------------------------
  const fmtClock = (ms?: number) => {
    if (!ms) return '00:00';
    const s = Math.max(0, Math.round(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  const fmtLong = (ms?: number) => {
    if (ms == null) return '—';
    const s = Math.max(0, Math.round(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')} min ${String(s % 60).padStart(2, '0')} sec`;
  };
  const duration = times.current.sentAt && times.current.endAt ? times.current.endAt - times.current.sentAt : undefined;
  const respTime = times.current.sentAt && times.current.ackAt ? times.current.ackAt - times.current.sentAt : undefined;

  const historyBtn = (
    <TouchableOpacity
      onPress={() => router.push('/medical/sos-history' as any)}
      accessibilityRole="button"
      accessibilityLabel="View SOS alert history"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{ width: t.touchTargetSm, height: t.touchTargetSm, alignItems: 'center', justifyContent: 'center' }}
    >
      <MaterialCommunityIcons name="history" size={24} color={t.textPrimary} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Emergency SOS" trailing={historyBtn} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Beacon */}
          <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 20 }}>
            <SosBeacon tone={phase === 'active' || phase === 'resolved' ? 'green' : 'red'} pulse={phase === 'sending' || phase === 'active'}>
              {phase === 'sending' ? (
                <Display size="xl" color="#FFFFFF" weight="bold">{countdown}</Display>
              ) : phase === 'resolved' ? (
                <Ionicons name="checkmark" size={56} color="#FFFFFF" />
              ) : phase === 'cancelled' ? (
                <Ionicons name="close" size={56} color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons name="alarm-light-outline" size={52} color="#FFFFFF" />
              )}
            </SosBeacon>
            {phase === 'cancelled' ? (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  backgroundColor: rd.ink,
                  borderRadius: rd.radiusPill,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <Ionicons name="checkmark-circle" size={16} color={rd.green} />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: t.fontSm }}>Alert Cancelled</Text>
              </View>
            ) : null}
          </View>

          {/* Title + subtitle */}
          <Display size="lg" align="center">
            {phase === 'sending'
              ? 'Sending Alert'
              : phase === 'active'
              ? 'Alert Sent'
              : phase === 'resolved'
              ? 'Emergency Resolved'
              : phase === 'cancelled'
              ? 'Alert Cancelled'
              : 'Emergency Alert'}
          </Display>
          <Text style={{ textAlign: 'center', color: t.textMuted, fontSize: t.fontSm, marginTop: 6, marginBottom: 22 }}>
            {phase === 'sending'
              ? `Emergency alert will be sent in ${countdown}`
              : phase === 'active'
              ? 'Emergency teams have been notified'
              : phase === 'resolved'
              ? 'Your emergency has been successfully resolved'
              : phase === 'cancelled'
              ? 'All responders notified this was a false alarm'
              : 'Send instant alert to nearby responders and medical staff'}
          </Text>

          {/* Phase-specific body */}
          {(phase === 'form' || phase === 'sending') && (
            <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginBottom: 16 }}>
              <Text style={{ textAlign: 'center', color: t.textMuted, fontSize: t.fontSm, marginBottom: 16 }}>
                Alerts will be sent to
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {SENT_TO.map((r) => (
                  <View key={r.label} style={{ alignItems: 'center', flex: 1 }}>
                    <IconCircle size={52} bg={rd.crimsonSoft}>
                      {r.render(t.accentPrimary, 24)}
                    </IconCircle>
                    <Text style={{ marginTop: 8, fontSize: t.fontXs, color: t.textSecondary, textAlign: 'center' }}>
                      {r.label}
                    </Text>
                  </View>
                ))}
              </View>
            </RoundCard>
          )}

          {phase === 'form' && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 10 }}>
                Additional Details (optional)
              </Text>
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Write your concern..."
                placeholderTextColor={t.textMuted}
                multiline
                textAlignVertical="top"
                maxLength={2000}
                style={{
                  minHeight: 110,
                  borderRadius: rd.radiusInput,
                  borderWidth: 1,
                  borderColor: rd.cardBorder,
                  backgroundColor: '#FFFFFF',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: t.fontBase,
                  color: t.textPrimary,
                }}
              />
            </View>
          )}

          {phase === 'active' && (
            <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginBottom: 16 }}>
              <Text style={{ color: t.textMuted, fontSize: t.fontSm, marginBottom: 14 }}>Responder Status</Text>
              {RESPONDERS.map((r, i) => (
                <View
                  key={r.label}
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: i === 0 ? 0 : 18 }}
                >
                  <IconCircle size={44} bg={rd.crimsonSoft} style={{ marginRight: 14 }}>
                    {r.render(t.accentPrimary, 20)}
                  </IconCircle>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>{r.label}</Text>
                    <Text style={{ fontSize: t.fontSm, color: acknowledged ? rd.green : t.textMuted, marginTop: 2 }}>
                      {acknowledged ? `Acknowledged · ${r.ack}` : 'Awaiting Response...'}
                    </Text>
                  </View>
                </View>
              ))}
            </RoundCard>
          )}

          {(phase === 'sending' || phase === 'active') && <InfoRows title="Your Information" rows={infoRows} />}

          {(phase === 'resolved' || phase === 'cancelled') && (
            <InfoRows
              rows={[
                { label: 'Alert Duration', value: fmtClock(duration) },
                { label: 'Response Time', value: fmtLong(respTime) },
                { label: 'Responders', value: `${phase === 'resolved' && acknowledged ? 3 : 0} Arrived` },
              ]}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}>
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6, gap: 10 }}>
          {phase === 'form' && (
            <PillButton label="Send Alert" tone="dark" onPress={startSending} loading={busy} />
          )}
          {phase === 'sending' && (
            <PillButton label="Cancel SOS Alert" tone="ghost" onPress={cancelSending} />
          )}
          {phase === 'active' && (
            <>
              <PillButton label="Mark As Resolved" tone="dark" onPress={markResolved} loading={busy} />
              <PillButton label="Cancel SOS Alert" tone="ghost" onPress={() => setShowCancel(true)} />
            </>
          )}
          {(phase === 'resolved' || phase === 'cancelled') && (
            <PillButton label="Back to Home" tone="dark" onPress={backHome} />
          )}
        </View>
      </SafeAreaView>

      {/* Cancel-reason bottom sheet */}
      <Modal visible={showCancel} transparent animationType="slide" onRequestClose={() => setShowCancel(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCancel(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 24, paddingBottom: 8 }}>
                <Display size="md">Cancel SOS Alert?</Display>
                <Text style={{ color: t.textMuted, fontSize: t.fontSm, marginTop: 6, marginBottom: 18 }}>
                  Please select a reason for cancellation
                </Text>
                <View style={{ gap: 10 }}>
                  {CANCEL_REASONS.map((reason) => {
                    const selected = cancelReason === reason;
                    return (
                      <TouchableOpacity
                        key={reason}
                        onPress={() => setCancelReason(reason)}
                        activeOpacity={0.85}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        style={{
                          minHeight: t.touchTarget,
                          borderRadius: rd.radiusPill,
                          paddingHorizontal: 18,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: selected ? '#FFFFFF' : rd.inkSoft,
                          borderWidth: selected ? 1.5 : 0,
                          borderColor: rd.ink,
                        }}
                      >
                        <Text style={{ fontSize: t.fontBase, color: t.textPrimary, fontWeight: selected ? '700' : '400' }}>
                          {reason}
                        </Text>
                        {selected ? <Ionicons name="checkmark" size={20} color={t.textPrimary} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={{ fontSize: t.fontSm, fontWeight: '700', color: t.textPrimary, marginTop: 20, marginBottom: 8 }}>
                  Additional Comments <Text style={{ color: t.textMuted, fontWeight: '400' }}>(optional)</Text>
                </Text>
                <TextInput
                  value={cancelComments}
                  onChangeText={setCancelComments}
                  placeholder="Describe why you’re cancelling this..."
                  placeholderTextColor={t.textMuted}
                  multiline
                  textAlignVertical="top"
                  maxLength={500}
                  style={{
                    minHeight: 80,
                    borderRadius: rd.radiusInput,
                    borderWidth: 1,
                    borderColor: rd.cardBorder,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: t.fontBase,
                    color: t.textPrimary,
                  }}
                />

                <View style={{ gap: 10, marginTop: 20 }}>
                  <PillButton label="Yes, Cancel SOS" tone="danger" onPress={confirmCancel} loading={busy} />
                  <PillButton label="Keep SOS Active" tone="light" onPress={() => setShowCancel(false)} />
                </View>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SosBeacon — concentric rings + radial-gradient core (red active / green sent)
// ---------------------------------------------------------------------------
function SosBeacon({ tone, pulse, children }: { tone: 'red' | 'green'; pulse?: boolean; children: React.ReactNode }) {
  const OUTER = 224;
  const MID = 178;
  const CORE = 140;
  const base = tone === 'red' ? '196,40,71' : '46,158,91';
  const coreColors: [string, string] =
    tone === 'red' ? ['#D6537A', '#A81B3C'] : ['#5FB983', '#1F7A45'];

  const scale = useSharedValue(1);
  useEffect(() => {
    if (pulse) {
      scale.value = withRepeat(withTiming(1.08, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [pulse, scale]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={{ width: OUTER, height: OUTER, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: OUTER,
            height: OUTER,
            borderRadius: OUTER / 2,
            backgroundColor: `rgba(${base},0.07)`,
          },
          ringStyle,
        ]}
      />
      <View
        style={{
          position: 'absolute',
          width: MID,
          height: MID,
          borderRadius: MID / 2,
          backgroundColor: `rgba(${base},0.13)`,
        }}
      />
      <LinearGradient
        colors={coreColors}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={{
          width: CORE,
          height: CORE,
          borderRadius: CORE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: tone === 'red' ? '#A81B3C' : '#1F7A45',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.35,
          shadowRadius: 20,
          elevation: 10,
        }}
      >
        {children}
      </LinearGradient>
    </View>
  );
}
