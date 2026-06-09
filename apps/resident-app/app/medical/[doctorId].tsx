import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
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

// API: GET /medical/doctors/:id

type Review = { id: string; rating: number; comment?: string; residentName: string; createdAt: string };
type DoctorDetail = {
  id: string;
  name: string;
  specialization: string;
  qualifications?: string;
  availableDays?: string[];
  bio?: string;
  avgRating?: number;
  ratingCount?: number;
  reviews?: Review[];
};

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons key={s} name="star" size={14} color={s <= rating ? '#F59E0B' : '#E5E7EB'} />
      ))}
    </View>
  );
}

export default function DoctorProfileScreen() {
  const { doctorId } = useLocalSearchParams<{ doctorId: string }>();
  const t = useTheme();

  const { data: doctor, isLoading, isError, refetch } = useQuery<DoctorDetail>({
    queryKey: ['doctor', doctorId],
    queryFn: () => api.get<DoctorDetail>(`/medical/doctors/${doctorId}`),
    enabled: !!doctorId,
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Doctor Profile" />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.accentPrimary} size="large" />
        </View>
      ) : isError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <IconCircle size={64} bg={rd.crimsonSoft}>
            <Ionicons name="alert-circle" size={32} color={rd.crimson} />
          </IconCircle>
          <Text style={{ color: t.textPrimary, fontSize: t.fontLg, fontWeight: '700', marginTop: 16, marginBottom: 16 }}>Failed to load</Text>
          <PillButton label="Retry" tone="dark" onPress={() => refetch()} fullWidth={false} />
        </View>
      ) : doctor ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 40 }}
        >
          {/* Profile card */}
          <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginBottom: 14, alignItems: 'center' }}>
            <IconCircle size={80} bg={rd.crimsonSoft} style={{ marginBottom: 14 }}>
              <MaterialCommunityIcons name="stethoscope" size={40} color={t.accentPrimary} />
            </IconCircle>
            <Display size="md" align="center">Dr. {doctor.name}</Display>
            <Text style={{ color: t.accentPrimary, fontSize: t.fontBase, textAlign: 'center', marginTop: 4 }}>
              {doctor.specialization}
            </Text>
            {doctor.qualifications ? (
              <Text style={{ color: t.textMuted, fontSize: t.fontSm, textAlign: 'center', marginTop: 2 }}>
                {doctor.qualifications}
              </Text>
            ) : null}
            {doctor.avgRating ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <StarRow rating={Math.round(doctor.avgRating)} />
                <Text style={{ fontSize: t.fontSm, color: t.textMuted }}>
                  {doctor.avgRating.toFixed(1)} ({doctor.ratingCount} reviews)
                </Text>
              </View>
            ) : null}
          </RoundCard>

          {doctor.bio ? (
            <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <IconCircle size={32} bg={rd.crimsonSoft}>
                  <Ionicons name="information-circle-outline" size={16} color={t.accentPrimary} />
                </IconCircle>
                <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>About</Text>
              </View>
              <Text style={{ fontSize: t.fontBase, color: t.textSecondary, lineHeight: t.fontBase * 1.55 }}>{doctor.bio}</Text>
            </RoundCard>
          ) : null}

          {doctor.availableDays?.length ? (
            <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <IconCircle size={32} bg={rd.greenSoft}>
                  <Ionicons name="calendar-outline" size={16} color={rd.green} />
                </IconCircle>
                <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>Available Days</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {doctor.availableDays.map((d) => (
                  <View
                    key={d}
                    style={{
                      backgroundColor: rd.crimsonSoft,
                      borderRadius: rd.radiusPill,
                      paddingHorizontal: 14,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ fontSize: t.fontSm, fontWeight: '600', color: t.accentPrimary }}>{d}</Text>
                  </View>
                ))}
              </View>
            </RoundCard>
          ) : null}

          {/* Reviews */}
          {doctor.reviews?.length ? (
            <View style={{ marginBottom: 16 }}>
              <Display size="sm" style={{ marginBottom: 12 }}>Patient Reviews</Display>
              <View style={{ gap: 10 }}>
                {doctor.reviews.map((r) => (
                  <RoundCard key={r.id} tone="white" padding={t.cardPadding}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>{r.residentName}</Text>
                      <StarRow rating={r.rating} />
                    </View>
                    {r.comment ? (
                      <Text style={{ fontSize: t.fontSm, color: t.textSecondary, lineHeight: t.fontSm * 1.5 }}>{r.comment}</Text>
                    ) : null}
                  </RoundCard>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : null}

      {/* Footer */}
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}>
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6 }}>
          <PillButton
            label="Book Appointment"
            tone="dark"
            icon="calendar-outline"
            onPress={() => router.push({ pathname: '/medical/book', params: { doctorId: doctor?.id } } as any)}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
