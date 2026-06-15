import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import { canRate } from '../../src/lib/serviceStatus';
import { useServiceRequest } from '../../src/hooks/useServiceRequest';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  InfoRows,
  StatusPill,
  rd,
  type RdStatusTone,
} from '../../src/components/ui';

// Figma refs:
//   Utility Service-8.jpg  → Track Request (Pending/Assigned/InProgress)
//   Utility Service-9.jpg  → Track Request (InProgress)
//   Utility Service-10.jpg → Cancel bottom sheet
//   Utility Service-11.jpg → Service Completed (green beacon)
//   Utility Service-12.jpg → After rating submitted
//   Utility Service-13.jpg → Rate & Review modal
//   Utility Service-4.jpg  → Booking Cancelled (red beacon)

type UIPhase =
  | 'tracking'   // PENDING / ASSIGNED / IN_PROGRESS
  | 'completed'  // COMPLETED — green beacon + Rate Service
  | 'cancelled'; // CANCELLED — red beacon

const CANCEL_REASONS = [
  'Booked by mistake',
  'Issue resolved on its own',
  'Found another solution',
  'Scheduling conflict',
];

// Map API status → stepper state
const STEPPER_STEPS: { key: string; label: string; subLabel: string }[] = [
  { key: 'PENDING', label: 'Requested', subLabel: 'Booking Created' },
  { key: 'ASSIGNED', label: 'Assigned', subLabel: 'Provider Assigned' },
  { key: 'IN_PROGRESS', label: 'In Progress', subLabel: 'On the Way' },
  { key: 'COMPLETED', label: 'Completed', subLabel: 'Service Done' },
];

