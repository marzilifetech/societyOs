import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
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
} from '../../src/components/ui';

// Request History screen — Figma SegmentedTabs (All / Active / Past)
// Fetches GET /help-requests and filters client-side — no separate history endpoint needed.

type HelpRequest = {
  id: string;
  category: string;
  description: string;
  urgency?: string;
  status: string;
  createdAt: string;
  preferredTime?: string;
  staffName?: string;
};

type Tab = 'all' | 'active' | 'past';

function mapStatus(raw: string): { tone: RdStatusTone; label: string } {
  const s = raw?.toUpperCase() ?? '';
  if (s === 'RESOLVED' || s === 'COMPLETED') return { tone: 'resolved', label: 'Completed' };
  if (s === 'CANCELLED' || s === 'CANCELED') return { tone: 'cancelled', label: 'Cancelled' };
  if (s === 'ASSIGNED' || s === 'IN_PROGRESS' || s === 'ACKNOWLEDGED') return { tone: 'active', label: 'In Progress' };
  if (s === 'OPEN') return { tone: 'pending', label: 'Requested' };
  return { tone: 'neutral', label: raw ?? 'Unknown' };
}

function isActiveStatus(status: string): boolean {
  const s = status?.toUpperCase() ?? '';
  return s === 'OPEN' || s === 'ASSIGNED' || s === 'IN_PROGRESS' || s === 'ACKNOWLEDGED';
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function HelpRequestHistoryScreen() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('all');

  const { data, isLoading } = useQuery<HelpRequest[]>({
    queryKey: ['help-requests'],
    queryFn: () => api.get<HelpRequest[]>('/help-requests'),
    retry: false,
    initialData: [],
  });

  const items = Array.isArray(data) ? data : [];

  const filtered = items.filter((item) => {
    if (tab === 'all') return true;
    if (tab === 'active') return isActiveStatus(item.status);
    return !isActiveStatus(item.status);
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Request History" />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.textMuted, fontSize: t.fontBase }}>Loading…</Text>
        </View>
      ) : items.length === 0 ? (
        /* Empty state */
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <IconCircle size={72} bg={rd.inkSoft}>
            <Ionicons name="reader-outline" size={36} color={t.textMuted} />
          </IconCircle>
          <Display size="sm" align="center" style={{ marginTop: 18, marginBottom: 10 }}>
            No requests yet
          </Display>
          <Text
            style={{
              textAlign: 'center',
              color: t.textMuted,
              fontSize: t.fontBase,
              lineHeight: t.fontBase * 1.6,
            }}
          >
            Your staff help requests will appear here once submitted.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 24 }}
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
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Text style={{ color: t.textMuted, fontSize: t.fontBase }}>
                No {tab === 'active' ? 'active' : 'past'} requests
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {filtered.map((item) => {
                const status = mapStatus(item.status);
                const active = isActiveStatus(item.status);
                return (
                  <RoundCard
                    key={item.id}
                    tone="white"
                    padding={t.cardPaddingLg}
                    onPress={() => router.push(`/help-requests/${item.id}` as any)}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text
                          numberOfLines={1}
                          style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}
                        >
                          {item.category}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                          <Ionicons name="calendar-outline" size={13} color={t.textMuted} />
                          <Text style={{ fontSize: t.fontSm, color: t.textMuted }}>
                            {fmtDate(item.createdAt)}
                          </Text>
                        </View>
                      </View>
                      <StatusPill label={status.label} tone={status.tone} />
                    </View>

                    {item.description ? (
                      <Text
                        numberOfLines={2}
                        style={{ fontSize: t.fontSm, color: t.textSecondary, marginTop: 4 }}
                      >
                        {item.description}
                      </Text>
                    ) : null}

                    {active && (
                      <TouchableOpacity
                        onPress={() => router.push(`/help-requests/${item.id}` as any)}
                        style={{ marginTop: 12, alignSelf: 'flex-start' }}
                      >
                        <Text style={{ fontSize: t.fontSm, fontWeight: '700', color: t.textPrimary }}>
                          Track →
                        </Text>
                      </TouchableOpacity>
                    )}
                  </RoundCard>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      <SafeAreaView
        edges={['bottom']}
        style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}
      >
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6, gap: 10 }}>
          <PillButton
            label="Request Help"
            tone="dark"
            onPress={() => router.push('/help-requests/new' as any)}
          />
          <PillButton label="Back" tone="light" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </View>
  );
}
