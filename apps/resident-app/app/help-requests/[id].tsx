import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  InfoRows,
  IconCircle,
  rd,
  type RdStatusTone,
} from '../../src/components/ui';

// Track Request screen — Figma "Staff Help Request-14.jpg" (Track Complaint frame)
// Vertical stepper: Requested → Assigned → On the way / On Hold → Completed
// Request Details (InfoRows) + "Go Back" + "Cancel Request" (ghost red)
// Cancel → bottom-sheet → "Request Cancelled" success state
// POST /help-requests/:id/rate { rating, comment } — rate & review flow
// PATCH /help-requests/:id/cancel { reason? }

type HelpRequest = {
  id: string;
  category: string;
  description: string;
  urgency?: string;
  status: string;
  createdAt: string;
  preferredTime?: string;
  staffName?: string;
  rating?: number;
};

type IoniconName = keyof typeof Ionicons.glyphMap;

const CATEGORY_ICONS: Record<string, IoniconName> = {
  'Package Pickup': 'cube-outline',
  'Heavy Lifting': 'barbell-outline',
  'Document Collect': 'document-text-outline',
  'Elderly Assist': 'accessibility-outline',
  'Minor Fix': 'construct-outline',
  'Other Help': 'help-circle-outline',
};

// Stepper step definitions matching Figma labels
type StepState = 'done' | 'active' | 'upcoming';
type Step = { key: string; label: string; subLabel?: string; time?: string };

const STEPPER_STEPS: Step[] = [
  { key: 'requested', label: 'Requested', subLabel: 'Help Requested' },
  { key: 'assigned', label: 'Assigned', subLabel: 'Being Assigned' },
  { key: 'on_the_way', label: 'On the way', subLabel: 'Staff Dispatched' },
  { key: 'completed', label: 'Completed', subLabel: 'Request Fulfilled' },
];

function getStepIndex(status: string): number {
  const s = status?.toUpperCase() ?? '';
  if (s === 'COMPLETED' || s === 'RESOLVED') return 3;
  if (s === 'IN_PROGRESS' || s === 'ACKNOWLEDGED' || s === 'ON_THE_WAY') return 2;
  if (s === 'ASSIGNED') return 1;
  return 0; // OPEN / default
}

function mapStatus(raw: string): { tone: RdStatusTone; label: string } {
  const s = raw?.toUpperCase() ?? '';
  if (s === 'RESOLVED' || s === 'COMPLETED') return { tone: 'resolved', label: 'Completed' };
  if (s === 'CANCELLED' || s === 'CANCELED') return { tone: 'cancelled', label: 'Cancelled' };
  if (s === 'ASSIGNED' || s === 'IN_PROGRESS' || s === 'ACKNOWLEDGED') return { tone: 'active', label: 'In Progress' };
  if (s === 'OPEN') return { tone: 'pending', label: 'Requested' };
  return { tone: 'neutral', label: raw ?? 'Unknown' };
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    ', ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const CANCEL_REASONS = [
  'No longer needed',
  'Issue resolved itself',
  'Incorrect category',
  'Duplicate request',
  'Other reason',
];

