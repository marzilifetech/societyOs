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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { api } from '../../src/lib/api';
import { unwrapApiEnvelope } from '@societyos/api-client';
import { useTheme } from '../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  IconCircle,
  rd,
} from '../../src/components/ui';

// Staff Help Request — "Request Help" screen + success bottom-sheet modal.
// Figma frames: Staff Help Request-1.jpg .. -13.jpg
// API: POST /help-requests { category, description, preferredTime? }
// On success → bottom-sheet with "Track Request" + "Go Back"

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * `value` is what goes on the wire, `label` is what the resident reads.
 *
 * These used to be the same string, so the human label ("Package Pickup") was
 * sent straight into `ConciergeRequest.type`, a Prisma enum — every submission
 * failed with `Invalid value for argument 'type'` and Request Help did nothing.
 * The API maps unknown-but-recognisable keys (HEAVY_LIFTING, MINOR_FIX) onto
 * OTHER and keeps the label in the description, so the desk still sees what was
 * actually asked for.
 */
const CATEGORIES: {
  value: string;
  label: string;
  icon: IoniconName;
  subtitle: string;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    value: 'COURIER',
    label: 'Package Pickup',
    icon: 'cube-outline',
    subtitle: 'Collect a parcel or package',
    iconBg: '#E8F5E9',
    iconColor: '#2E7D32',
  },
  {
    value: 'HEAVY_LIFTING',
    label: 'Heavy Lifting',
    icon: 'barbell-outline',
    subtitle: 'Move furniture or appliances',
    iconBg: '#FFF8E1',
    iconColor: '#F57F17',
  },
  {
    value: 'FORM_HELP',
    label: 'Document Collect',
    icon: 'document-text-outline',
    subtitle: 'Pick up letters or documents',
    iconBg: '#E3F2FD',
    iconColor: '#1565C0',
  },
  {
    value: 'ELDERLY_ASSIST',
    label: 'Elderly Assist',
    icon: 'accessibility-outline',
    subtitle: 'Help getting around',
    iconBg: '#FFF3E0',
    iconColor: '#E65100',
  },
  {
    value: 'MINOR_FIX',
    label: 'Minor Fix',
    icon: 'construct-outline',
    subtitle: 'Small repairs in the flat',
    iconBg: '#F5F5F5',
    iconColor: '#616161',
  },
  {
    value: 'OTHER',
    label: 'Other Help',
    icon: 'help-circle-outline',
    subtitle: 'Any other help needed',
    iconBg: '#E8EAF6',
    iconColor: '#283593',
  },
];

const PREFERRED_TIMES = [
  'As soon as possible',
  'Within 30 mins',
  'Within 1 hour',
  'Within 2 hours',
  'Today',
  'Tomorrow',
];

