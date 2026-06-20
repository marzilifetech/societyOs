import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

// Figma reference: Utility Service.jpg / Utility Service-1.jpg

type ServiceRequestSummary = {
  id: string;
  category: string;
  description: string;
  status: string;
  createdAt: string;
  preferredTime?: string;
  scheduledTime?: string;
  assignedTo?: { user?: { name?: string }; name?: string } | null;
};

type IoniconName = keyof typeof Ionicons.glyphMap;

const CATEGORIES: {
  label: string;
  icon: IoniconName;
  bg: string;
  iconColor: string;
}[] = [
  { label: 'Plumber', icon: 'water-outline', bg: '#E8F4FD', iconColor: '#0EA5E9' },
  { label: 'Carpenter', icon: 'hammer-outline', bg: '#FBF3E4', iconColor: '#A16207' },
  { label: 'Electrician', icon: 'flash-outline', bg: '#FFFAEB', iconColor: '#D97706' },
  { label: 'Painter', icon: 'color-palette-outline', bg: '#F3F0FF', iconColor: '#7C3AED' },
  { label: 'Appliance Repair', icon: 'construct-outline', bg: '#FFF1F2', iconColor: '#E11D48' },
];

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

function fmtDateTime(iso: string) {
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

export default function ServicesScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: requests } = useQuery<ServiceRequestSummary[]>({
    queryKey: ['my-service-requests'],
    queryFn: () => api.get<ServiceRequestSummary[]>('/service-requests/my'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/service-requests/${id}/cancel`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-service-requests'] }),
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Could not cancel request.'),
  });

  const handleCancel = (id: string) => {
    Alert.alert('Cancel request?', 'Are you sure you want to cancel this request?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate(id) },
    ]);
  };

  const active = requests?.filter(
    (r) => !['COMPLETED', 'CLOSED', 'REJECTED', 'CANCELLED'].includes(r.status),
  ) ?? [];

  const historyBtn = (
    <TouchableOpacity
      onPress={() => router.push('/services/history' as any)}
      accessibilityRole="button"
      accessibilityLabel="View service history"
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

  const filteredCategories = CATEGORIES.filter((c) =>
    search.trim() === '' ? true : c.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Services" trailing={historyBtn} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.screenPadding,
          paddingTop: 14,
          paddingBottom: 32,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: rd.inkSoft,
            borderRadius: rd.radiusInput,
            paddingHorizontal: 14,
            marginBottom: 20,
            minHeight: t.touchTarget,
          }}
        >
          <Ionicons name="search-outline" size={18} color={t.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search services..."
            placeholderTextColor={t.textMuted}
            style={{
              flex: 1,
              marginLeft: 10,
              fontSize: t.fontBase,
              color: t.textPrimary,
            }}
            accessibilityLabel="Search service categories"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={t.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category grid — 2-col RoundCards matching Figma */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
          {filteredCategories.map((cat) => (
            <CategoryCard
              key={cat.label}
              cat={cat}
              onPress={() =>
                router.push({ pathname: '/services/new', params: { category: cat.label } } as any)
              }
            />
          ))}
        </View>

        {/* Active Requests */}
        {active.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <Display size="sm">Active Requests</Display>
              <TouchableOpacity
                onPress={() => router.push('/services/history' as any)}
                accessibilityRole="button"
                accessibilityLabel="Show all service requests"
              >
                <Text
                  style={{
                    fontSize: t.fontSm,
                    color: t.accentPrimary,
                    fontWeight: '600',
                  }}
                >
                  View all →
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              {active.map((req) => (
                <ActiveRequestCard key={req.id} req={req} onCancel={handleCancel} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function CategoryCard({
  cat,
  onPress,
}: {
  cat: (typeof CATEGORIES)[number];
  onPress: () => void;
}) {
  const t = useTheme();
  // Two columns with gap=12 and horizontal padding = screenPadding*2
  // We approximate 50% minus gap. Use flex instead.
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Book ${cat.label} service`}
      style={{ width: '47.5%' }}
    >
      <RoundCard tone="white" padding={0} style={{ overflow: 'hidden' }}>
        {/* Icon area */}
        <View
          style={{
            backgroundColor: cat.bg,
            height: 110,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconCircle size={56} bg={cat.iconColor + '22'}>
            <Ionicons name={cat.icon} size={28} color={cat.iconColor} />
          </IconCircle>
        </View>
        {/* Label */}
        <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
          <Text
            style={{
              fontSize: t.fontBase,
              fontWeight: '700',
              color: t.textPrimary,
            }}
          >
            {cat.label}
          </Text>
        </View>
      </RoundCard>
    </TouchableOpacity>
  );
}

function ActiveRequestCard({ req, onCancel }: { req: ServiceRequestSummary; onCancel: (id: string) => void }) {
  const t = useTheme();
  const { tone, label } = mapStatus(req.status);
  const providerName =
    req.assignedTo?.user?.name ?? req.assignedTo?.name ?? null;
  const dateStr = req.scheduledTime
    ? fmtDateTime(req.scheduledTime)
    : fmtDateTime(req.createdAt);

  return (
    <RoundCard tone="white" padding={t.cardPaddingLg}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
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
                <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>
                  {providerName}
                </Text>
              </>
            ) : null}
          </View>
        </View>
        <StatusPill label={label} tone={tone} />
      </View>

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

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          onPress={() => onCancel(req.id)}
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
    </RoundCard>
  );
}
