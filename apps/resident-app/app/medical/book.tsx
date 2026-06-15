import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
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

// Figma: Book Appointment (Medical Help Desk-1.jpg / Medical Help Desk.jpg / Medical Help Desk-3.jpg)
// API: GET /medical/doctors, GET /medical/slots?doctorId&date, POST /medical/appointments

async function scheduleAppointmentReminder(date: string, timeSlot: string) {
  try {
    const perms = await Notifications.requestPermissionsAsync();
    if ((perms as { granted?: boolean }).granted === false) return;
    const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!timeMatch) return;
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const meridiem = timeMatch[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    const apptDate = new Date(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    const reminderDate = new Date(apptDate.getTime() - 60 * 60 * 1000);
    if (reminderDate <= new Date()) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Doctor Appointment Reminder',
        body: `Your appointment is at ${timeSlot}. Please be ready.`,
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
    });
  } catch {
    // non-critical
  }
}

type Doctor = { id: string; name: string; specialization: string };
type Slot = { timeSlot: string; available: boolean };

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

function fmtBookedDate(date: string, timeSlot: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return `${date}, ${timeSlot}`;
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  return `${day} ${month}, ${timeSlot}`;
}

export default function BookAppointmentScreen() {
  const { doctorId: paramDoctorId } = useLocalSearchParams<{ doctorId?: string }>();
  const qc = useQueryClient();
  const t = useTheme();
  const dateOptions = getDateOptions();

  const [selectedDoctorId, setSelectedDoctorId] = useState(paramDoctorId ?? '');
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].value);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [confirmedData, setConfirmedData] = useState<{ date: string; slot: string; apptId?: string } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: doctors } = useQuery<Doctor[]>({
    queryKey: ['doctors'],
    queryFn: () => api.get<Doctor[]>('/medical/doctors'),
    enabled: !paramDoctorId,
  });

  const { data: slots, isLoading: loadingSlots } = useQuery<Slot[]>({
    queryKey: ['slots', selectedDoctorId, selectedDate],
    queryFn: () => api.get<Slot[]>(`/medical/slots?doctorId=${selectedDoctorId}&date=${selectedDate}`),
    enabled: !!selectedDoctorId,
  });

  const bookMutation = useMutation({
    mutationFn: () =>
      api.post<{ id?: string }>('/medical/appointments', {
        doctorId: selectedDoctorId,
        date: selectedDate,
        timeSlot: selectedSlot,
        notes: note.trim() || undefined,
      }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['slots'] });
      qc.invalidateQueries({ queryKey: ['my-appointments'] });
      if (selectedSlot) scheduleAppointmentReminder(selectedDate, selectedSlot);
      setConfirmedData({ date: selectedDate, slot: selectedSlot!, apptId: data?.id ?? data?.data?.id });
      setShowSuccess(true);
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const canConfirm = !!selectedDoctorId && !!selectedSlot;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Book Appointment" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Doctor selection (only when not pre-selected) */}
          {!paramDoctorId && doctors?.length ? (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 12 }}>
                Select Doctor
              </Text>
              <View style={{ gap: 10 }}>
                {doctors.map((doc) => {
                  const selected = selectedDoctorId === doc.id;
                  return (
                    <TouchableOpacity
                      key={doc.id}
                      onPress={() => { setSelectedDoctorId(doc.id); setSelectedSlot(null); }}
                      activeOpacity={0.85}
                      style={{
                        borderRadius: rd.radiusCard,
                        padding: t.cardPadding,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        backgroundColor: selected ? '#FFFFFF' : '#F5F5F6',
                        borderWidth: selected ? 1.5 : 0,
                        borderColor: selected ? t.accentPrimary : 'transparent',
                      }}
                    >
                      <IconCircle size={44} bg={rd.crimsonSoft}>
                        <Ionicons name="medkit" size={20} color={t.accentPrimary} />
                      </IconCircle>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>Dr. {doc.name}</Text>
                        <Text style={{ fontSize: t.fontSm, color: t.textMuted, marginTop: 2 }}>{doc.specialization}</Text>
                      </View>
                      {selected ? <Ionicons name="checkmark-circle" size={22} color={t.accentPrimary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Notes for doctor */}
          <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 10 }}>
            Notes for Doctor (optional)
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Any symptoms or context to share..."
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
              marginBottom: 24,
            }}
          />

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
          {!selectedDoctorId ? (
            <RoundCard tone="gray" padding={t.cardPaddingLg} style={{ alignItems: 'center' }}>
              <Text style={{ color: t.textMuted, fontSize: t.fontSm }}>Select a doctor to view available slots</Text>
            </RoundCard>
          ) : loadingSlots ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator color={t.accentPrimary} />
            </View>
          ) : !slots?.length ? (
            <RoundCard tone="gray" padding={t.cardPaddingLg} style={{ alignItems: 'center' }}>
              <Text style={{ color: t.textMuted, fontSize: t.fontSm }}>No slots available for this date</Text>
            </RoundCard>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
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
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}>
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6 }}>
          <PillButton
            label="Confirm Booking"
            tone="dark"
            onPress={() => bookMutation.mutate()}
            loading={bookMutation.isPending}
            disabled={!canConfirm}
          />
        </View>
      </SafeAreaView>

      {/* Success overlay (bottom sheet style) */}
      <Modal
        visible={showSuccess}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSuccess(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
            {/* Green header band */}
            <View style={{ backgroundColor: rd.greenSoft, paddingTop: 32, paddingBottom: 24, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => setShowSuccess(false)}
                style={{ position: 'absolute', top: 12, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={18} color={t.textPrimary} />
              </TouchableOpacity>
              {/* Green beacon */}
              <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(46,158,91,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(46,158,91,0.20)', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: rd.green, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark" size={36} color="#FFFFFF" />
                  </View>
                </View>
              </View>
            </View>

            <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 20, paddingBottom: 8 }}>
              <Display size="md">Appointment booked successfully!</Display>
              {confirmedData ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 20 }}>
                  <Ionicons name="calendar-outline" size={16} color={t.textMuted} />
                  <Text style={{ fontSize: t.fontSm, color: t.textMuted }}>
                    {fmtBookedDate(confirmedData.date, confirmedData.slot)}
                  </Text>
                </View>
              ) : <View style={{ marginBottom: 20 }} />}

              <View style={{ gap: 10 }}>
                <PillButton
                  label="View Appointment"
                  tone="dark"
                  onPress={() => {
                    setShowSuccess(false);
                    if (confirmedData?.apptId) {
                      router.push(`/medical/appointments/${confirmedData.apptId}` as any);
                    } else {
                      router.push('/medical/appointments' as any);
                    }
                  }}
                />
                <PillButton
                  label="Go Back"
                  tone="light"
                  onPress={() => {
                    setShowSuccess(false);
                    router.back();
                  }}
                />
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
