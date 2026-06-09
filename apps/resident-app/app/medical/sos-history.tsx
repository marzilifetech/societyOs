import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
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
  rd,
  type RdStatusTone,
} from '../../src/components/ui';

// Figma reference: Medical SOS history (node-id=22-1418, frames "SOS History").
// There is no resident-facing SOS history endpoint yet — this fetches
// /sos/history defensively and falls back to the empty state until one exists.

type Tab = 'all' | 'active' | 'past';
type HistoryItem = { id: string; title: string; date: string; duration: string; status: RdStatusTone; statusLabel: string };

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}
function fmtDuration(sec?: number): string {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  return `${String(m).padStart(2, '0')} min ${String(sec % 60).padStart(2, '0')} sec`;
}

function mapStatus(raw?: string): { tone: RdStatusTone; label: string } {
  const s = (raw ?? '').toUpperCase();
  if (s.includes('CANCEL') || s.includes('FALSE')) return { tone: 'cancelled', label: 'Cancelled' };
  if (s.includes('RESOLVE')) return { tone: 'resolved', label: 'Resolved' };
  if (s.includes('ACTIVE') || s.includes('PENDING') || s.includes('ACK')) return { tone: 'active', label: 'Active' };
  return { tone: 'neutral', label: raw ?? 'Unknown' };
}

export default function SosHistoryScreen() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('all');

  const { data } = useQuery({
    queryKey: ['sos-history'],
    queryFn: () => api.get<any[]>('/sos/history'),
    retry: false,
  });

  const items: HistoryItem[] = (Array.isArray(data) ? data : []).map((a: any) => {
    const status = mapStatus(a.status);
    return {
      id: String(a.id),
      title: a.note || a.reason || a.title || 'Emergency Alert',
      date: fmtDate(a.createdAt || a.triggeredAt),
      duration: fmtDuration(a.durationSec ?? a.duration),
      status: status.tone,
      statusLabel: status.label,
    };
  });

  const filtered = items.filter((i) =>
    tab === 'all' ? true : tab === 'active' ? i.status === 'active' : i.status !== 'active',
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="SOS History" />

      {items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Display size="lg" align="center">No alerts yet</Display>
          <Text style={{ textAlign: 'center', color: t.textMuted, fontSize: t.fontBase, marginTop: 10, lineHeight: t.fontBase * 1.5 }}>
            SOS history will appear here if you ever send an alert.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
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
          <View style={{ gap: 14 }}>
            {filtered.map((item) => (
              <RoundCard key={item.id} tone="white" padding={t.cardPaddingLg}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text numberOfLines={1} style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>
                      {item.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                      <Ionicons name="calendar-outline" size={14} color={t.textMuted} />
                      <Text style={{ fontSize: t.fontSm, color: t.textMuted }}>{item.date}</Text>
                      <Text style={{ color: t.textMuted }}>•</Text>
                      <Ionicons name="time-outline" size={14} color={t.textMuted} />
                      <Text style={{ fontSize: t.fontSm, color: t.textMuted }}>{item.duration}</Text>
                    </View>
                  </View>
                  <StatusPill label={item.statusLabel} tone={item.status} />
                </View>
              </RoundCard>
            ))}
          </View>
        </ScrollView>
      )}

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}>
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6 }}>
          <PillButton label="Back to SOS" tone="dark" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </View>
  );
}
