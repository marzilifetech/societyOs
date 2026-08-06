import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  IconCircle,
  StatusPill,
  rd,
  type RdStatusTone,
} from '../../src/components/ui';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Category chips reuse the StatusPill soft-tone vocabulary; icons render in
// tinted IconCircles matching the redesign kit.
const CATEGORY_META: Record<string, { tone: RdStatusTone; icon: IoniconName; iconBg: string }> = {
  CULTURAL: { tone: 'cancelled', icon: 'color-palette-outline', iconBg: rd.crimsonSoft },
  SPORTS: { tone: 'resolved', icon: 'football-outline', iconBg: rd.greenSoft },
  MEETING: { tone: 'neutral', icon: 'people-outline', iconBg: '#EAF4FB' },
  CELEBRATION: { tone: 'pending', icon: 'sparkles-outline', iconBg: rd.amberSoft },
  WORKSHOP: { tone: 'active', icon: 'construct-outline', iconBg: rd.amberSoft },
  OTHER: { tone: 'neutral', icon: 'calendar-outline', iconBg: rd.inkSoft },
};

type EventRegistration = {
  status: 'REGISTERED' | 'WAITLISTED';
};

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

export default function EventsScreen() {
  const t = useTheme();
  const qc = useQueryClient();

  const { data: events, isLoading, isError, refetch } = useQuery<ResidentEvent[]>({
    queryKey: ['events'],
    queryFn: () => api.get<ResidentEvent[]>('/events'),
  });

  const registerMutation = useMutation<void, Error, string>({
    mutationFn: (eventId: string) => api.post<void>(`/events/${eventId}/register`, {}),
    onSuccess: (_data: void, eventId: string) => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', eventId] });
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const cancelMutation = useMutation<void, Error, string>({
    mutationFn: (eventId: string) => api.patch<void>(`/events/${eventId}/cancel-registration`, {}),
    onSuccess: (_data: void, eventId: string) => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', eventId] });
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Events" />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.accentPrimary} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <IconCircle icon="alert-circle-outline" size={64} bg={rd.crimsonSoft} color={rd.crimson} style={{ marginBottom: 16 }} />
          <Display size="md" align="center" style={{ marginBottom: 8 }}>Failed to load events</Display>
          <PillButton
            label="Retry"
            tone="dark"
            fullWidth={false}
            onPress={() => refetch()}
            style={{ marginTop: 8 }}
          />
        </View>
      ) : !events?.length ? (
        <View className="flex-1 items-center justify-center px-8">
          <IconCircle icon="sparkles-outline" size={64} bg={rd.crimsonSoft} color={t.accentPrimary} style={{ marginBottom: 16 }} />
          <Display size="md" align="center" style={{ marginBottom: 6 }}>No upcoming events</Display>
          <Text style={{ fontSize: t.fontSm, color: t.textMuted, textAlign: 'center' }}>
            When your society plans something, it will show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e: ResidentEvent) => e.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 8, paddingBottom: 32 }}
          ListHeaderComponent={<Display size="md" style={{ marginBottom: 14 }}>Upcoming Events</Display>}
          ItemSeparatorComponent={() => <View className="h-4" />}
          renderItem={({ item }: { item: ResidentEvent }) => {
            const meta = CATEGORY_META[item.category] ?? CATEGORY_META.OTHER;
            const registered = item.myRegistration?.status === 'REGISTERED';
            const waitlisted = item.myRegistration?.status === 'WAITLISTED';
            const full =
              !!item.capacity &&
              (item.registrationCount ?? 0) >= item.capacity &&
              !registered &&
              !waitlisted;
            const eventDate = new Date(item.eventDate);
            const isPast = eventDate < new Date();

            return (
              <RoundCard tone="white" padding={t.cardPaddingLg}>
                {/* Title row */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                  <IconCircle size={48} bg={meta.iconBg}>
                    <Ionicons name={meta.icon} size={22} color={rd.ink} />
                  </IconCircle>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <StatusPill label={item.category} tone={meta.tone} />
                    <Text
                      style={{ fontSize: t.fontLg, fontWeight: '700', color: t.textPrimary, marginTop: 6 }}
                    >
                      {item.title}
                    </Text>
                  </View>
                </View>

                {item.description && (
                  <Text
                    numberOfLines={2}
                    style={{ fontSize: t.fontSm, color: t.textSecondary, marginBottom: 12, lineHeight: t.fontSm * t.lineHeightBase }}
                  >
                    {item.description}
                  </Text>
                )}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="calendar-outline" size={13} color={t.textMuted} />
                    <Text style={{ fontSize: t.fontXs, color: t.textSecondary }}>
                      {eventDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  {item.eventTime && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="time-outline" size={13} color={t.textMuted} />
                      <Text style={{ fontSize: t.fontXs, color: t.textSecondary }}>{item.eventTime}</Text>
                    </View>
                  )}
                  {item.venue && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="location-outline" size={13} color={t.textMuted} />
                      <Text style={{ fontSize: t.fontXs, color: t.textSecondary }}>{item.venue}</Text>
                    </View>
                  )}
                </View>

                {item.capacity && (
                  <View style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>Registrations</Text>
                      <Text style={{ fontSize: t.fontXs, color: t.textSecondary }}>
                        {item.registrationCount ?? 0} / {item.capacity}
                      </Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: rd.inkSoft, borderRadius: rd.radiusPill, overflow: 'hidden' }}>
                      <View
                        style={{
                          height: '100%',
                          backgroundColor: t.accentPrimary,
                          borderRadius: rd.radiusPill,
                          width: `${Math.min(100, ((item.registrationCount ?? 0) / item.capacity) * 100)}%`,
                        }}
                      />
                    </View>
                  </View>
                )}

                {!isPast && (
                  <>
                    {registered && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View
                          style={{
                            flex: 1,
                            backgroundColor: rd.greenSoft,
                            borderRadius: rd.radiusPill,
                            paddingVertical: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          <Ionicons name="checkmark-circle" size={16} color={rd.green} />
                          <Text style={{ color: '#1F7A45', fontSize: t.fontSm, fontWeight: '600' }}>Registered</Text>
                        </View>
                        <TouchableOpacity
                          style={{
                            borderWidth: 1,
                            borderColor: 'rgba(0,0,0,0.12)',
                            borderRadius: rd.radiusPill,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                          }}
                          onPress={() => cancelMutation.mutate(item.id)}
                          disabled={cancelMutation.isPending}
                          accessibilityRole="button"
                          accessibilityLabel={`Cancel registration for ${item.title}`}
                        >
                          <Text style={{ color: t.textMuted, fontSize: t.fontSm }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {waitlisted && (
                      <View
                        style={{
                          backgroundColor: rd.amberSoft,
                          borderRadius: rd.radiusPill,
                          paddingVertical: 10,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: rd.amberInk, fontSize: t.fontSm, fontWeight: '600' }}>On Waitlist</Text>
                      </View>
                    )}
                    {!registered && !waitlisted && (
                      <PillButton
                        label={full ? 'Event Full' : 'Register'}
                        tone={full ? 'light' : 'dark'}
                        size="md"
                        onPress={() => registerMutation.mutate(item.id)}
                        disabled={full || registerMutation.isPending}
                        accessibilityLabel={`Register for ${item.title}`}
                      />
                    )}
                  </>
                )}
              </RoundCard>
            );
          }}
        />
      )}
    </View>
  );
}