export default function TrackRequestScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelComments, setCancelComments] = useState('');
  const [phase, setPhase] = useState<'tracking' | 'cancelled' | 'rating' | 'rated'>('tracking');
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  const { data: request, isLoading } = useQuery<HelpRequest>({
    queryKey: ['help-request', id],
    queryFn: () => api.get<HelpRequest>(`/concierge-requests/${id}`),
    enabled: !!id,
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: (body: { reason?: string }) => api.patch(`/concierge/${id}/cancel`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concierge-requests'] });
      qc.invalidateQueries({ queryKey: ['help-request', id] });
      setShowCancel(false);
      setPhase('cancelled');
    },
    onError: (err: any) => {
      setShowCancel(false);
      Alert.alert('Error', err?.message ?? 'Failed to cancel request. Please try again.');
    },
  });

  const rateMutation = useMutation({
    mutationFn: (body: { rating: number; comment?: string }) =>
      api.post(`/concierge-requests/${id}/rate`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concierge-requests'] });
      setPhase('rated');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message ?? 'Failed to submit rating. Please try again.');
    },
  });

  const handleConfirmCancel = () => {
    const reason = [cancelReason, cancelComments.trim()].filter(Boolean).join(' — ');
    cancelMutation.mutate({ ...(reason ? { reason } : {}) });
  };

  const handleRate = () => {
    if (rating === 0) return;
    rateMutation.mutate({ rating, ...(ratingComment.trim() ? { comment: ratingComment.trim() } : {}) });
  };

  const backHome = () => router.replace('/help-requests' as any);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader title="Track Request" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.textMuted, fontSize: t.fontBase }}>Loading…</Text>
        </View>
      </View>
    );
  }

  // Cancelled success state
  if (phase === 'cancelled') {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader title="Track Request" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.screenPadding }}>
          <IconCircle size={80} bg={rd.crimsonSoft}>
            <Ionicons name="close-circle-outline" size={44} color={rd.crimson} />
          </IconCircle>
          <Display size="md" align="center" style={{ marginTop: 20, marginBottom: 10 }}>
            Request Cancelled
          </Display>
          <Text
            style={{ textAlign: 'center', color: t.textMuted, fontSize: t.fontBase, lineHeight: t.fontBase * 1.6 }}
          >
            Your help request has been cancelled. Staff have been notified.
          </Text>
        </View>
        <SafeAreaView
          edges={['bottom']}
          style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}
        >
          <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6 }}>
            <PillButton label="Back to Home" tone="dark" onPress={backHome} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Rating submitted success state
  if (phase === 'rated') {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader title="Rate & Review" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.screenPadding }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: rd.greenSoft,
              borderWidth: 4,
              borderColor: 'rgba(46,158,91,0.3)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <Ionicons name="checkmark" size={48} color={rd.green} />
          </View>
          <Display size="md" align="center" style={{ marginBottom: 10 }}>
            Rating Submitted
          </Display>
          <Text
            style={{ textAlign: 'center', color: t.textMuted, fontSize: t.fontBase, lineHeight: t.fontBase * 1.6 }}
          >
            Thank you for your feedback! It helps us improve our service.
          </Text>
        </View>
        <SafeAreaView
          edges={['bottom']}
          style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}
        >
          <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6 }}>
            <PillButton label="Back to Home" tone="dark" onPress={backHome} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Rate & review screen (triggered when completed)
  if (phase === 'rating') {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader title="Rate & Review" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
        >
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 24, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: rd.greenSoft,
                  borderWidth: 4,
                  borderColor: 'rgba(46,158,91,0.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons name="checkmark" size={44} color={rd.green} />
              </View>
              <Display size="md" align="center" style={{ marginBottom: 6 }}>
                Service Completed
              </Display>
              <Text style={{ textAlign: 'center', color: t.textMuted, fontSize: t.fontSm }}>
                How was your experience?
              </Text>
            </View>

            <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 14 }}>
              Rate your experience
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={36}
                    color={star <= rating ? '#F59E0B' : t.textMuted}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 8 }}>
              Comments{' '}
              <Text style={{ fontWeight: '400', color: t.textMuted }}>(Optional)</Text>
            </Text>
            <TextInput
              value={ratingComment}
              onChangeText={setRatingComment}
              placeholder="Share your experience..."
              placeholderTextColor={t.textMuted}
              multiline
              textAlignVertical="top"
              maxLength={500}
              style={{
                minHeight: 100,
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
          </ScrollView>
        </KeyboardAvoidingView>
        <SafeAreaView
          edges={['bottom']}
          style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}
        >
          <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6, gap: 10 }}>
            <PillButton
              label="Submit Rating"
              tone="dark"
              onPress={handleRate}
              loading={rateMutation.isPending}
              disabled={rating === 0 || rateMutation.isPending}
            />
            <PillButton label="Skip" tone="light" onPress={() => setPhase('rated')} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Main tracking view
  const status = request ? mapStatus(request.status) : { tone: 'pending' as RdStatusTone, label: 'Requested' };
  const stepIndex = request ? getStepIndex(request.status) : 0;
  const isCompleted =
    request?.status?.toUpperCase() === 'COMPLETED' || request?.status?.toUpperCase() === 'RESOLVED';
  const isCancelledServer =
    request?.status?.toUpperCase() === 'CANCELLED' || request?.status?.toUpperCase() === 'CANCELED';
  const isActive = !isCompleted && !isCancelledServer;

  const detailRows = [
    { label: 'Requested on:', value: fmtDate(request?.createdAt ?? '') },
    { label: 'Request Type:', value: request?.category ?? (request as any)?.type ?? '—' },
    { label: 'Preferred Time:', value: request?.preferredTime ?? 'Not specified' },
    { label: 'Staff:', value: request?.staffName ?? 'Not Assigned' },
    ...(request?.description ? [{ label: 'Description:', value: request.description }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Track Request" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 24 }}
      >
        {/* Category banner */}
        {request && (
          <RoundCard tone="gray" padding={t.cardPadding} style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <IconCircle size={44} bg={rd.inkSoft}>
                <Ionicons name={CATEGORY_ICONS[request.category] ?? 'help-circle-outline'} size={22} color={t.textSecondary} />
              </IconCircle>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>
                  {request.category ?? (request as any).type ?? 'Help request'}
                </Text>
                <Text style={{ fontSize: t.fontSm, color: t.textMuted, marginTop: 2 }}>
                  {fmtDate(request.createdAt)}
                </Text>
              </View>
            </View>
          </RoundCard>
        )}

        {/* Stepper */}
        <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 16 }}>
            Request Status
          </Text>
          {STEPPER_STEPS.map((step, i) => {
            const stepState: StepState =
              i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'upcoming';
            const isLast = i === STEPPER_STEPS.length - 1;
            return (
              <View key={step.key} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                {/* Left: circle + connector */}
                <View style={{ alignItems: 'center', marginRight: 14, width: 36 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor:
                        stepState === 'done'
                          ? rd.green
                          : stepState === 'active'
                          ? '#FFFFFF'
                          : '#F0F0F0',
                      borderWidth: stepState === 'active' ? 2 : 0,
                      borderColor: rd.green,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {stepState === 'done' ? (
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    ) : stepState === 'active' ? (
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: rd.green,
                        }}
                      />
                    ) : null}
                  </View>
                  {!isLast && (
                    <View
                      style={{
                        width: 2,
                        height: 32,
                        backgroundColor: stepState === 'done' ? rd.green : rd.cardBorder,
                        marginTop: 4,
                      }}
                    />
                  )}
                </View>
                {/* Right: labels */}
                <View style={{ flex: 1, paddingBottom: isLast ? 0 : 32 }}>
                  <Text
                    style={{
                      fontSize: t.fontBase,
                      fontWeight: stepState === 'upcoming' ? '400' : '700',
                      color: stepState === 'upcoming' ? t.textMuted : t.textPrimary,
                      marginTop: 6,
                    }}
                  >
                    {step.label}
                  </Text>
                  {stepState !== 'upcoming' && step.subLabel ? (
                    <Text style={{ fontSize: t.fontSm, color: t.textMuted, marginTop: 2 }}>
                      {step.subLabel}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </RoundCard>

        {/* Request Details */}
        <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 16 }}>
            Request Details
          </Text>
          {detailRows.map((row, i) => (
            <View
              key={row.label}
              style={{
                flexDirection: row.label === 'Description:' ? 'column' : 'row',
                justifyContent: 'space-between',
                marginTop: i === 0 ? 0 : 14,
              }}
            >
              <Text style={{ color: t.textSecondary, fontSize: t.fontBase }}>{row.label}</Text>
              <Text
                style={{
                  color: t.textPrimary,
                  fontSize: t.fontBase,
                  fontWeight: '700',
                  textAlign: row.label === 'Description:' ? 'left' : 'right',
                  marginTop: row.label === 'Description:' ? 6 : 0,
                  flexShrink: 1,
                  marginLeft: row.label === 'Description:' ? 0 : 12,
                }}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </RoundCard>
      </ScrollView>

      {/* Footer */}
      <SafeAreaView
        edges={['bottom']}
        style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}
      >
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6, gap: 10 }}>
          {isCompleted && !request?.rating ? (
            <>
              <PillButton label="Rate Service" tone="dark" onPress={() => setPhase('rating')} />
              <PillButton label="Back to Home" tone="light" onPress={backHome} />
            </>
          ) : (
            <>
              <PillButton label="Back to Home" tone="dark" onPress={backHome} />
              {isActive && (
                <PillButton
                  label="Cancel Request"
                  tone="ghost"
                  textColor={rd.crimson}
                  onPress={() => setShowCancel(true)}
                />
              )}
            </>
          )}
        </View>
      </SafeAreaView>

      {/* Cancel bottom-sheet */}
      <Modal visible={showCancel} transparent animationType="slide" onRequestClose={() => setShowCancel(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCancel(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView
              edges={['bottom']}
              style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
            >
              <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 24, paddingBottom: 8 }}>
                <Display size="md">Cancelling this Request?</Display>
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
                          backgroundColor: selected ? rd.inkSoft : '#F7F7F8',
                          borderWidth: selected ? 1.5 : 0,
                          borderColor: rd.ink,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: t.fontBase,
                            color: t.textPrimary,
                            fontWeight: selected ? '700' : '400',
                          }}
                        >
                          {reason}
                        </Text>
                        {selected ? <Ionicons name="checkmark" size={20} color={t.textPrimary} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text
                  style={{
                    fontSize: t.fontSm,
                    fontWeight: '700',
                    color: t.textPrimary,
                    marginTop: 20,
                    marginBottom: 8,
                  }}
                >
                  Additional Comments{' '}
                  <Text style={{ color: t.textMuted, fontWeight: '400' }}>(optional)</Text>
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
                    onPress={handleConfirmCancel}
                    loading={cancelMutation.isPending}
                  />
                  <PillButton
                    label="Dismiss"
                    tone="light"
                    onPress={() => setShowCancel(false)}
                  />
                </View>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