function stepIndex(status: string) {
  const idx = STEPPER_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

function mapUiPhase(status: string): UIPhase {
  if (status === 'COMPLETED' || status === 'CLOSED') return 'completed';
  if (status === 'CANCELLED' || status === 'REJECTED') return 'cancelled';
  return 'tracking';
}

function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ServiceDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  // Cancel sheet state
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelComments, setCancelComments] = useState('');

  // Rating state
  const [showRatingSheet, setShowRatingSheet] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingNote, setRatingNote] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const { data: sr, isLoading } = useQuery({
    queryKey: ['service-request', id],
    queryFn: () => api.get<any>(`/service-requests/${id}`),
  });

  const { rate: rateMutation } = useServiceRequest(id, {
    disputeReason: '',
    rating,
    ratingNote,
    onRated: () => {
      setShowRatingSheet(false);
      setRatingSubmitted(true);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      api.patch(`/service-requests/${id}/cancel`, {
        reason: [cancelReason, cancelComments.trim()].filter(Boolean).join(' — ') || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-request', id] });
      qc.invalidateQueries({ queryKey: ['my-service-requests'] });
      setShowCancel(false);
    },
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader title="Track Request" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={t.accentPrimary} />
        </View>
      </View>
    );
  }

  if (!sr) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader title="Track Request" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ color: t.textMuted, fontSize: t.fontBase }}>Request not found</Text>
        </View>
      </View>
    );
  }

  const uiPhase = mapUiPhase(sr.status);
  const canRateNow = canRate(sr.status, !!sr.rating) && !ratingSubmitted;
  const providerName =
    sr.assignedTo?.user?.name ?? sr.assignedTo?.name ?? 'Not Assigned';
  const bookingRows = [
    {
      label: 'Date & Time:',
      value: sr.scheduledTime
        ? fmtDateTime(sr.scheduledTime)
        : sr.preferredTime ?? fmtDateTime(sr.createdAt),
    },
    { label: 'Service:', value: `${sr.category} Service` },
    { label: 'Provider:', value: providerName },
  ];

  // Beacon component (inline)
  const BeaconCore = ({
    tone,
    children,
  }: {
    tone: 'green' | 'red';
    children: React.ReactNode;
  }) => {
    const base = tone === 'green' ? '46,158,91' : '196,40,71';
    const coreColors: [string, string] =
      tone === 'green' ? ['#5FB983', '#1F7A45'] : ['#D6537A', '#A81B3C'];
    return (
      <View
        style={{
          width: 200,
          height: 200,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: `rgba(${base},0.07)`,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: 156,
            height: 156,
            borderRadius: 78,
            backgroundColor: `rgba(${base},0.13)`,
          }}
        />
        <LinearGradient
          colors={coreColors}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: tone === 'green' ? '#1F7A45' : '#A81B3C',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          {children}
        </LinearGradient>
      </View>
    );
  };

  // ---- COMPLETED PHASE -------------------------------------------------------
  if (uiPhase === 'completed') {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader title="Track Request" />

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: t.screenPadding,
            paddingTop: 20,
            paddingBottom: 120,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Success notification pill */}
          {ratingSubmitted && (
            <View
              style={{
                alignSelf: 'center',
                backgroundColor: rd.ink,
                borderRadius: rd.radiusPill,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 16,
                paddingVertical: 9,
                marginBottom: 16,
              }}
            >
              <Ionicons name="checkmark-circle" size={16} color={rd.green} />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: t.fontSm }}>
                Rating Submitted
              </Text>
            </View>
          )}

          {/* Green beacon */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <BeaconCore tone="green">
              <Ionicons name="checkmark" size={52} color="#FFFFFF" />
            </BeaconCore>
          </View>

          <Display size="lg" align="center" style={{ marginBottom: 6 }}>
            Service Completed
          </Display>
          <Text
            style={{
              textAlign: 'center',
              color: t.textMuted,
              fontSize: t.fontSm,
              marginBottom: 24,
            }}
          >
            Service has been completed!
          </Text>

          <InfoRows title="Booking Details" rows={bookingRows} />
        </ScrollView>

        <SafeAreaView
          edges={['bottom']}
          style={{
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: rd.cardBorder,
          }}
        >
          <View
            style={{
              paddingHorizontal: t.screenPadding,
              paddingTop: 12,
              paddingBottom: 6,
              gap: 10,
            }}
          >
            {canRateNow && (
              <PillButton
                label="Rate Service"
                tone="dark"
                onPress={() => setShowRatingSheet(true)}
              />
            )}
            <PillButton
              label="Go Back"
              tone="light"
              onPress={() => router.replace('/(tabs)/services' as any)}
            />
          </View>
        </SafeAreaView>

        {/* Rating bottom sheet */}
        <Modal
          visible={showRatingSheet}
          transparent
          animationType="slide"
          onRequestClose={() => setShowRatingSheet(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.45)',
              justifyContent: 'flex-end',
            }}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowRatingSheet(false)}
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  overflow: 'hidden',
                }}
              >
                {/* Image banner (if sr has a photo we could show it — Figma shows a service image) */}
                <View
                  style={{
                    height: 120,
                    backgroundColor: rd.greenSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setShowRatingSheet(false)}
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: 'rgba(255,255,255,0.7)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="close" size={18} color={rd.ink} />
                  </TouchableOpacity>
                  <Ionicons name="construct" size={48} color={rd.green} />
                </View>

                <SafeAreaView
                  edges={['bottom']}
                  style={{
                    paddingHorizontal: t.screenPadding,
                    paddingTop: 20,
                    paddingBottom: 8,
                  }}
                >
                  <Display size="md" style={{ marginBottom: 6 }}>
                    How was the service?
                  </Display>
                  <Text
                    style={{
                      color: t.textMuted,
                      fontSize: t.fontSm,
                      marginBottom: 20,
                    }}
                  >
                    Your feedback is very valuable to us.
                  </Text>

                  {/* Number rating */}
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 10,
                      marginBottom: 6,
                    }}
                  >
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = star <= rating;
                      return (
                        <TouchableOpacity
                          key={star}
                          onPress={() => setRating(star)}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={`Rate ${star} out of 5`}
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 25,
                            backgroundColor: active ? t.accentPrimary : rd.inkSoft,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: t.fontBase,
                              fontWeight: '700',
                              color: active ? '#FFFFFF' : t.textMuted,
                            }}
                          >
                            {star}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: 20,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="sad-outline" size={14} color={t.textMuted} />
                      <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>Not good</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>Amazing</Text>
                      <Ionicons name="happy-outline" size={14} color={t.textMuted} />
                    </View>
                  </View>

                  <Text
                    style={{
                      fontSize: t.fontSm,
                      fontWeight: '700',
                      color: t.textPrimary,
                      marginBottom: 8,
                    }}
                  >
                    Write a review{' '}
                    <Text style={{ fontWeight: '400', color: t.textMuted }}>(optional)</Text>
                  </Text>
                  <TextInput
                    value={ratingNote}
                    onChangeText={setRatingNote}
                    placeholder="What did you like the most?"
                    placeholderTextColor={t.textMuted}
                    multiline
                    textAlignVertical="top"
                    maxLength={500}
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
                    label={rateMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
                    tone="dark"
                    onPress={() => rateMutation.mutate()}
                    loading={rateMutation.isPending}
                    disabled={rating === 0 || rateMutation.isPending}
                  />
                </SafeAreaView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </View>
    );
  }

  // ---- CANCELLED PHASE -------------------------------------------------------
  if (uiPhase === 'cancelled') {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader title="Service Request" />

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: t.screenPadding,
            paddingTop: 20,
            paddingBottom: 120,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Notification pill */}
          <View
            style={{
              alignSelf: 'center',
              backgroundColor: rd.ink,
              borderRadius: rd.radiusPill,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 16,
              paddingVertical: 9,
              marginBottom: 16,
            }}
          >
            <Ionicons name="checkmark-circle" size={16} color={rd.green} />
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: t.fontSm }}>
              Booking Cancelled
            </Text>
          </View>

          {/* Red beacon */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <BeaconCore tone="red">
              <Ionicons name="close" size={52} color="#FFFFFF" />
            </BeaconCore>
          </View>

          <Display size="lg" align="center" style={{ marginBottom: 6 }}>
            Booking Cancelled
          </Display>
          <Text
            style={{
              textAlign: 'center',
              color: t.textMuted,
              fontSize: t.fontSm,
              marginBottom: 24,
            }}
          >
            Service Provider has been notified.
          </Text>

          <InfoRows title="Booking Details" rows={bookingRows} />
        </ScrollView>

        <SafeAreaView
          edges={['bottom']}
          style={{
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: rd.cardBorder,
          }}
        >
          <View
            style={{
              paddingHorizontal: t.screenPadding,
              paddingTop: 12,
              paddingBottom: 6,
            }}
          >
            <PillButton
              label="Back to Home"
              tone="dark"
              onPress={() => router.replace('/(tabs)/services' as any)}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ---- TRACKING PHASE --------------------------------------------------------
  const currentStep = stepIndex(sr.status);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Track Request" />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.screenPadding,
          paddingTop: 16,
          paddingBottom: 120,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Vertical stepper */}
        <RoundCard tone="white" padding={t.cardPaddingLg}>
          <Text
            style={{
              fontSize: t.fontBase,
              fontWeight: '700',
              color: t.textPrimary,
              marginBottom: 16,
            }}
          >
            Request Status
          </Text>
          {STEPPER_STEPS.map((step, idx) => {
            const done = idx < currentStep;
            const current = idx === currentStep;
            const pending = idx > currentStep;
            const isLast = idx === STEPPER_STEPS.length - 1;

            const circleColor = done
              ? rd.green
              : current
              ? '#FFFFFF'
              : '#FFFFFF';
            const circleBorder = done
              ? rd.green
              : current
              ? rd.ink
              : rd.cardBorder;
            const circleBg = done ? rd.green : current ? '#FFFFFF' : '#FFFFFF';
            const lineColor = idx < currentStep ? rd.green : rd.cardBorder;

            return (
              <View key={step.key} style={{ flexDirection: 'row' }}>
                {/* Dot + line column */}
                <View style={{ alignItems: 'center', width: 28, marginRight: 14 }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: circleBg,
                      borderWidth: done ? 0 : current ? 2 : 1,
                      borderColor: circleBorder,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    ) : current ? (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: rd.ink,
                        }}
                      />
                    ) : null}
                  </View>
                  {!isLast && (
                    <View
                      style={{
                        width: 2,
                        flex: 1,
                        minHeight: 28,
                        backgroundColor: lineColor,
                        marginTop: 4,
                      }}
                    />
                  )}
                </View>

                {/* Text column */}
                <View style={{ flex: 1, paddingBottom: isLast ? 0 : 20 }}>
                  <Text
                    style={{
                      fontSize: t.fontBase,
                      fontWeight: done || current ? '700' : '400',
                      color: pending ? t.textMuted : t.textPrimary,
                    }}
                  >
                    {step.label}
                  </Text>
                  {(done || current) && (
                    <Text style={{ fontSize: t.fontXs, color: t.textMuted, marginTop: 2 }}>
                      {current
                        ? fmtDateTime(
                            sr.status === 'PENDING'
                              ? sr.createdAt
                              : sr.status === 'ASSIGNED'
                              ? sr.assignedAt ?? sr.createdAt
                              : sr.startedAt ?? sr.createdAt,
                          )
                        : ''}
                      {done && idx === 0 ? fmtDateTime(sr.createdAt) : ''}
                      {done && idx === 1 ? fmtDateTime(sr.assignedAt ?? sr.createdAt) : ''}
                      {done && idx === 2 ? fmtDateTime(sr.startedAt ?? sr.createdAt) : ''}
                      {done || current ? ` · ${step.subLabel}` : ''}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </RoundCard>

        {/* Booking Details */}
        <InfoRows title="Booking Details" rows={bookingRows} />
      </ScrollView>

      {/* Footer */}
      <SafeAreaView
        edges={['bottom']}
        style={{
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: rd.cardBorder,
        }}
      >
        <View
          style={{
            paddingHorizontal: t.screenPadding,
            paddingTop: 12,
            paddingBottom: 6,
            gap: 10,
          }}
        >
          <PillButton
            label="Back to Home"
            tone="dark"
            onPress={() => router.replace('/(tabs)/services' as any)}
          />
          <PillButton
            label="Cancel Request"
            tone="ghost"
            textColor={rd.crimson}
            onPress={() => setShowCancel(true)}
          />
        </View>
      </SafeAreaView>

      {/* Cancel bottom sheet */}
      <Modal
        visible={showCancel}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCancel(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowCancel(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <SafeAreaView
              edges={['bottom']}
              style={{
                backgroundColor: '#FFFFFF',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
            >
              <View
                style={{
                  paddingHorizontal: t.screenPadding,
                  paddingTop: 24,
                  paddingBottom: 8,
                }}
              >
                <Display size="md">Cancelling this Booking?</Display>
                <Text
                  style={{
                    color: t.textMuted,
                    fontSize: t.fontSm,
                    marginTop: 6,
                    marginBottom: 18,
                  }}
                >
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
                        <Text
                          style={{
                            fontSize: t.fontBase,
                            color: t.textPrimary,
                            fontWeight: selected ? '700' : '400',
                          }}
                        >
                          {reason}
                        </Text>
                        {selected && (
                          <Ionicons name="checkmark" size={20} color={t.textPrimary} />
                        )}
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
                    label={cancelMutation.isPending ? 'Cancelling...' : 'Yes, Cancel'}
                    tone="danger"
                    onPress={() => cancelMutation.mutate()}
                    loading={cancelMutation.isPending}
                  />
                  <PillButton
                    label="Keep Request"
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
