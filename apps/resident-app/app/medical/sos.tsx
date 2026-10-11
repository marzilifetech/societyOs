import { useState, useEffect, useRef } from 'react';
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
  Linking,
  Vibration,
  Animated,
  Easing,
} from 'react-native';
import { unwrapApiEnvelope } from '@societyos/api-client';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../src/lib/api';
import { pickSecurityContact } from '../../src/utils/emergency-contacts';
import { subscribe } from '../../src/lib/socket';
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

// Public Figma reference (Emergency SOS): node-id=22-1418.
// Full redesign of the SOS flow per the 2026 Figma: Emergency Alert form →
// 5-second cancel window → Alert Sent (live responder status via socket) →
// Resolved / Cancelled summaries, plus the cancel-reason bottom sheet.
//
// API surface: POST /sos/trigger, PATCH /sos/:id/note, PATCH /sos/:id/resolve,
// PATCH /sos/:id/false-alarm; on the shared /events socket the sender gets
// sos:<id>:acknowledged and sos:<id>:closed ({ status: RESOLVED | FALSE_ALARM }).
//
// NOTE: per-responder acknowledgement + arrival counts have no backend — the
// UI derives what it can from the single acknowledge event and local timing.
// SOS history lives at /medical/sos-history.

type Coords = { lat: number; lng: number };

/** How long a send may wait for a GPS fix before going out without one. */
const LOCATION_WAIT_MS = 2000;

const wait = (ms: number) => new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));

function toCoords(loc: Location.LocationObject | null | undefined): Coords | null {
  return loc ? { lat: loc.coords.latitude, lng: loc.coords.longitude } : null;
}

type Phase = 'form' | 'sending' | 'active' | 'resolved' | 'cancelled';

const CANCEL_REASONS = [
  'Feeling better now',
  'Help already here',
  'Accidental press',
  'Situation Resolved',
];

const SENT_TO = [
  { label: 'Help Desk', render: (c: string, s: number) => <MaterialCommunityIcons name="headset" size={s} color={c} /> },
  { label: 'First Responder', render: (c: string, s: number) => <Ionicons name="people-outline" size={s} color={c} /> },
  { label: 'Security Gate', render: (c: string, s: number) => <Ionicons name="shield-outline" size={s} color={c} /> },
];

