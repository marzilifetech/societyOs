import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Alert,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import { pickImageFromLibrary, uploadToPresignedUrl } from '../../src/lib/photo-upload';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  InfoRows,
  rd,
} from '../../src/components/ui';

// Figma reference: Utility Service-6.jpg (book), Utility Service-7.jpg (success modal)

type Phase = 'booking' | 'success';

// Generate next N days starting from today
function buildDays(n: number): { dayLabel: string; dateLabel: string; date: Date }[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const result = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    result.push({
      dayLabel: days[d.getDay()],
      dateLabel: String(d.getDate()),
      date: d,
    });
  }
  return result;
}

const TIME_SLOTS = [
  '09:00 AM', '10:00 AM', '11:00 AM',
  '01:00 PM', '02:00 PM', '03:00 PM',
  '04:00 PM', '05:00 PM', '06:00 PM',
];

function fmtBookingDate(date: Date, time: string) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]}, ${time}`;
}

export default function NewServiceRequestScreen() {
  const t = useTheme();
  const { category: initialCategory } = useLocalSearchParams<{ category?: string }>();
  const qc = useQueryClient();

  const days = useMemo(() => buildDays(7), []);

  const [phase, setPhase] = useState<Phase>('booking');
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedTime, setSelectedTime] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const category = initialCategory ?? '';
  const selectedDay = days[selectedDayIdx];

  const preferredTime = selectedTime
    ? fmtBookingDate(selectedDay.date, selectedTime)
    : undefined;

  const mutation = useMutation<{ id: string }, Error>({
    mutationFn: async () => {
      const sr = await api.post<{ id: string }>('/service-requests', {
        category,
        description: `${category} service request`,
        preferredTime,
      });
      if (photoUri) {
        try {
          setPhotoUploading(true);
          const presign = await api.post<{ url: string; key: string }>(
            `/service-requests/${sr.id}/photos/presign`,
            { contentType: 'image/jpeg' },
          );
          await uploadToPresignedUrl(photoUri, presign.url, 'image/jpeg');
          await api.post(`/service-requests/${sr.id}/photos`, { key: presign.key });
        } finally {
          setPhotoUploading(false);
        }
      }
      return sr;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['my-service-requests'] });
      setCreatedId(data.id);
      setPhase('success');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Could not book.'),
  });

  // Date is required; preferred time is optional (matches the Figma label).
  const isValid = !!selectedDay;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title={category || 'Book a Service'} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.screenPadding,
          paddingTop: 16,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Choose a Date */}
        <Text
          style={{
            fontSize: t.fontBase,
            fontWeight: '700',
            color: t.textPrimary,
            marginBottom: 14,
          }}
        >
          Choose a Date
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 24, marginHorizontal: -t.screenPadding }}
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, gap: 10 }}
        >
          {days.map((day, idx) => {
            const selected = idx === selectedDayIdx;
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => setSelectedDayIdx(idx)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Select ${day.dayLabel} ${day.dateLabel}`}
                accessibilityState={{ selected }}
                style={{
                  width: 58,
                  minHeight: 70,
                  borderRadius: rd.radiusCard,
                  borderWidth: selected ? 1.5 : 1,
                  borderColor: selected ? t.accentPrimary : rd.cardBorder,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: t.fontXs,
                    color: selected ? t.accentPrimary : t.textMuted,
                    fontWeight: '500',
                    marginBottom: 4,
                  }}
                >
                  {day.dayLabel}
                </Text>
                <Text
                  style={{
                    fontSize: t.font2xl,
                    fontWeight: '700',
                    color: selected ? t.accentPrimary : t.textPrimary,
                  }}
                >
                  {day.dateLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Time Slots */}
        <Text
          style={{
            fontSize: t.fontBase,
            fontWeight: '700',
            color: t.textPrimary,
            marginBottom: 14,
          }}
        >
          Preferred Time <Text style={{ color: t.textMuted, fontWeight: '400' }}>(Optional)</Text>
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 24,
          }}
        >
          {TIME_SLOTS.map((slot) => {
            const selected = selectedTime === slot;
            return (
              <TouchableOpacity
                key={slot}
                onPress={() => setSelectedTime(selected ? '' : slot)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Select time slot ${slot}`}
                accessibilityState={{ selected }}
                style={{
                  minHeight: t.touchTarget,
                  paddingHorizontal: 16,
                  borderRadius: rd.radiusPill,
                  borderWidth: selected ? 1.5 : 1,
                  borderColor: selected ? t.accentPrimary : rd.cardBorder,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: t.fontSm,
                    color: selected ? t.accentPrimary : t.textPrimary,
                    fontWeight: selected ? '700' : '400',
                  }}
                >
                  {slot}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
          }}
        >
          <PillButton
            label={
              mutation.isPending
                ? photoUploading
                  ? 'Uploading...'
                  : 'Confirming...'
                : 'Confirm Booking'
            }
            tone="dark"
            onPress={() => mutation.mutate()}
            loading={mutation.isPending || photoUploading}
            disabled={!isValid || mutation.isPending || photoUploading}
            accessibilityLabel="Submit service request"
          />
        </View>
      </SafeAreaView>

      {/* Success bottom sheet / modal */}
      <Modal
        visible={phase === 'success'}
        transparent
        animationType="slide"
        onRequestClose={() => router.replace('/(tabs)/services' as any)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                overflow: 'hidden',
              }}
            >
              {/* Green banner */}
              <LinearGradient
                colors={['#5FB983', '#1F7A45']}
                style={{
                  height: 160,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Close button */}
                <TouchableOpacity
                  onPress={() => router.replace('/(tabs)/services' as any)}
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Beacon */}
                <View
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: 45,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 34,
                      backgroundColor: 'rgba(255,255,255,0.25)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="checkmark" size={36} color="#FFFFFF" />
                  </View>
                </View>
              </LinearGradient>

              <SafeAreaView
                edges={['bottom']}
                style={{ paddingHorizontal: t.screenPadding, paddingTop: 20, paddingBottom: 8 }}
              >
                <Display size="md" align="left">
                  Booking Requested{'\n'}Successfully!
                </Display>

                {/* Meta rows */}
                <View style={{ marginTop: 16, marginBottom: 6, gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="calendar-outline" size={16} color={t.textMuted} />
                    <Text style={{ fontSize: t.fontSm, color: t.textSecondary }}>
                      {selectedTime
                        ? fmtBookingDate(selectedDay.date, selectedTime)
                        : `${selectedDay.dateLabel} ${selectedDay.dayLabel}`}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={t.textMuted} />
                    <Text style={{ fontSize: t.fontSm, color: t.textSecondary }}>
                      {category} Service
                    </Text>
                  </View>
                </View>

                <Text
                  style={{
                    fontSize: t.fontSm,
                    color: t.textMuted,
                    marginBottom: 20,
                  }}
                >
                  We'll notify you when booking is confirmed.
                </Text>

                <View style={{ gap: 10 }}>
                  <PillButton
                    label="Track Request"
                    tone="dark"
                    onPress={() => {
                      if (createdId) {
                        router.replace(`/services/${createdId}` as any);
                      }
                    }}
                  />
                  <PillButton
                    label="Back to Services"
                    tone="light"
                    onPress={() => router.replace('/(tabs)/services' as any)}
                  />
                </View>
              </SafeAreaView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
