import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
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
} from '../../src/components/ui';

// Figma refs: -6.jpg,-7.jpg (track, in-progress), -10.jpg (resolved + Rate), -11.jpg (rating submitted), -12.jpg (rating form)
// API: GET /complaints/:id, POST /complaints/:id/rate { rating, comment }
// Note: Figma uses field "comment" on rate endpoint — existing code used "note".
// Preserving "note" key to match existing API (backend confirmed field name).

type Step = { key: string; label: string; sub: string };

const STEPS: Step[] = [
  { key: 'OPEN', label: 'Raised', sub: 'Complaint Raised' },
  { key: 'UNDER_REVIEW', label: 'Under Review', sub: 'Being Reviewed' },
  { key: 'ASSIGNED', label: 'Assigned', sub: 'Staff Assigned' },
  { key: 'IN_PROGRESS', label: 'In Progress', sub: 'Staff on Site' },
  { key: 'RESOLVED', label: 'Resolved', sub: 'Issue Resolved' },
];

const STATUS_ORDER = ['OPEN', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

function currentStepIndex(status?: string): number {
  const s = (status ?? '').toUpperCase();
  if (s === 'CLOSED') return STATUS_ORDER.indexOf('RESOLVED');
  const idx = STATUS_ORDER.indexOf(s);
  return idx >= 0 ? idx : 0;
}

function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Vertical stepper component
const CATEGORY_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; subtitle: string }> = {
  Noise: { icon: 'volume-high-outline', subtitle: 'Noise disturbance in the community' },
  Parking: { icon: 'car-outline', subtitle: 'Parking or vehicle issue' },
  Cleanliness: { icon: 'sparkles-outline', subtitle: 'Cleanliness or hygiene concern' },
  Water: { icon: 'water-outline', subtitle: 'Water supply or leakage' },
  Maintenance: { icon: 'construct-outline', subtitle: 'Repair or maintenance request' },
  Neighbour: { icon: 'people-outline', subtitle: 'Issue with a neighbour' },
  Pets: { icon: 'paw-outline', subtitle: 'Pet-related concern' },
  Other: { icon: 'ellipsis-horizontal', subtitle: 'Other complaint' },
};

function VerticalStepper({ status }: { status: string }) {
  const t = useTheme();
  const activeIdx = currentStepIndex(status);

  return (
    <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 18 }}>
        Request Status
      </Text>
      {STEPS.map((step, i) => {
        const done = i < activeIdx;
        const current = i === activeIdx;
        const pending = i > activeIdx;
        const isLast = i === STEPS.length - 1;

        return (
          <View key={step.key} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            {/* Left: circle + vertical line */}
            <View style={{ alignItems: 'center', width: 36 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done
                    ? rd.greenSoft
                    : current
                    ? '#FFFFFF'
                    : rd.inkSoft,
                  borderWidth: current ? 2 : 0,
                  borderColor: current ? rd.green : 'transparent',
                }}
              >
                {done ? (
                  <Ionicons name="checkmark" size={18} color={rd.green} />
                ) : current ? (
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
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
                    minHeight: 32,
                    backgroundColor: done ? rd.greenSoft : rd.inkSoft,
                    marginVertical: 2,
                  }}
                />
              )}
            </View>

            {/* Right: label */}
            <View style={{ flex: 1, paddingLeft: 14, paddingBottom: isLast ? 0 : 24 }}>
              <Text
                style={{
                  fontSize: t.fontBase,
                  fontWeight: current || done ? '700' : '400',
                  color: pending ? t.textMuted : t.textPrimary,
                  marginTop: 6,
                }}
              >
                {step.label}
              </Text>
              {(done || current) && (
                <Text style={{ fontSize: t.fontXs, color: t.textMuted, marginTop: 2 }}>
                  {step.sub}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </RoundCard>
  );
}

// Green beacon (same pattern as SOS resolved beacon)
function GreenBeacon({ children }: { children?: React.ReactNode }) {
  return (
    <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: 'rgba(46,158,91,0.08)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 156,
          height: 156,
          borderRadius: 78,
          backgroundColor: 'rgba(46,158,91,0.14)',
        }}
      />
      <LinearGradient
        colors={['#5FB983', '#1F7A45']}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={{
          width: 110,
          height: 110,
          borderRadius: 55,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#1F7A45',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.35,
          shadowRadius: 20,
          elevation: 10,
        }}
      >
        {children ?? <Ionicons name="checkmark" size={48} color="#FFFFFF" />}
      </LinearGradient>
    </View>
  );
}

