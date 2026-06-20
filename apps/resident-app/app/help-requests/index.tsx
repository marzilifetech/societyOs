import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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

// Staff Help Request Home — Figma "Staff Help Request.jpg"
// Categories: Package Pickup, Heavy Lifting, Document Collect, Elderly Assist, Minor Fix, Other Help
// Active Requests section with StatusPill + Track button
// History icon trailing

type HelpRequest = {
  id: string;
  category?: string;
  type?: string;
  description: string;
  urgency?: string;
  status: string;
  createdAt: string;
  preferredTime?: string;
  staffName?: string;
};

type IoniconName = keyof typeof Ionicons.glyphMap;

const CATEGORIES: {
  value: string;
  label: string;
  icon: IoniconName;
  subtitle: string;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    value: 'Package Pickup',
    label: 'Package Pickup',
    icon: 'cube-outline',
    subtitle: 'Collect a parcel or package',
    iconBg: '#E8F5E9',
    iconColor: '#2E7D32',
  },
  {
    value: 'Heavy Lifting',
    label: 'Heavy Lifting',
    icon: 'barbell-outline',
    subtitle: 'Move furniture or appliances',
    iconBg: '#FFF8E1',
    iconColor: '#F57F17',
  },
  {
    value: 'Document Collect',
    label: 'Document Collect',
    icon: 'document-text-outline',
    subtitle: 'Pick up letters or documents',
    iconBg: '#E3F2FD',
    iconColor: '#1565C0',
  },
  {
    value: 'Elderly Assist',
    label: 'Elderly Assist',
    icon: 'accessibility-outline',
    subtitle: 'Help getting around',
    iconBg: '#FFF3E0',
    iconColor: '#E65100',
  },
  {
    value: 'Minor Fix',
    label: 'Minor Fix',
    icon: 'construct-outline',
    subtitle: 'Small repairs in the flat',
    iconBg: '#F5F5F5',
    iconColor: '#616161',
  },
  {
    value: 'Other Help',
    label: 'Other Help',
    icon: 'help-circle-outline',
    subtitle: 'Any other help needed',
    iconBg: '#E8EAF6',
    iconColor: '#283593',
  },
];

function mapStatus(raw: string): { tone: RdStatusTone; label: string } {
  const s = raw?.toUpperCase() ?? '';
  if (s === 'RESOLVED' || s === 'COMPLETED') return { tone: 'resolved', label: 'Completed' };
  if (s === 'CANCELLED' || s === 'CANCELED') return { tone: 'cancelled', label: 'Cancelled' };
  if (s === 'ASSIGNED' || s === 'IN_PROGRESS' || s === 'ACKNOWLEDGED') return { tone: 'active', label: 'In Progress' };
  if (s === 'OPEN') return { tone: 'pending', label: 'Requested' };
  return { tone: 'neutral', label: raw ?? 'Unknown' };
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function HelpRequestsScreen() {
  const t = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery<HelpRequest[]>({
    queryKey: ['concierge-requests'],
    queryFn: () => api.get<HelpRequest[]>('/concierge/my'),
    retry: false,
    initialData: [],
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const activeRequests = (data ?? []).filter((r) => {
    const s = r.status?.toUpperCase();
    return s === 'OPEN' || s === 'ASSIGNED' || s === 'IN_PROGRESS' || s === 'ACKNOWLEDGED';
  });

  const historyBtn = (
    <TouchableOpacity
      onPress={() => router.push('/help-requests/history' as any)}
      accessibilityRole="button"
      accessibilityLabel="View request history"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{
        width: t.touchTargetSm,
        height: t.touchTargetSm,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name="history" size={24} color={t.textPrimary} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Concierge" trailing={historyBtn} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={t.accentPrimary} />}
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 24 }}
      >
        {/* Category grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
          {CATEGORIES.map((cat) => (
            <RoundCard
              key={cat.value}
              tone="white"
              onPress={() => router.push({ pathname: '/help-requests/new', params: { category: cat.value } } as any)}
              style={{ width: '47%' }}
            >
              <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                <IconCircle size={56} bg={cat.iconBg}>
                  <Ionicons name={cat.icon} size={28} color={cat.iconColor} />
                </IconCircle>
                <Text
                  style={{
                    marginTop: 10,
                    fontSize: t.fontBase,
                    fontWeight: '600',
                    color: t.textPrimary,
                    textAlign: 'center',
                  }}
                >
                  {cat.label}
                </Text>
              </View>
            </RoundCard>
          ))}
        </View>

        {/* Active Requests section */}
        {!isLoading && activeRequests.length > 0 && (
          <>
            <Text
              style={{
                fontSize: t.fontLg,
                fontWeight: '700',
                color: t.textPrimary,
                marginBottom: 14,
              }}
            >
              Active Requests
            </Text>
            <View style={{ gap: 12 }}>
              {activeRequests.map((item) => {
                const status = mapStatus(item.status);
                const label = item.category ?? item.type ?? 'Request';
                const cat = CATEGORIES.find((c) => c.value === label);
                return (
                  <RoundCard key={item.id} tone="white" padding={t.cardPaddingLg}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>
                          {label}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                          <Ionicons name="calendar-outline" size={13} color={t.textMuted} />
                          <Text style={{ fontSize: t.fontSm, color: t.textMuted }}>
                            {fmtDate(item.createdAt)}
                            {item.staffName ? ` · ${item.staffName}` : ''}
                          </Text>
                        </View>
                      </View>
                      <StatusPill label={status.label} tone={status.tone} />
                    </View>

                    {item.description ? (
                      <Text
                        numberOfLines={2}
                        style={{ fontSize: t.fontSm, color: t.textSecondary, marginBottom: 12 }}
                      >
                        {item.description}
                      </Text>
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <PillButton
                        label="Track Request"
                        tone="dark"
                        size="md"
                        fullWidth={false}
                        style={{ flex: 1 }}
                        onPress={() => router.push(`/help-requests/${item.id}` as any)}
                      />
                    </View>
                  </RoundCard>
                );
              })}
            </View>
          </>
        )}

        {!isLoading && activeRequests.length === 0 && (data ?? []).length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 12 }}>
            <IconCircle size={64} bg={rd.inkSoft}>
              <Ionicons name="help-circle-outline" size={32} color={t.textMuted} />
            </IconCircle>
            <Display size="sm" align="center" style={{ marginTop: 14 }}>
              No active requests
            </Display>
            <Text
              style={{
                textAlign: 'center',
                color: t.textMuted,
                fontSize: t.fontSm,
                marginTop: 8,
                lineHeight: t.fontSm * 1.6,
              }}
            >
              Select a category above to request help from staff
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
