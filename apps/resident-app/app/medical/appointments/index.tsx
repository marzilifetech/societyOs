import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';
import { useTheme } from '../../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  SegmentedTabs,
  StatusPill,
  IconCircle,
  rd,
  type RdStatusTone,
} from '../../../src/components/ui';

// Figma: Appointment History (Medical Help Desk-14.jpg, Medical Help Desk-15.jpg)
// API: GET /medical/appointments/mine

type Appointment = {
  id: string;
  doctor: { name: string; designation?: string; specialization?: string };
  date: string;
  timeSlot: string;
  status: 'BOOKED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes?: string;
  reason?: string;
  rating?: number;
};

type Tab = 'all' | 'active' | 'past';

function mapStatus(status: Appointment['status']): { tone: RdStatusTone; label: string } {
  switch (status) {
    case 'BOOKED':
    case 'CONFIRMED':
      return { tone: 'pending', label: 'Upcoming' };
    case 'COMPLETED':
      return { tone: 'resolved', label: 'Completed' };
    case 'CANCELLED':
      return { tone: 'cancelled', label: 'Cancelled' };
    case 'NO_SHOW':
      return { tone: 'neutral', label: 'No-show' };
    default:
      return { tone: 'neutral', label: status };
  }
}

const isUpcoming = (s: Appointment['status']) => s === 'BOOKED' || s === 'CONFIRMED';

function fmtDateTime(iso: string, slot: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return `${iso}, ${slot}`;
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  return `${d.getDate()} ${month} ${d.getFullYear()}, ${slot}`;
}

export default function AppointmentHistoryScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data: appointments, isLoading, isError, refetch } = useQuery<Appointment[]>({
    queryKey: ['my-appointments'],
    queryFn: () => api.get<Appointment[]>('/medical/appointments/mine'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const items = appointments ?? [];

  const filtered = items.filter((a) => {
    if (tab === 'all') return true;
    if (tab === 'active') return isUpcoming(a.status);
    return !isUpcoming(a.status);
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Appointment History" />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.accentPrimary} size="large" />
        </View>
      ) : isError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <IconCircle size={64} bg={rd.amberSoft}>
            <Ionicons name="warning" size={32} color="#B45309" />
          </IconCircle>
          <Text style={{ color: t.textPrimary, fontSize: t.fontLg, fontWeight: '700', marginTop: 16, marginBottom: 16 }}>
            Failed to load appointments
          </Text>
          <PillButton label="Retry" tone="dark" onPress={() => refetch()} fullWidth={false} />
        </View>
      ) : items.length === 0 ? (
        /* Empty state */
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Display size="lg" align="center">No appointments yet</Display>
          <Text style={{ textAlign: 'center', color: t.textMuted, fontSize: t.fontBase, marginTop: 10, lineHeight: t.fontBase * 1.5, marginBottom: 28 }}>
            Book an appointment and it will show up here.
          </Text>
          <PillButton
            label="Book an Appointment"
            tone="dark"
            fullWidth={false}
            onPress={() => router.push('/medical/book' as any)}
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={t.accentPrimary} />}
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 32 }}
        >
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'past', label: 'Past' },
            ]}
            style={{ marginBottom: 18 }}
          />

          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ color: t.textMuted, fontSize: t.fontBase }}>No appointments in this category</Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {filtered.map((apt) => {
                const status = mapStatus(apt.status);
                const upcoming = isUpcoming(apt.status);
                const done = apt.status === 'COMPLETED';
                return (
                  <RoundCard
                    key={apt.id}
                    tone="white"
                    padding={t.cardPaddingLg}
                    onPress={() => router.push(`/medical/appointments/${apt.id}` as any)}
                  >
                    {/* Header row */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, flex: 1, marginRight: 12 }}>
                        Medical Appointment
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <StatusPill label={status.label} tone={status.tone} />
                        {done && apt.rating ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: rd.greenSoft, borderRadius: rd.radiusPill, paddingHorizontal: 8, paddingVertical: 4 }}>
                            <Ionicons name="star" size={12} color={rd.green} />
                            <Text style={{ fontSize: t.fontXs, fontWeight: '700', color: rd.green }}>{apt.rating}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Date + time */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Ionicons name="calendar-outline" size={14} color={t.textMuted} />
                      <Text style={{ fontSize: t.fontSm, color: t.textMuted }}>{fmtDateTime(apt.date, apt.timeSlot)}</Text>
                    </View>

                    {/* Note / reason */}
                    {(apt.reason || apt.notes) ? (
                      <Text style={{ fontSize: t.fontSm, color: t.textSecondary, marginBottom: 8 }} numberOfLines={1}>
                        {apt.reason ?? apt.notes}
                      </Text>
                    ) : null}

                    {/* Action buttons */}
                    {upcoming ? (
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation?.(); router.push(`/medical/appointments/${apt.id}` as any); }}
                          style={{
                            flex: 1,
                            minHeight: t.touchTarget,
                            borderRadius: rd.radiusPill,
                            borderWidth: 1,
                            borderColor: rd.crimson,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Cancel appointment"
                        >
                          <Text style={{ fontSize: t.fontSm, fontWeight: '700', color: rd.crimson }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation?.(); router.push({ pathname: '/medical/appointments/reschedule', params: { id: apt.id } } as any); }}
                          style={{
                            flex: 1,
                            minHeight: t.touchTarget,
                            borderRadius: rd.radiusPill,
                            backgroundColor: rd.ink,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Reschedule appointment"
                        >
                          <Text style={{ fontSize: t.fontSm, fontWeight: '700', color: '#FFFFFF' }}>Reschedule</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={(e) => { e.stopPropagation?.(); router.push('/medical/book' as any); }}
                        style={{
                          marginTop: 10,
                          minHeight: t.touchTarget,
                          borderRadius: rd.radiusPill,
                          borderWidth: 1,
                          borderColor: 'rgba(0,0,0,0.12)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Book Again"
                      >
                        <Text style={{ fontSize: t.fontSm, fontWeight: '700', color: t.textPrimary }}>Book Again</Text>
                      </TouchableOpacity>
                    )}
                  </RoundCard>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
