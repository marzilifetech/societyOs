import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  IconCircle,
  rd,
} from '../../src/components/ui';

// Public Figma reference (Med Help Desk): node-id=56-6126
// API: GET /medical/doctors, GET /medical/emergency-contacts

type Doctor = {
  id: string;
  name: string;
  specialization: string;
  qualifications?: string;
  availableDays?: string[];
  nextSlot?: string;
  rating?: number;
};

type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  role: string;
};

export default function MedicalScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const t = useTheme();

  const { data: doctors, isLoading, isError, refetch: refetchDoctors } = useQuery<Doctor[]>({
    queryKey: ['doctors'],
    queryFn: () => api.get<Doctor[]>('/medical/doctors'),
  });

  const { data: contacts, refetch: refetchContacts } = useQuery<EmergencyContact[]>({
    queryKey: ['emergency-contacts'],
    queryFn: () => api.get<EmergencyContact[]>('/medical/emergency-contacts'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchDoctors(), refetchContacts()]);
    setRefreshing(false);
  };

  const sosButton = (
    <TouchableOpacity
      onPress={() => router.push('/medical/sos' as any)}
      style={{
        minHeight: t.touchTargetSm,
        backgroundColor: rd.crimson,
        borderRadius: rd.radiusPill,
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
      accessibilityRole="button"
      accessibilityLabel="Emergency SOS - call for immediate help"
    >
      <Ionicons name="warning" size={16} color="#FFFFFF" />
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: t.fontSm }}>SOS</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Medical" subtitle="Book a doctor appointment" trailing={sosButton} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={t.accentPrimary} />}
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 32 }}
      >
        {/* Book appointment CTA */}
        <RoundCard
          tone="white"
          padding={t.cardPaddingLg}
          onPress={() => router.push('/medical/book' as any)}
          style={{ marginBottom: 14 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconCircle size={52} bg={rd.crimsonSoft}>
              <MaterialCommunityIcons name="stethoscope" size={26} color={t.accentPrimary} />
            </IconCircle>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>Book Appointment</Text>
              <Text style={{ fontSize: t.fontSm, color: t.textMuted, marginTop: 2 }}>Schedule a doctor visit</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={t.textMuted} />
          </View>
        </RoundCard>

        {/* My Appointments */}
        <RoundCard
          tone="white"
          padding={t.cardPaddingLg}
          onPress={() => router.push('/medical/appointments' as any)}
          style={{ marginBottom: 24 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconCircle size={52} bg={rd.greenSoft}>
              <Ionicons name="calendar-outline" size={24} color={rd.green} />
            </IconCircle>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>My Appointments</Text>
              <Text style={{ fontSize: t.fontSm, color: t.textMuted, marginTop: 2 }}>View upcoming and past bookings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={t.textMuted} />
          </View>
        </RoundCard>

        <Display size="sm" style={{ marginBottom: 14 }}>Available Doctors</Display>

        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator color={t.accentPrimary} size="large" />
          </View>
        ) : isError ? (
          <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
            <IconCircle size={64} bg={rd.crimsonSoft}>
              <Ionicons name="alert-circle" size={32} color={rd.crimson} />
            </IconCircle>
            <Text style={{ color: t.textPrimary, fontSize: t.fontLg, fontWeight: '700', marginTop: 16, marginBottom: 16 }}>
              Failed to load doctors
            </Text>
            <PillButton label="Retry" tone="dark" onPress={() => refetchDoctors()} fullWidth={false} />
          </View>
        ) : !doctors?.length ? (
          <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
            <IconCircle size={64} bg={rd.crimsonSoft}>
              <MaterialCommunityIcons name="stethoscope" size={32} color={t.accentPrimary} />
            </IconCircle>
            <Text style={{ color: t.textPrimary, fontSize: t.fontLg, fontWeight: '700', marginTop: 16 }}>
              No doctors available
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {doctors.map((doc) => (
              <RoundCard
                key={doc.id}
                tone="white"
                padding={t.cardPaddingLg}
                onPress={() => router.push(`/medical/${doc.id}` as any)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <IconCircle size={56} bg={rd.crimsonSoft}>
                    <MaterialCommunityIcons name="stethoscope" size={28} color={t.accentPrimary} />
                  </IconCircle>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>Dr. {doc.name}</Text>
                    <Text style={{ fontSize: t.fontSm, color: t.accentPrimary, marginTop: 2 }}>{doc.specialization}</Text>
                    {doc.qualifications ? (
                      <Text style={{ fontSize: t.fontXs, color: t.textMuted, marginTop: 2 }}>{doc.qualifications}</Text>
                    ) : null}
                    {doc.nextSlot ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons name="time-outline" size={12} color={rd.green} />
                        <Text style={{ fontSize: t.fontXs, color: rd.green }}>Next: {doc.nextSlot}</Text>
                      </View>
                    ) : null}
                  </View>
                  {doc.rating ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="star" size={14} color="#F59E0B" />
                      <Text style={{ fontSize: t.fontSm, color: '#B45309', fontWeight: '600' }}>{doc.rating.toFixed(1)}</Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/medical/book', params: { doctorId: doc.id } } as any)}
                  style={{
                    marginTop: 12,
                    minHeight: t.touchTarget,
                    borderRadius: rd.radiusPill,
                    backgroundColor: rd.ink,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Book appointment with Dr. ${doc.name}`}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: t.fontSm }}>Book Appointment</Text>
                </TouchableOpacity>
              </RoundCard>
            ))}
          </View>
        )}

        {/* Emergency contacts */}
        {contacts?.length ? (
          <View style={{ marginTop: 28 }}>
            <Display size="sm" style={{ marginBottom: 14 }}>Emergency Contacts</Display>
            <RoundCard tone="pink" padding={t.cardPaddingLg}>
              {contacts.map((c, i) => (
                <View
                  key={c.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: t.touchTarget,
                    marginTop: i === 0 ? 0 : 12,
                    paddingTop: i === 0 ? 0 : 12,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: 'rgba(196,40,71,0.12)',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <IconCircle size={44} bg={rd.crimson}>
                      <Ionicons name="call" size={20} color="#FFFFFF" />
                    </IconCircle>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>{c.name}</Text>
                      <Text style={{ fontSize: t.fontXs, color: t.textMuted, marginTop: 2 }}>{c.role}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: rd.crimson }}>{c.phone}</Text>
                </View>
              ))}
            </RoundCard>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
