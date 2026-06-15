import { useState } from 'react';
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
  SegmentedTabs,
  StatusPill,
  rd,
  type RdStatusTone,
} from '../../src/components/ui';

// Figma refs: Complaints Management-8.jpg (list), -9.jpg (empty state)
// Data: GET /complaints/my, filtered client-side by tab.

type Tab = 'all' | 'active' | 'past';

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

function isActiveStatus(raw?: string): boolean {
  const s = (raw ?? '').toUpperCase();
  return ['OPEN', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS'].includes(s);
}

function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ComplaintHistoryScreen() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('all');

  const { data } = useQuery({
    queryKey: ['my-complaints'],
    queryFn: () => api.get<any[]>('/complaints/my'),
  });

  const all = Array.isArray(data) ? data : [];

  const filtered = all.filter((c) => {
    if (tab === 'all') return true;
    if (tab === 'active') return isActiveStatus(c.status);
    return !isActiveStatus(c.status);
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Complaint History" />

      {all.length === 0 ? (
        /* Empty state */
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Display size="lg" align="center">No complaints yet</Display>
          <Text
            style={{
              textAlign: 'center',
              color: t.textMuted,
              fontSize: t.fontBase,
              marginTop: 10,
              lineHeight: t.fontBase * 1.5,
            }}
          >
            Raise a complaint and it will show up here.
          </Text>
          <PillButton
            label="Raise a Complaint"
            tone="dark"
            onPress={() => router.push('/complaints' as any)}
            style={{ marginTop: 24, width: 200 }}
            fullWidth={false}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 32 }}
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

          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Text style={{ fontSize: t.fontBase, color: t.textMuted }}>
                No {tab === 'active' ? 'active' : 'past'} complaints.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {filtered.map((item) => {
                const { tone, label } = mapStatus(item.status);
                const active = isActiveStatus(item.status);
                return (
                  <RoundCard key={item.id} tone="white" padding={t.cardPaddingLg}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                      }}
                    >
                      <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, flex: 1, marginRight: 10 }}>
                        {item.category ?? item.title ?? 'Complaint'}
                      </Text>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <StatusPill label={label} tone={tone} />
                        {item.rating ? (
                          <Text style={{ fontSize: t.fontXs, color: rd.amberInk }}>★{item.rating}</Text>
                        ) : null}
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: item.description ? 6 : 0 }}>
                      <Ionicons name="calendar-outline" size={13} color={t.textMuted} />
                      <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>
                        {fmtDateTime(item.createdAt)}
                        {item.assignedStaff ? ` • ${item.assignedStaff}` : ''}
                      </Text>
                    </View>

                    {item.description ? (
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: t.fontSm, color: t.textSecondary, marginBottom: active ? 14 : 0 }}
                      >
                        {item.description}
                      </Text>
                    ) : null}

                    {active && (
                      <PillButton
                        label="Track Complaint"
                        tone="dark"
                        onPress={() => router.push(`/complaints/${item.id}` as any)}
                        accessibilityLabel={`Track complaint ${item.id}`}
                        style={{ marginTop: 10 }}
                      />
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
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6 }}>
          <PillButton label="Back to Complaints" tone="dark" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </View>
  );
}
