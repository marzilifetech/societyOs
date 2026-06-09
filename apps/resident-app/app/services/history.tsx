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
  rd,
  type RdStatusTone,
} from '../../src/components/ui';

// Figma reference: Utility Service-2.jpg (history list) / Utility Service-3.jpg (empty state)

type Tab = 'all' | 'active' | 'past';

type ServiceRequestSummary = {
  id: string;
  category: string;
  description: string;
  status: string;
  createdAt: string;
  scheduledTime?: string;
  preferredTime?: string;
  assignedTo?: { user?: { name?: string }; name?: string } | null;
  rating?: number;
};

function mapStatus(status: string): { tone: RdStatusTone; label: string } {
  switch (status) {
    case 'PENDING':
      return { tone: 'pending', label: 'Pending' };
    case 'ASSIGNED':
      return { tone: 'active', label: 'Assigned' };
    case 'IN_PROGRESS':
      return { tone: 'active', label: 'In Progress' };
    case 'COMPLETED':
      return { tone: 'resolved', label: 'Completed' };
    case 'CANCELLED':
      return { tone: 'cancelled', label: 'Cancelled' };
    case 'REJECTED':
      return { tone: 'cancelled', label: 'Rejected' };
    case 'CLOSED':
      return { tone: 'neutral', label: 'Closed' };
    default:
      return { tone: 'neutral', label: status };
  }
}

function isActive(status: string) {
  return ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(status);
}

function fmtDateTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ServiceHistoryScreen() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('all');

  const { data: requests, isLoading } = useQuery<ServiceRequestSummary[]>({
    queryKey: ['my-service-requests'],
    queryFn: () => api.get<ServiceRequestSummary[]>('/service-requests/my'),
  });

  const all = requests ?? [];

  const filtered = all.filter((r) => {
    if (tab === 'all') return true;
    if (tab === 'active') return isActive(r.status);
    return !isActive(r.status);
  });

  const isEmpty = !isLoading && filtered.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Service History" />

      {isEmpty && all.length === 0 ? (
        // Empty state (Figma: Utility Service-3.jpg)
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 40,
            gap: 10,
          }}
        >
          <Display size="lg" align="center">
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
            Book a service and it will show up here.
          </Text>
          <View style={{ marginTop: 10, width: 200 }}>
            <PillButton
              label="Book a Service"
              tone="dark"
              onPress={() => router.replace('/(tabs)/services' as any)}
            />
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: t.screenPadding,
            paddingTop: 16,
            paddingBottom: 24,
          }}
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

          {isEmpty ? (
            // Empty state for filtered tab
            <View
              style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}
            >
              <Text
                style={{
                  fontSize: t.fontBase,
                  color: t.textMuted,
                  textAlign: 'center',
                }}
              >
                No {tab === 'active' ? 'active' : 'past'} requests.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {filtered.map((req) => (
                <HistoryCard key={req.id} req={req} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function HistoryCard({ req }: { req: ServiceRequestSummary }) {
  const t = useTheme();
  const { tone, label } = mapStatus(req.status);
  const active = isActive(req.status);
  const providerName =
    req.assignedTo?.user?.name ?? req.assignedTo?.name ?? null;
  const dateStr = fmtDateTime(req.scheduledTime ?? req.createdAt);
  const ratingStr = req.rating ? `· ${'★'.repeat(req.rating)}${req.rating}` : '';

  return (
    <RoundCard tone="white" padding={t.cardPaddingLg}>
      {/* Header row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 6,
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text
            style={{
              fontSize: t.fontBase,
              fontWeight: '700',
              color: t.textPrimary,
            }}
          >
            {req.category}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 4,
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <Ionicons name="calendar-outline" size={13} color={t.textMuted} />
            <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>
              {dateStr}
            </Text>
            {providerName ? (
              <>
                <Text style={{ color: t.textMuted }}>•</Text>
                <Text
                  style={{ fontSize: t.fontXs, color: t.textMuted }}
                  numberOfLines={1}
                >
                  {providerName}
                </Text>
              </>
            ) : null}
          </View>
        </View>
        <StatusPill
          label={req.status === 'COMPLETED' && req.rating ? `Completed · ★${req.rating}` : label}
          tone={tone}
        />
      </View>

      {/* Description */}
      <Text
        numberOfLines={2}
        style={{
          fontSize: t.fontSm,
          color: t.textSecondary,
          marginBottom: 14,
          lineHeight: t.fontSm * 1.5,
        }}
      >
        {req.description}
      </Text>

      {/* Action buttons */}
      {active ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            onPress={() => router.push(`/services/${req.id}` as any)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Cancel this request"
            style={{
              flex: 1,
              minHeight: t.touchTarget,
              borderRadius: rd.radiusPill,
              borderWidth: 1,
              borderColor: 'rgba(0,0,0,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: rd.crimson, fontSize: t.fontSm, fontWeight: '600' }}>
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push(`/services/${req.id}` as any)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Track this request"
            style={{
              flex: 2,
              minHeight: t.touchTarget,
              borderRadius: rd.radiusPill,
              backgroundColor: rd.ink,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: t.fontSm, fontWeight: '700' }}>
              Track Request
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/services/new',
              params: { category: req.category },
            } as any)
          }
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Book ${req.category} again`}
          style={{
            minHeight: t.touchTarget,
            borderRadius: rd.radiusPill,
            borderWidth: 1,
            borderColor: rd.cardBorder,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: t.fontSm,
              fontWeight: '700',
              color: t.textPrimary,
            }}
          >
            Book Again
          </Text>
        </TouchableOpacity>
      )}
    </RoundCard>
  );
}
