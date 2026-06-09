import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { useTheme } from '../../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  rd,
} from '../../../src/components/ui';

// Figma: Reschedule Appointment (Medical Help Desk-2.jpg, Medical Help Desk-8.jpg)
// API: GET /medical/slots?doctorId&date, GET /medical/appointments/:id,
//      PATCH /medical/appointments/:id/reschedule { start }

type Slot = { timeSlot: string; available: boolean };
type AppointmentDetail = {
  id: string;
  doctorId?: string;
  doctor: { name: string; specialization?: string };
  date: string;
  timeSlot: string;
  notes?: string;
};

function getDateOptions() {
  return Array.from({ length: 7 }, (_: any, i: any) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dayAbbr = d.toLocaleDateString('en-IN', { weekday: 'short' });
    const dayNum = d.getDate();
    return {
      label: dayAbbr,
      day: String(dayNum),
      value: d.toISOString().split('T')[0],
    };
  });
}

function fmtFull(iso: string, slot: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return `${iso}, ${slot}`;
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  return `${day} ${month}, ${slot}`;
}

export default function RescheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const t = useTheme();
  const dateOptions = getDateOptions();

  const [selectedDate, setSelectedDate] = useState(dateOptions[0].value);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const { data: apt, isLoading: loadingApt } = useQuery<AppointmentDetail>({
    queryKey: ['appointment', id],
    queryFn: () => api.get<AppointmentDetail>(`/medical/appointments/${id}`),
    enabled: !!id,
  });

  const { data: slots, isLoading: loadingSlots } = useQuery<Slot[]>({
    queryKey: ['slots', apt?.doctorId ?? apt?.doctor?.name, selectedDate, 'reschedule'],
    queryFn: () => {
      const doctorId = (apt as any)?.doctorId;
      if (!doctorId) return Promise.resolve([]);
      return api.get<Slot[]>(`/medical/slots?doctorId=${doctorId}&date=${selectedDate}`);
    },
    enabled: !!apt,
  });

  const rescheduleMutation = useMutation({
    mutationFn: () => {
      // Build ISO start from date + slot (HH:MM [AM/PM])
      const d = new Date(selectedDate);
      const timeMatch = selectedSlot?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const meridiem = timeMatch[3]?.toUpperCase();
        if (meridiem === 'PM' && hours < 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
        d.setHours(hours, minutes, 0, 0);
      }
      return api.patch(`/medical/appointments/${id}/reschedule`, { start: d.toISOString(), slotId: selectedSlot });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointment', id] });
      qc.invalidateQueries({ queryKey: ['my-appointments'] });
      router.back();
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Could not reschedule.'),
  });

  const canConfirm = !!selectedSlot;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Reschedule Appointment" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Date picker */}
        <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 12 }}>
          Choose a Date
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 2, paddingRight: 4 }}>
            {dateOptions.map((opt) => {
              const selected = selectedDate === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => { setSelectedDate(opt.value); setSelectedSlot(null); }}
                  activeOpacity={0.85}
                  style={{
                    width: 64,
                    minHeight: 72,
                    borderRadius: rd.radiusCard,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? '#FFFFFF' : '#F5F5F6',
                    borderWidth: selected ? 1.5 : 1,
                    borderColor: selected ? t.accentPrimary : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <Text style={{ fontSize: t.fontXs, color: selected ? t.accentPrimary : t.textMuted, fontWeight: '600', marginBottom: 4 }}>
                    {opt.label}
                  </Text>
                  <Text style={{ fontSize: t.fontLg, fontWeight: '700', color: selected ? t.accentPrimary : t.textPrimary }}>
                    {opt.day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Slots */}
        <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 12 }}>
          Available Slots
        </Text>
        {loadingSlots ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={t.accentPrimary} />
          </View>
        ) : !slots?.length ? (
          <RoundCard tone="gray" padding={t.cardPaddingLg} style={{ alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ color: t.textMuted, fontSize: t.fontSm }}>No slots available for this date</Text>
          </RoundCard>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
            {slots.map((slot) => {
              const selected = selectedSlot === slot.timeSlot;
              return (
                <TouchableOpacity
                  key={slot.timeSlot}
                  onPress={() => slot.available && setSelectedSlot(slot.timeSlot)}
                  disabled={!slot.available}
                  activeOpacity={0.85}
                  style={{
                    minWidth: 110,
                    minHeight: t.touchTarget,
                    borderRadius: rd.radiusCard,
                    borderWidth: selected ? 1.5 : 1,
                    borderColor: selected
                      ? t.accentPrimary
                      : slot.available
                      ? 'rgba(0,0,0,0.10)'
                      : 'rgba(0,0,0,0.06)',
                    backgroundColor: selected
                      ? '#FFFFFF'
                      : slot.available
                      ? '#F5F5F6'
                      : '#F0F0F0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: slot.available ? 1 : 0.45,
                  }}
                >
                  <Text
                    style={{
                      fontSize: t.fontSm,
                      fontWeight: '600',
                      color: selected ? t.accentPrimary : slot.available ? t.textPrimary : t.textMuted,
                    }}
                  >
                    {slot.timeSlot}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Current booking details */}
        {loadingApt ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator color={t.accentPrimary} />
          </View>
        ) : apt ? (
          <RoundCard tone="gray" padding={t.cardPaddingLg}>
            <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 14 }}>
              Current Booking Details
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: apt.notes ? 12 : 0 }}>
              <Text style={{ fontSize: t.fontBase, color: t.textSecondary }}>Date & Time:</Text>
              <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>{fmtFull(apt.date, apt.timeSlot)}</Text>
            </View>
            {apt.notes ? (
              <View>
                <Text style={{ fontSize: t.fontBase, color: t.textSecondary, marginBottom: 4 }}>Description:</Text>
                <Text style={{ fontSize: t.fontBase, color: t.textPrimary, lineHeight: t.fontBase * 1.5 }}>{apt.notes}</Text>
              </View>
            ) : null}
          </RoundCard>
        ) : null}
      </ScrollView>

      {/* Footer */}
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}>
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6, gap: 10 }}>
          <PillButton
            label="Confirm Reschedule"
            tone="dark"
            onPress={() => rescheduleMutation.mutate()}
            loading={rescheduleMutation.isPending}
            disabled={!canConfirm}
          />
          <PillButton label="Go Back" tone="light" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </View>
  );
}
