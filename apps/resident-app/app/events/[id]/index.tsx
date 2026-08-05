import { View, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';
import { useTheme } from '../../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  IconCircle,
  StatusPill,
  rd,
  type RdStatusTone,
} from '../../../src/components/ui';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Category chips reuse the StatusPill soft-tone vocabulary (see events/index).
const CATEGORY_META: Record<string, { tone: RdStatusTone; icon: IoniconName; iconBg: string }> = {
  CULTURAL: { tone: 'cancelled', icon: 'color-palette-outline', iconBg: rd.crimsonSoft },
  SPORTS: { tone: 'resolved', icon: 'football-outline', iconBg: rd.greenSoft },
  MEETING: { tone: 'neutral', icon: 'people-outline', iconBg: '#EAF4FB' },
  CELEBRATION: { tone: 'pending', icon: 'sparkles-outline', iconBg: rd.amberSoft },
  WORKSHOP: { tone: 'active', icon: 'construct-outline', iconBg: rd.amberSoft },
  OTHER: { tone: 'neutral', icon: 'calendar-outline', iconBg: rd.inkSoft },
};

type EventRegistration = { status: 'REGISTERED' | 'WAITLISTED' };

type ResidentEvent = {
  id: string;
  title: string;
  description?: string;
  category: string;
  eventDate: string;
  eventTime?: string;
  venue?: string;
  capacity?: number;
  registrationCount?: number;
  myRegistration?: EventRegistration | null;
};

export default function EventDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: event, isLoading } = useQuery<ResidentEvent>({
    queryKey: ['event', id],
    queryFn: () => api.get<ResidentEvent>(`/events/${id}`),
    enabled: !!id,
  });

  const registerMutation = useMutation<void, Error>({
    mutationFn: () => api.post<void>(`/events/${id}/register`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', id] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const cancelMutation = useMutation<void, Error>({
    mutationFn: () => api.patch<void>(`/events/${id}/cancel-registration`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', id] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  if (isLoading || !event) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader title="Event Details" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.accentPrimary} />
        </View>
      </View>
    );
  }

  const meta = CATEGORY_META[event.category] ?? CATEGORY_META.OTHER;
  const registered = event.myRegistration?.status === 'REGISTERED';
  const waitlisted = event.myRegistration?.status === 'WAITLISTED';
  const full =
    !!event.capacity &&
    (event.registrationCount ?? 0) >= event.capacity &&
    !registered &&
    !waitlisted;
  const eventDate = new Date(event.eventDate);
  const isPast = eventDate < new Date();

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Event Details" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 8, paddingBottom: 40 }}
      >
        {/* Title */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 }}>
          <IconCircle size={56} bg={meta.iconBg}>
            <Ionicons name={meta.icon} size={26} color={rd.ink} />
          </IconCircle>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <StatusPill label={event.category} tone={meta.tone} />
            <Display size="md" style={{ marginTop: 8 }}>{event.title}</Display>
          </View>
        </View>

        {/* Key facts */}
        <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginBottom: 16 }}>
          <View style={{ gap: 14 }}>
            <FactRow
              icon="calendar-outline"
              label="Date"
              value={eventDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            />
            {event.eventTime ? <FactRow icon="time-outline" label="Time" value={event.eventTime} /> : null}
            {event.venue ? <FactRow icon="location-outline" label="Venue" value={event.venue} /> : null}
            {event.capacity ? (
              <FactRow
                icon="people-outline"
                label="Capacity"
                value={`${event.registrationCount ?? 0} / ${event.capacity} registered`}
              />
            ) : null}
          </View>
        </RoundCard>

        {event.capacity && (
          <View style={{ marginBottom: 16 }}>
            <View style={{ height: 8, backgroundColor: rd.inkSoft, borderRadius: rd.radiusPill, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  backgroundColor: t.accentPrimary,
                  borderRadius: rd.radiusPill,
                  width: `${Math.min(100, ((event.registrationCount ?? 0) / event.capacity) * 100)}%`,
                }}
              />
            </View>
          </View>
        )}

        {event.description && (
          <RoundCard tone="gray" padding={t.cardPaddingLg} style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: t.fontXs,
                color: t.textMuted,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              About
            </Text>
            <Text style={{ fontSize: t.fontBase, color: t.textSecondary, lineHeight: t.fontBase * t.lineHeightBase }}>
              {event.description}
            </Text>
          </RoundCard>
        )}

        {!isPast && (
          <View style={{ gap: 12 }}>
            {registered && (
              <>
                <RoundCard tone="green" padding={t.cardPadding} style={{ alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={18} color={rd.green} />
                    <Text style={{ color: '#1F7A45', fontSize: t.fontBase, fontWeight: '600' }}>
                      You're registered
                    </Text>
                  </View>
                </RoundCard>
                <PillButton
                  label="Cancel Registration"
                  tone="light"
                  onPress={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  loading={cancelMutation.isPending}
                />
              </>
            )}
            {waitlisted && (
              <View
                style={{
                  backgroundColor: rd.amberSoft,
                  borderRadius: rd.radiusCard,
                  paddingVertical: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: rd.amberInk, fontSize: t.fontBase, fontWeight: '600' }}>
                  You're on the waitlist
                </Text>
              </View>
            )}
            {!registered && !waitlisted && (
              <PillButton
                label={full ? 'Event Full' : 'Register'}
                tone={full ? 'light' : 'dark'}
                onPress={() => registerMutation.mutate()}
                disabled={full || registerMutation.isPending}
                loading={registerMutation.isPending}
              />
            )}
          </View>
        )}

        {isPast && registered && (
          <PillButton
            label="Give Feedback"
            tone="dark"
            onPress={() => router.push(`/events/${id}/feedback` as any)}
            style={{ marginTop: 8 }}
          />
        )}
      </ScrollView>
    </View>
  );
}

function FactRow({ icon, label, value }: { icon: IoniconName; label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={16} color={t.textMuted} style={{ marginTop: 2 }} />
      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={{ fontSize: t.fontXs, color: t.textMuted, marginBottom: 1 }}>{label}</Text>
        <Text style={{ fontSize: t.fontSm, fontWeight: '600', color: t.textPrimary }}>{value}</Text>
      </View>
    </View>
  );
}