const RESPONDERS = [
  { label: 'Help Desk', ack: 'Dispatching help', render: (c: string, s: number) => <MaterialCommunityIcons name="headset" size={s} color={c} /> },
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
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>('form');
  const [details, setDetails] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [alertId, setAlertId] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelComments, setCancelComments] = useState('');

  const times = useRef<{ sentAt?: number; ackAt?: number; endAt?: number }>({});
  // Bumped by every Send and every Cancel: a trigger response that comes back
  // after its send was cancelled (or superseded) must not revive the alert.
  const sendSeq = useRef(0);
  const triggering = useRef(false);
  // Location lookup started with the countdown, so the fix is usually ready
  // by the time the alert goes out.
  const fix = useRef<Promise<Coords | null>>(Promise.resolve(null));
  const lastKnown = useRef<Coords | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['resident-profile'],
    queryFn: () => api.get<any>('/residents/me'),
    staleTime: 5 * 60_000,
  });
  const { data: contactsData } = useQuery({
    queryKey: ['emergency-contacts'],
    queryFn: () => api.get<any>('/residents/society/emergency-contacts'),
    staleTime: 30 * 60_000,
  });
  const security = pickSecurityContact(contactsData);

  const name = profile?.user?.name ?? useAuthStore.getState().user?.name ?? 'Resident';
  const flat = profile?.flat ? `${profile.flat.block} - ${profile.flat.number}` : '—';
  const locationStr = coords
    ? `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E`
    : phase === 'form'
    ? '—'
    : phase === 'sending'
    ? 'Locating…'
    : 'Not available';

  /** Error alert that offers a direct call to security when we know the number. */
  const showFailure = (title: string, message: string) => {
    const buttons: { text: string; style?: 'cancel'; onPress?: () => void }[] = [{ text: 'OK', style: 'cancel' }];
    if (security) {
      buttons.push({
        text: `Call ${security.label}`,
        onPress: () => {
          Linking.openURL(`tel:${security.phone.replace(/\s/g, '')}`).catch(() => {});
        },
      });
    }
    Alert.alert(title, security ? message : `${message} Please call security directly.`, buttons);
  };

  const infoRows = [
    { label: 'Name:', value: name },
    { label: 'Flat:', value: flat },
    { label: 'Location:', value: locationStr },
  ];

  // ---- send / cancel / resolve ----------------------------------------------
  const startLocating = () => {
    lastKnown.current = null;
    setCoords(null);
    fix.current = (async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          ({ status } = await Location.requestForegroundPermissionsAsync());
        }
        if (status !== 'granted') return null;
        Location.getLastKnownPositionAsync()
          .then((loc) => {
            lastKnown.current = toCoords(loc);
          })
          .catch(() => {});
        const current = toCoords(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
        if (current) setCoords(current);
        return current;
      } catch {
        return null; // location is optional
      }
    })();
  };

  const doTrigger = async () => {
    if (triggering.current) return;
    triggering.current = true;
    const seq = sendSeq.current;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    Vibration.vibrate([0, 200, 100, 200]);
    try {
      // Never hold an emergency for GPS: take whatever fix arrives within the
      // cap, else the last known position, else send without coordinates.
      const position = (await Promise.race([fix.current, wait(LOCATION_WAIT_MS)])) ?? lastKnown.current;
      if (position) setCoords(position);
      if (seq !== sendSeq.current) return; // cancelled before it went out
      const raw = await api.post<object>('/sos/trigger', position ?? {});
      const alert = unwrapApiEnvelope<{ id: string }>(raw);
      if (seq !== sendSeq.current) {
        // Cancelled while the request was in flight — withdraw the alert it created.
        api.patch(`/sos/${alert.id}/false-alarm`, {}).catch(() =>
          showFailure(
            'Alert could not be withdrawn',
            'Your SOS reached security before it was cancelled. Please let them know you are safe.',
          ),
        );
        return;
      }
      setAlertId(alert.id);
      times.current.sentAt = Date.now();
      const note = details.trim();
      if (note) api.patch(`/sos/${alert.id}/note`, { note }).catch(() => {});
      setPhase('active');
    } catch (err) {
      if (seq !== sendSeq.current) return;
      Vibration.cancel();
      showFailure('SOS not sent', err instanceof Error && err.message ? err.message : 'Could not send SOS.');
      setPhase('form');
    } finally {
      triggering.current = false;
      setBusy(false);
    }
  };

  const doTriggerRef = useRef(doTrigger);
  doTriggerRef.current = doTrigger;

  // Countdown while in the 5-second cancel window; the send fires from the
  // effect below (not inside a state updater, which may run twice).
  useEffect(() => {
    if (phase !== 'sending') return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === 'sending' && countdown === 0) doTriggerRef.current();
  }, [phase, countdown]);

  const startSending = () => {
    if (busy) return;
    Haptics.selectionAsync().catch(() => {});
    sendSeq.current += 1;
    startLocating();
    setCountdown(5);
    setPhase('sending');
  };
  const cancelSending = () => {
    sendSeq.current += 1;
    Vibration.cancel();
    setPhase('form');
  };

  const markResolved = async () => {
    if (!alertId || busy) return;
    setBusy(true);
    try {
      await api.patch(`/sos/${alertId}/resolve`, {});
      times.current.endAt = Date.now();
      Vibration.cancel();
      setPhase('resolved');
    } catch (err) {
      showFailure('Could not mark as resolved', err instanceof Error && err.message ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = async () => {
    if (!alertId || busy) return;
    setBusy(true);
    const note = [cancelReason, cancelComments.trim()].filter(Boolean).join(' — ');
    try {
      if (note) await api.patch(`/sos/${alertId}/note`, { note }).catch(() => {});
      await api.patch(`/sos/${alertId}/false-alarm`, {});
      times.current.endAt = Date.now();
      Vibration.cancel();
      setShowCancel(false);
      setPhase('cancelled');
    } catch (err) {
      showFailure(
        'Could not cancel the alert',
        err instanceof Error && err.message ? err.message : 'Your SOS is still active.',
      );
    } finally {
      setBusy(false);
    }
  };

  const backHome = () => {
    Vibration.cancel();
    router.replace('/(tabs)');
  };

  // Live updates for the sender arrive on the shared /events socket (it owns
  // auth, connection and rooms; we only add and remove listeners): flip
  // responder rows on the ack, and close the alert when security resolves it
  // or marks a false alarm.
  useEffect(() => {
    if (phase !== 'active' || !alertId) return;
    const onAck = () => {
      setAcknowledged(true);
      times.current.ackAt = Date.now();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    };
    const onClosed = (payload: unknown) => {
      times.current.endAt = Date.now();
      Vibration.cancel();
      setShowCancel(false);
      setPhase((payload as { status?: string } | null)?.status === 'FALSE_ALARM' ? 'cancelled' : 'resolved');
    };
    const offAck = subscribe(`sos:${alertId}:acknowledged`, onAck);
    const offClosed = subscribe(`sos:${alertId}:closed`, onClosed);
    return () => {
      offAck();
      offClosed();
    };
  }, [phase, alertId]);

  useEffect(
    () => () => {
      Vibration.cancel();
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
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 8, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Beacon */}
          <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 12 }}>
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
              : 'Send instant alert to security and nearby responders'}
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
              ]}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder, paddingBottom: insets.bottom }}>
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6, gap: 10 }}>
          {phase === 'form' && (
            <PillButton label="Send Alert" tone="dark" onPress={startSending} loading={busy} disabled={busy} />
          )}
          {phase === 'sending' && (
            <PillButton label="Cancel SOS Alert" tone="ghost" onPress={cancelSending} />
          )}
          {phase === 'active' && (
            <>
              <PillButton label="Mark As Resolved" tone="dark" onPress={markResolved} loading={busy} disabled={busy} />
              <PillButton label="Cancel SOS Alert" tone="ghost" onPress={() => setShowCancel(true)} disabled={busy} />
            </>
          )}
          {(phase === 'resolved' || phase === 'cancelled') && (
            <PillButton label="Back to Home" tone="dark" onPress={backHome} />
          )}
        </View>
      </View>

      {/* Cancel-reason bottom sheet */}
      <Modal visible={showCancel} transparent animationType="slide" onRequestClose={() => setShowCancel(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCancel(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom }}>
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
                  <PillButton label="Yes, Cancel SOS" tone="danger" onPress={confirmCancel} loading={busy} disabled={busy} />
                  <PillButton label="Keep SOS Active" tone="light" onPress={() => setShowCancel(false)} />
                </View>
              </View>
            </View>
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
  const OUTER = 180;
  const MID = 148;
  const CORE = 112;
  const base = tone === 'red' ? '196,40,71' : '46,158,91';
  const coreColors: [string, string] =
    tone === 'red' ? ['#D6537A', '#A81B3C'] : ['#5FB983', '#1F7A45'];

  // Uses React Native's built-in Animated rather than Reanimated.
  //
  // Reanimated threw "Cannot find host instance for this component" here and
  // the ErrorBoundary swallowed the whole SOS screen into "Something went
  // wrong" — on the one screen that must never fail. Its Animated.View could
  // not resolve a host instance under the NativeWind JSX interop we are pinned
  // to (see Tappable.tsx for the same class of problem). This file was the only
  // Reanimated consumer in the app; every other animation already uses the
  // built-in API, which needs no interop and no worklet runtime.
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulse) {
      Animated.timing(scale, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, scale]);
  const ringStyle = { transform: [{ scale }] };

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
