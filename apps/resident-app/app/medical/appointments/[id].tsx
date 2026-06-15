import { useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';
import { useTheme } from '../../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  InfoRows,
  IconCircle,
  rd,
} from '../../../src/components/ui';

// Figma refs: frames 4,5,6,7,8,9,10,11,12,13
// API: GET /medical/appointments/:id, PATCH /medical/appointments/:id/cancel,
//      PATCH /medical/appointments/:id/reschedule {start}, POST /medical/appointments/:id/rate {rating, comment}

type AppointmentDetail = {
  id: string;
  doctor: { name: string; designation?: string; specialization?: string };
  date: string;
  timeSlot: string;
  status: 'BOOKED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes?: string;
  cancellable?: boolean;
  reason?: string;
};

const CANCEL_REASONS = [
  'Booked by mistake',
  'Feeling better now',
  'Appointment not needed',
  "Can't make this time",
];

const isUpcoming = (s: AppointmentDetail['status']) => s === 'BOOKED' || s === 'CONFIRMED';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  return `${day} ${month}`;
}

function fmtFull(iso: string, slot: string): string {
  return `${fmtDate(iso)}, ${slot}`;
}

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const t = useTheme();

  // Cancel sheet state
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelComments, setCancelComments] = useState('');

  // Rate sheet state
  const [showRate, setShowRate] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Toast-style banner (Appointment Rescheduled, Rating Submitted, Appointment Cancelled)
  const [banner, setBanner] = useState<string | null>(null);

  const { data: apt, isLoading, isError, refetch } = useQuery<AppointmentDetail>({
    queryKey: ['appointment', id],
    queryFn: () => api.get<AppointmentDetail>(`/medical/appointments/${id}`),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      api.patch(`/medical/appointments/${id}/cancel`, {
        reason: cancelReason ?? undefined,
        comment: cancelComments.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointment', id] });
      qc.invalidateQueries({ queryKey: ['my-appointments'] });
      setShowCancel(false);
      setBanner('Appointment Cancelled');
    },
    onError: (err: any) => {
      setShowCancel(false);
      Alert.alert('Error', err?.message ?? 'Failed to cancel appointment. Please try again.');
    },
  });

  const rateMutation = useMutation({
    mutationFn: () =>
      api.post(`/medical/appointments/${id}/rate`, {
        rating,
        comment: ratingComment.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointment', id] });
      setShowRate(false);
      setRatingSubmitted(true);
      setBanner('Rating Submitted');
    },
    onError: (err: any) => {
      setShowRate(false);
      Alert.alert('Error', err?.message ?? 'Failed to submit rating. Please try again.');
    },
  });

  // History icon trailing
  const historyBtn = (
    <TouchableOpacity
      onPress={() => router.push('/medical/appointments' as any)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{ width: t.touchTargetSm, height: t.touchTargetSm, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="button"
      accessibilityLabel="View appointment history"
    >
      <Ionicons name="time-outline" size={22} color={t.textPrimary} />
    </TouchableOpacity>
  );

  const renderBeacon = useCallback((tone: 'green' | 'red') => {
    const bg = tone === 'green' ? rd.green : rd.crimson;
    const soft = tone === 'green' ? 'rgba(46,158,91,0.15)' : 'rgba(196,40,71,0.12)';
    const mid = tone === 'green' ? 'rgba(46,158,91,0.20)' : 'rgba(196,40,71,0.18)';
    return (
      <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 16 }}>
        <View style={{ width: 160, height: 160, borderRadius: 80, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: mid, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
              {tone === 'green'
                ? <Ionicons name="checkmark" size={44} color="#FFFFFF" />
                : <Ionicons name="close" size={44} color="#FFFFFF" />
              }
            </View>
          </View>
        </View>
      </View>
    );
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader title="Appointment Details" trailing={historyBtn} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.accentPrimary} size="large" />
        </View>
      </View>
    );
  }

  if (isError || !apt) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader title="Appointment Details" trailing={historyBtn} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <IconCircle size={64} bg={rd.amberSoft}>
            <Ionicons name="warning" size={32} color="#B45309" />
          </IconCircle>
          <Text style={{ color: t.textPrimary, fontSize: t.fontLg, fontWeight: '700', marginTop: 16, marginBottom: 16 }}>Failed to load</Text>
          <PillButton label="Retry" tone="dark" onPress={() => refetch()} fullWidth={false} />
        </View>
      </View>
    );
  }

  const isCancelled = apt.status === 'CANCELLED';
  const isDone = apt.status === 'COMPLETED' || apt.status === 'NO_SHOW';
  const isBooked = isUpcoming(apt.status);

  const bookingRows = [
    { label: 'Date & Time:', value: fmtFull(apt.date, apt.timeSlot) },
    ...(apt.reason ? [{ label: 'Reason', value: apt.reason }] : []),
    ...(apt.notes ? [{ label: 'Notes for Doctor:', value: '' }] : []),
  ];

  const titleText = isCancelled
    ? 'Appointment Cancelled'
    : isDone
    ? 'Appointment Done'
    : 'Appointment Booked';

  const subtitleText = isCancelled
    ? 'Doctor has been notified.'
    : isDone
    ? 'Your appointment has been completed.'
    : 'Your appointment has been booked.';

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Appointment Details" trailing={historyBtn} />

      {/* Toast banner */}
      {banner ? (
        <View
          style={{
            backgroundColor: rd.ink,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            paddingHorizontal: 20,
            gap: 8,
            marginHorizontal: t.screenPadding,
            marginTop: 8,
            borderRadius: rd.radiusPill,
          }}
        >
          <Ionicons name="checkmark-circle" size={16} color={rd.green} />
          <Text style={{ color: '#FFFFFF', fontSize: t.fontSm, fontWeight: '700' }}>{banner}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 4, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {renderBeacon(isCancelled ? 'red' : 'green')}

        <Display size="md" align="center" style={{ marginBottom: 6 }}>{titleText}</Display>
        <Text style={{ textAlign: 'center', fontSize: t.fontSm, color: t.textMuted, marginBottom: 24 }}>{subtitleText}</Text>

        {/* Booking Details card */}
        <RoundCard tone="gray" padding={t.cardPaddingLg} style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 14 }}>Booking Details</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: t.fontBase, color: t.textSecondary }}>Date & Time:</Text>
            <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>{fmtFull(apt.date, apt.timeSlot)}</Text>
          </View>
          {apt.reason ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: t.fontBase, color: t.textSecondary }}>Reason</Text>
              <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>{apt.reason}</Text>
            </View>
          ) : null}
          {apt.notes ? (
            <View style={{ marginTop: apt.reason ? 0 : 0 }}>
              <Text style={{ fontSize: t.fontBase, color: t.textSecondary, marginBottom: 6 }}>
                {isCancelled || isDone ? 'Description:' : 'Notes for Doctor:'}
              </Text>
              <Text style={{ fontSize: t.fontBase, color: t.textPrimary, lineHeight: t.fontBase * 1.5 }}>{apt.notes}</Text>
            </View>
          ) : null}
        </RoundCard>
      </ScrollView>

      {/* Footer */}
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}>
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6, gap: 10 }}>
          {isBooked ? (
            <>
              <PillButton
                label="Reschedule Appointment"
                tone="dark"
                onPress={() => router.push({ pathname: '/medical/appointments/reschedule', params: { id } } as any)}
              />
              <PillButton
                label="Cancel Appointment"
                tone="ghost"
                textColor={rd.crimson}
                onPress={() => setShowCancel(true)}
              />
            </>
          ) : isDone ? (
            ratingSubmitted ? (
              <PillButton label="Back to Home" tone="dark" onPress={() => router.replace('/(tabs)' as any)} />
            ) : (
              <>
                <PillButton label="Book Again" tone="dark" onPress={() => router.push('/medical/book' as any)} />
                <PillButton label="Rate Experience" tone="light" onPress={() => setShowRate(true)} />
              </>
            )
          ) : isCancelled ? (
            <PillButton label="Back to Home" tone="dark" onPress={() => router.replace('/(tabs)' as any)} />
          ) : null}
        </View>
      </SafeAreaView>

      {/* Cancel bottom sheet */}
      <Modal visible={showCancel} transparent animationType="slide" onRequestClose={() => setShowCancel(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCancel(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 24, paddingBottom: 8 }}>
                <Display size="md">Cancelling Appointment?</Display>
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
                          backgroundColor: selected ? '#FFFFFF' : '#F2F2F3',
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
                  placeholder="Describe why you're cancelling this..."
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
                  <PillButton
                    label="Yes, Cancel"
                    tone="danger"
                    onPress={() => cancelMutation.mutate()}
                    loading={cancelMutation.isPending}
                    disabled={!cancelReason}
                  />
                  <PillButton
                    label="Keep Appointment"
                    tone="light"
                    onPress={() => setShowCancel(false)}
                  />
                </View>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Rate experience bottom sheet */}
      <Modal visible={showRate} transparent animationType="slide" onRequestClose={() => setShowRate(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowRate(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
              {/* Image-like header band */}
              <View style={{ backgroundColor: '#E8E8F0', height: 160, alignItems: 'center', justifyContent: 'center' }}>
                <TouchableOpacity
                  onPress={() => setShowRate(false)}
                  style={{ position: 'absolute', top: 12, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={18} color={t.textPrimary} />
                </TouchableOpacity>
                <IconCircle size={80} bg="rgba(255,255,255,0.6)">
                  <Ionicons name="medical" size={40} color={t.accentPrimary} />
                </IconCircle>
              </View>

              <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 20, paddingBottom: 8 }}>
                <Display size="md">Rate your experience</Display>
                <Text style={{ fontSize: t.fontSm, color: t.textMuted, marginTop: 4, marginBottom: 20 }}>
                  Your feedback is very valuable to us.
                </Text>

                {/* Rating circles */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active = n <= rating;
                    return (
                      <TouchableOpacity
                        key={n}
                        onPress={() => setRating(n)}
                        activeOpacity={0.85}
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 26,
                          backgroundColor: active ? t.accentPrimary : '#F2F2F3',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: active ? '#FFFFFF' : t.textPrimary }}>{n}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="sad-outline" size={14} color={t.textMuted} />
                    <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>Not good</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>Amazing</Text>
                    <Ionicons name="happy-outline" size={14} color={t.textMuted} />
                  </View>
                </View>

                <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 8 }}>
                  Write a review <Text style={{ color: t.textMuted, fontWeight: '400' }}>(optional)</Text>
                </Text>
                <TextInput
                  value={ratingComment}
                  onChangeText={setRatingComment}
                  placeholder="What did you like the most?"
                  placeholderTextColor={t.textMuted}
                  multiline
                  textAlignVertical="top"
                  maxLength={1000}
                  style={{
                    minHeight: 90,
                    borderRadius: rd.radiusInput,
                    borderWidth: 1,
                    borderColor: rd.cardBorder,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: t.fontBase,
                    color: t.textPrimary,
                    marginBottom: 20,
                  }}
                />

                <PillButton
                  label="Submit Feedback"
                  tone="dark"
                  onPress={() => rateMutation.mutate()}
                  loading={rateMutation.isPending}
                  disabled={rating === 0}
                />
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