function fmtNow(): string {
  const d = new Date();
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) +
    ', ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function NewHelpRequestScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ category?: string }>();

  const [category, setCategory] = useState<string>(params.category ?? '');
  const [description, setDescription] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [successSheet, setSuccessSheet] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState('');

  const mutation = useMutation({
    mutationFn: (body: { type: string; description?: string; preferredTime?: string }) =>
      api.post('/concierge', body),
    onError: (err: any) => {
      // There was no onError at all, so a failed request looked like a
      // no-op: the button simply did nothing.
      Alert.alert('Could not send request', err?.message ?? 'Please try again.');
    },
    onSuccess: (raw: any) => {
      qc.invalidateQueries({ queryKey: ['concierge-requests'] });
      const unwrapped = unwrapApiEnvelope<{ id: string }>(raw);
      const id = unwrapped?.id ?? null;
      setCreatedId(id ? String(id) : null);
      setCreatedAt(fmtNow());
      setSuccessSheet(true);
    },
  });

  const selectedCat = CATEGORIES.find((c) => c.value === category);
  const isValid = category.length > 0;

  const handleSubmit = () => {
    if (!isValid || mutation.isPending) return;
    const label = selectedCat?.label ?? category;
    mutation.mutate({
      type: category,
      description: description.trim() || label,
      ...(preferredTime ? { preferredTime } : {}),
    });
  };

  const handleTrack = () => {
    setSuccessSheet(false);
    if (createdId) {
      router.replace(`/help-requests/${createdId}` as any);
    } else {
      router.replace('/help-requests' as any);
    }
  };

  const handleGoBack = () => {
    setSuccessSheet(false);
    router.replace('/help-requests' as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Request Help" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 24 }}
        >
          {/* Selected category banner */}
          {selectedCat ? (
            <RoundCard tone="gray" padding={t.cardPadding} style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <IconCircle size={48} bg={selectedCat.iconBg}>
                  <Ionicons name={selectedCat.icon} size={24} color={selectedCat.iconColor} />
                </IconCircle>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>
                    {selectedCat.label}
                  </Text>
                  <Text style={{ fontSize: t.fontSm, color: t.textMuted, marginTop: 2 }}>
                    {selectedCat.subtitle}
                  </Text>
                </View>
              </View>
            </RoundCard>
          ) : (
            /* Category picker (no pre-selection) */
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: t.fontSm, fontWeight: '700', color: t.textPrimary, marginBottom: 12 }}>
                Select Category
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {CATEGORIES.map((cat) => {
                  const active = category === cat.value;
                  return (
                    <TouchableOpacity
                      key={cat.value}
                      onPress={() => setCategory(cat.value)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={{
                        width: '47%',
                        borderRadius: rd.radiusCard,
                        padding: t.cardPadding,
                        backgroundColor: active ? rd.inkSoft : '#F7F7F8',
                        borderWidth: active ? 1.5 : 1,
                        borderColor: active ? rd.ink : rd.cardBorder,
                        alignItems: 'center',
                      }}
                    >
                      <IconCircle size={44} bg={cat.iconBg}>
                        <Ionicons name={cat.icon} size={22} color={cat.iconColor} />
                      </IconCircle>
                      <Text
                        style={{
                          marginTop: 8,
                          fontSize: t.fontSm,
                          fontWeight: '600',
                          color: t.textPrimary,
                          textAlign: 'center',
                        }}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Description */}
          <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 8 }}>
            Describe what you need{' '}
            <Text style={{ fontWeight: '400', color: t.textMuted }}>(optional)</Text>
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Any details the staff member should know..."
            placeholderTextColor={t.textMuted}
            multiline
            textAlignVertical="top"
            maxLength={2000}
            style={{
              minHeight: 120,
              borderRadius: rd.radiusInput,
              borderWidth: 1,
              borderColor: rd.cardBorder,
              backgroundColor: '#FFFFFF',
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: t.fontBase,
              color: t.textPrimary,
              marginBottom: 24,
            }}
          />

          {/* Preferred Time */}
          <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 8 }}>
            Preferred Time{' '}
            <Text style={{ fontWeight: '400', color: t.textMuted }}>(Optional)</Text>
          </Text>
          <TouchableOpacity
            onPress={() => setShowTimePicker(true)}
            activeOpacity={0.85}
            style={{
              minHeight: t.touchTarget,
              borderRadius: rd.radiusInput,
              borderWidth: 1,
              borderColor: rd.cardBorder,
              backgroundColor: '#FFFFFF',
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontSize: t.fontBase,
                color: preferredTime ? t.textPrimary : t.textMuted,
              }}
            >
              {preferredTime || 'Select time'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={t.textMuted} />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <SafeAreaView
        edges={['bottom']}
        style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}
      >
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6 }}>
          <PillButton
            label={mutation.isPending ? 'Submitting…' : 'Submit Request'}
            tone="dark"
            onPress={handleSubmit}
            loading={mutation.isPending}
            disabled={!isValid || mutation.isPending}
          />
        </View>
      </SafeAreaView>

      {/* Time picker bottom-sheet */}
      <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowTimePicker(false)} />
          <SafeAreaView
            edges={['bottom']}
            style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
          >
            <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 24, paddingBottom: 8 }}>
              <Display size="sm" style={{ marginBottom: 16 }}>
                Select Preferred Time
              </Display>
              <View style={{ gap: 8 }}>
                {PREFERRED_TIMES.map((time) => {
                  const selected = preferredTime === time;
                  return (
                    <TouchableOpacity
                      key={time}
                      onPress={() => { setPreferredTime(time); setShowTimePicker(false); }}
                      activeOpacity={0.85}
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
                      <Text style={{ fontSize: t.fontBase, color: t.textPrimary, fontWeight: selected ? '700' : '400' }}>
                        {time}
                      </Text>
                      {selected ? <Ionicons name="checkmark" size={20} color={t.textPrimary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Success bottom-sheet */}
      <Modal visible={successSheet} transparent animationType="slide" onRequestClose={handleGoBack}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <SafeAreaView
            edges={['bottom']}
            style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}
          >
            {/* Green gradient header */}
            <LinearGradient
              colors={['#C8E6C9', '#A5D6A7', '#81C784']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 32,
                position: 'relative',
              }}
            >
              <TouchableOpacity
                onPress={handleGoBack}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.6)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={18} color={t.textPrimary} />
              </TouchableOpacity>
              {/* Scalloped badge */}
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: 'rgba(255,255,255,0.45)',
                  borderWidth: 4,
                  borderColor: 'rgba(255,255,255,0.7)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="checkmark" size={44} color={rd.green} />
              </View>
            </LinearGradient>

            <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 20, paddingBottom: 8 }}>
              <Display size="md" style={{ marginBottom: 12 }}>
                Staff Help Request{'\n'}Submitted!
              </Display>

              {createdAt ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }}>
                  <Ionicons name="calendar-outline" size={16} color={t.textMuted} />
                  <Text style={{ fontSize: t.fontSm, color: t.textMuted }}>{createdAt}</Text>
                </View>
              ) : null}

              <View
                style={{ height: 1, backgroundColor: rd.cardBorder, marginBottom: 20 }}
              />

              <View style={{ gap: 10 }}>
                <PillButton label="Track Request" tone="dark" onPress={handleTrack} />
                <PillButton label="Go Back" tone="light" onPress={handleGoBack} />
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