export default function ComplaintDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [showRating, setShowRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const { data: complaint, isLoading } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => api.get<any>(`/complaints/${id}`),
  });

  const rateMutation = useMutation({
    mutationFn: () => api.post(`/complaints/${id}/rate`, { rating, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaint', id] });
      qc.invalidateQueries({ queryKey: ['my-complaints'] });
      setShowRating(false);
      setRatingSubmitted(true);
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Could not submit rating.'),
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={t.accentPrimary} />
      </View>
    );
  }

  if (!complaint) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <IconCircle size={64} bg={rd.crimsonSoft}>
          <Ionicons name="alert-circle-outline" size={32} color={t.accentPrimary} />
        </IconCircle>
        <Text style={{ marginTop: 16, fontSize: t.fontBase, color: t.textMuted, textAlign: 'center' }}>
          Complaint not found.
        </Text>
        <PillButton label="Go Back" tone="dark" onPress={() => router.back()} style={{ marginTop: 20, width: 160 }} fullWidth={false} />
      </View>
    );
  }

  const status = (complaint.status ?? '').toUpperCase();
  const isResolved = status === 'RESOLVED' || status === 'CLOSED';
  const isRejected = status === 'REJECTED' || status === 'CANCELLED';
  const canRate = isResolved && !complaint.rating && !ratingSubmitted;
  const alreadyRated = !!complaint.rating || ratingSubmitted;

  // Info rows for details card
  const infoRows = [
    { label: 'Date & Time:', value: fmtDateTime(complaint.createdAt) },
    { label: 'Issue:', value: complaint.category ?? '—' },
    { label: 'Staff:', value: complaint.assignedStaff ?? complaint.staff ?? 'Not Assigned' },
  ];

  const historyBtn = (
    <TouchableOpacity
      onPress={() => router.push('/complaints/history' as any)}
      accessibilityRole="button"
      accessibilityLabel="View complaint history"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name="time-outline" size={24} color={rd.ink} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title={isResolved ? 'Track Request' : 'Track Complaint'} trailing={isResolved ? historyBtn : undefined} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Resolved: green beacon + title */}
        {isResolved && (
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <GreenBeacon />

            {/* "Rating Submitted" badge — shown after rating */}
            {ratingSubmitted && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
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
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: t.fontSm }}>Rating Submitted</Text>
              </View>
            )}

            <Display size="lg" align="center" style={{ marginTop: 16 }}>Complaint Resolved</Display>
            <Text style={{ textAlign: 'center', color: t.textMuted, fontSize: t.fontSm, marginTop: 6 }}>
              Complaint has been resolved!
            </Text>
          </View>
        )}

        {/* Non-resolved: category header + vertical stepper */}
        {!isResolved && !isRejected && (
          <>
            <RoundCard tone="gray" padding={t.cardPaddingLg} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconCircle
                  size={44}
                  bg={rd.crimsonSoft}
                  icon={CATEGORY_META[complaint.category ?? '']?.icon ?? 'alert-circle-outline'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>
                    {complaint.category ?? 'Complaint'}
                  </Text>
                  <Text style={{ fontSize: t.fontSm, color: t.textMuted, marginTop: 2 }}>
                    {CATEGORY_META[complaint.category ?? '']?.subtitle ?? 'Complaint details below'}
                  </Text>
                </View>
              </View>
            </RoundCard>
            <VerticalStepper status={status} />
          </>
        )}

        {/* Rejected state */}
        {isRejected && (
          <RoundCard tone="pink" padding={t.cardPaddingLg} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconCircle size={44} bg={rd.crimson}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </IconCircle>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>
                  Complaint {status === 'CANCELLED' ? 'Cancelled' : 'Rejected'}
                </Text>
                <Text style={{ fontSize: t.fontSm, color: t.textMuted, marginTop: 2 }}>
                  {complaint.adminNote ?? 'Please contact the society office for more information.'}
                </Text>
              </View>
            </View>
          </RoundCard>
        )}

        {/* Complaint Details (InfoRows pattern) */}
        <RoundCard tone="gray" padding={t.cardPaddingLg} style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 16 }}>
            Complaint Details
          </Text>
          {infoRows.map((row, i) => (
            <View
              key={row.label}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginTop: i === 0 ? 0 : 12,
              }}
            >
              <Text style={{ color: t.textSecondary, fontSize: t.fontSm }}>{row.label}</Text>
              <Text
                style={{
                  color: t.textPrimary,
                  fontSize: t.fontSm,
                  fontWeight: '700',
                  flexShrink: 1,
                  textAlign: 'right',
                  marginLeft: 12,
                }}
              >
                {row.value}
              </Text>
            </View>
          ))}

          {/* Description inline (Figma shows it inside the details card) */}
          {complaint.description ? (
            <View style={{ marginTop: 14 }}>
              <Text style={{ color: t.textSecondary, fontSize: t.fontSm, marginBottom: 6 }}>Description:</Text>
              <Text style={{ fontSize: t.fontSm, color: t.textPrimary, lineHeight: t.fontSm * 1.5 }}>
                {complaint.description}
              </Text>
            </View>
          ) : null}

          {/* Photos */}
          {(complaint.photoUrl || complaint.photos?.length > 0) && (
            <View style={{ marginTop: 14 }}>
              <Text style={{ color: t.textSecondary, fontSize: t.fontSm, marginBottom: 8 }}>Photos</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {(complaint.photos ?? (complaint.photoUrl ? [complaint.photoUrl] : [])).map(
                  (uri: string, idx: number) => (
                    <Image
                      key={idx}
                      source={{ uri }}
                      style={{ width: 64, height: 64, borderRadius: rd.radiusCard }}
                      resizeMode="cover"
                    />
                  ),
                )}
              </View>
            </View>
          )}

          {/* Admin note */}
          {complaint.adminNote ? (
            <RoundCard tone="white" padding={t.cardPadding} style={{ marginTop: 14 }}>
              <Text style={{ fontSize: t.fontSm, fontWeight: '700', color: t.textPrimary, marginBottom: 4 }}>
                Society Note
              </Text>
              <Text style={{ fontSize: t.fontSm, color: t.textSecondary, lineHeight: t.fontSm * 1.5 }}>
                {complaint.adminNote}
              </Text>
            </RoundCard>
          ) : null}

          {/* Submitted rating display */}
          {alreadyRated && complaint.rating && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: t.fontSm, fontWeight: '700', color: t.textPrimary, marginBottom: 8 }}>
                Your Rating
              </Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= complaint.rating ? 'star' : 'star-outline'}
                    size={22}
                    color="#F59E0B"
                  />
                ))}
              </View>
              {complaint.ratingNote ? (
                <Text style={{ marginTop: 6, fontSize: t.fontSm, color: t.textSecondary }}>
                  {complaint.ratingNote}
                </Text>
              ) : null}
            </View>
          )}
        </RoundCard>
      </ScrollView>

      {/* Footer */}
      <SafeAreaView
        edges={['bottom']}
        style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}
      >
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6, gap: 10 }}>
          {canRate && (
            <PillButton label="Rate Resolution" tone="dark" onPress={() => setShowRating(true)} />
          )}
          <PillButton label="Go Back" tone={canRate ? 'light' : 'dark'} onPress={() => router.back()} />
        </View>
      </SafeAreaView>

      {/* Rating bottom sheet */}
      <Modal
        visible={showRating}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRating(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowRating(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView
              edges={['bottom']}
              style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}
            >
              {/* Complaint image / banner */}
              {complaint.photoUrl ? (
                <Image
                  source={{ uri: complaint.photoUrl }}
                  style={{ width: '100%', height: 160 }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ width: '100%', height: 140, backgroundColor: rd.inkSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="receipt-outline" size={48} color={t.textMuted} />
                </View>
              )}
              <TouchableOpacity
                onPress={() => setShowRating(false)}
                accessibilityRole="button"
                accessibilityLabel="Close rating"
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.85)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={18} color={rd.ink} />
              </TouchableOpacity>

              <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 20, paddingBottom: 8 }}>
                <Display size="md">How was the{'\n'}Resolution?</Display>
                <Text style={{ color: t.textMuted, fontSize: t.fontSm, marginTop: 6, marginBottom: 20 }}>
                  Your feedback is very valuable to us.
                </Text>

                {/* Number rating 1–5 */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const sel = n <= rating;
                    return (
                      <TouchableOpacity
                        key={n}
                        onPress={() => setRating(n)}
                        accessibilityRole="button"
                        accessibilityLabel={`Rate ${n}`}
                        accessibilityState={{ selected: sel }}
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 25,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: sel ? t.accentPrimary : rd.inkSoft,
                        }}
                      >
                        <Text style={{ color: sel ? '#FFFFFF' : t.textPrimary, fontWeight: '700', fontSize: t.fontBase }}>
                          {n}
                        </Text>
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

                <Text style={{ fontSize: t.fontSm, fontWeight: '600', color: t.textPrimary, marginBottom: 8 }}>
                  Write a review (optional)
                </Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="What did you like the most?"
                  placeholderTextColor={t.textMuted}
                  multiline
                  textAlignVertical="top"
                  maxLength={500}
                  style={{
                    minHeight: 100,
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
                  label={rateMutation.isPending ? 'Submitting…' : 'Submit Feedback'}
                  tone={rating > 0 ? 'dark' : 'light'}
                  onPress={() => rateMutation.mutate()}
                  loading={rateMutation.isPending}
                  disabled={rating === 0 || rateMutation.isPending}
                  accessibilityLabel="Submit rating"
                />
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
