import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
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

// Figma reference: Complaints Management (Complaints Management.jpg, -1.jpg, -2.jpg)
// Home screen: category grid + active complaints list.

type IoniconName = keyof typeof Ionicons.glyphMap;

// Each category carries its own icon tint. Previously every glyph rendered in
// near-black on top of a tinted circle, so the colour coding did nothing and
// the grid read as flatter and duller than the Quick Actions grid on Home,
// which tints glyph and circle together.
const BLUE_SOFT = '#EAF4FB';
const BLUE_INK = '#0284C7';
const VIOLET_SOFT = '#EDE9FE';
const VIOLET_INK = '#7C3AED';

const CATEGORIES: { icon: IoniconName; label: string; bg: string; tint: string }[] = [
  { icon: 'volume-high-outline', label: 'Noise', bg: rd.crimsonSoft, tint: rd.crimson },
  { icon: 'car-outline', label: 'Parking', bg: rd.crimsonSoft, tint: rd.crimson },
  { icon: 'sparkles-outline', label: 'Cleanliness', bg: rd.greenSoft, tint: rd.green },
  { icon: 'water-outline', label: 'Water', bg: BLUE_SOFT, tint: BLUE_INK },
  { icon: 'construct-outline', label: 'Maintenance', bg: VIOLET_SOFT, tint: VIOLET_INK },
  { icon: 'people-outline', label: 'Neighbour', bg: rd.greenSoft, tint: rd.green },
  { icon: 'business-outline', label: 'Community', bg: BLUE_SOFT, tint: BLUE_INK },
  { icon: 'paw-outline', label: 'Pets', bg: rd.amberSoft, tint: rd.amberInk },
  { icon: 'help-circle-outline', label: 'Other', bg: BLUE_SOFT, tint: BLUE_INK },
];

function mapStatus(raw?: string): { tone: RdStatusTone; label: string } {
  const s = (raw ?? '').toUpperCase();
  if (s === 'OPEN') return { tone: 'pending', label: 'Raised' };
  if (s === 'UNDER_REVIEW') return { tone: 'active', label: 'Under Review' };
  if (s === 'ASSIGNED') return { tone: 'active', label: 'Assigned' };
  if (s === 'IN_PROGRESS') return { tone: 'active', label: 'In Progress' };
  if (s === 'RESOLVED' || s === 'CLOSED') return { tone: 'resolved', label: 'Resolved' };
  if (s === 'REJECTED' || s === 'CANCELLED') return { tone: 'cancelled', label: 'Cancelled' };
  return { tone: 'neutral', label: raw ?? 'Unknown' };
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ComplaintsScreen() {
  const t = useTheme();

  const historyBtn = (
    <TouchableOpacity
      onPress={() => router.push('/complaints/history' as any)}
      accessibilityRole="button"
      accessibilityLabel="View complaint history"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name="time-outline" size={24} color={t.textPrimary} />
    </TouchableOpacity>
  );
  const { data: complaints } = useQuery({
    queryKey: ['my-complaints'],
    queryFn: () => api.get<any[]>('/complaints/my'),
  });

  const active = (Array.isArray(complaints) ? complaints : []).filter(
    (c) => !['RESOLVED', 'CLOSED', 'REJECTED', 'CANCELLED'].includes(c.status ?? ''),
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Complaints" trailing={historyBtn} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Raise a Complaint section */}
        <Display size="md" style={{ marginBottom: 16 }}>Raise a Complaint</Display>

        {/* 2-col category grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
          {CATEGORIES.map((cat) => (
            <RoundCard
              key={cat.label}
              tone="white"
              padding={t.cardPaddingLg}
              onPress={() =>
                router.push({ pathname: '/complaints/new', params: { category: cat.label } } as any)
              }
              style={{ width: '47%', alignItems: 'center', paddingVertical: 20 }}
            >
              <IconCircle size={56} bg={cat.bg}>
                <Ionicons name={cat.icon} size={26} color={cat.tint} />
              </IconCircle>
              <Text
                style={{
                  marginTop: 12,
                  fontSize: t.fontSm,
                  fontWeight: '600',
                  color: t.textPrimary,
                  textAlign: 'center',
                }}
              >
                {cat.label}
              </Text>
            </RoundCard>
          ))}
        </View>

        {/* Active Complaints section */}
        {active.length > 0 && (
          <>
            <Display size="md" style={{ marginBottom: 14 }}>Active Complaints</Display>
            <View style={{ gap: 14 }}>
              {active.map((item) => {
                const { tone, label } = mapStatus(item.status);
                return (
                  <RoundCard key={item.id} tone="white" padding={t.cardPaddingLg}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>
                          {item.category ?? item.title ?? 'Complaint'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                          <Ionicons name="calendar-outline" size={13} color={t.textMuted} />
                          <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>
                            {fmtDate(item.createdAt)}
                          </Text>
                        </View>
                      </View>
                      <StatusPill label={label} tone={tone} />
                    </View>
                    {item.description ? (
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: t.fontSm, color: t.textSecondary, marginBottom: 14 }}
                      >
                        {item.description}
                      </Text>
                    ) : null}
                    <PillButton
                      label="Track Complaint"
                      tone="dark"
                      onPress={() => router.push(`/complaints/${item.id}` as any)}
                      accessibilityLabel={`Track complaint ${item.id}`}
                    />
                  </RoundCard>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
