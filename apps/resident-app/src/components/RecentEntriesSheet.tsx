import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

type Visitor = {
  id: string;
  name: string;
  phone?: string | null;
  photoUrl?: string | null;
  type?: 'GUEST' | 'DELIVERY';
  deliveryPartner?: string | null;
  status?: string | null;
  approvalStatus?: string | null;
  createdAt: string;
  entryAt?: string | null;
};

/**
 * Bottom-sheet style list of recent entries. Opens from the RecentEntriesCard
 * on Home. Uses native React Native Modal (no extra deps) with a slide-up
 * animation and dimmed backdrop — same proven pattern the NotificationPrimer
 * uses across the app.
 *
 * Each row: avatar, name + type/partner chip, time + status pill. Tapping a
 * row routes to the full visitor detail.
 *
 * Snapshot-style: receives `visitors` from the caller (already filtered to
 * last-24h + sorted desc) so the sheet itself stays presentational.
 */
export function RecentEntriesSheet({
  visible,
  onClose,
  visitors,
}: {
  visible: boolean;
  onClose: () => void;
  visitors: Visitor[];
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable onPress={onClose} style={styles.backdrop} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <SafeAreaView edges={['bottom']}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Recent entries</Text>
              <Text style={styles.subtitle}>
                {visitors.length} {visitors.length === 1 ? 'arrival' : 'arrivals'} in the last 24 hours
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <View style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#374151" />
              </View>
            </Pressable>
          </View>

          {visitors.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people" size={36} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No entries yet today</Text>
              <Text style={styles.emptySub}>Visitors will show up here the moment they enter.</Text>
            </View>
          ) : (
            <FlatList
              data={visitors}
              keyExtractor={(v) => v.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
              ItemSeparatorComponent={() => (
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: '#F3F4F6', marginLeft: 64 }} />
              )}
              renderItem={({ item }) => (
                <Row
                  visitor={item}
                  onPress={() => {
                    onClose();
                    router.push(`/visitor/${item.id}` as any);
                  }}
                />
              )}
              showsVerticalScrollIndicator={false}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function Row({ visitor, onPress }: { visitor: Visitor; onPress: () => void }) {
  const isDelivery = visitor.type === 'DELIVERY';
  const status = visitor.approvalStatus ?? visitor.status ?? '';
  const badge = statusBadge(status);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      {visitor.photoUrl ? (
        <Image source={{ uri: visitor.photoUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Ionicons
            name={isDelivery ? 'cube' : 'person'}
            size={22}
            color="#9CA3AF"
          />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.rowTopLine}>
          <Text style={styles.name} numberOfLines={1}>
            {visitor.name}
          </Text>
          {isDelivery ? (
            <View style={styles.partnerPill}>
              <Text style={styles.partnerPillText} numberOfLines={1}>
                {visitor.deliveryPartner ?? 'Delivery'}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {formatEntryTime(visitor.entryAt ?? visitor.createdAt)}
          {visitor.phone ? ` • ${visitor.phone}` : ''}
        </Text>
      </View>
      {badge ? (
        <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusPillText, { color: badge.fg }]} numberOfLines={1}>
            {badge.label}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function statusBadge(s: string): { bg: string; fg: string; label: string } | null {
  switch (s) {
    case 'APPROVED':
    case 'CHECKED_IN':
      return { bg: '#DCFCE7', fg: '#15803D', label: 'Approved' };
    case 'LEFT_AT_SECURITY':
      return { bg: '#FED7AA', fg: '#9A3412', label: 'At security' };
    case 'REJECTED':
    case 'DENIED':
      return { bg: '#FEE2E2', fg: '#B91C1C', label: 'Rejected' };
    case 'PENDING':
      return { bg: '#FEF3C7', fg: '#92400E', label: 'Awaiting' };
    case 'CHECKED_OUT':
      return { bg: '#F3F4F6', fg: '#4B5563', label: 'Left' };
    default:
      return null;
  }
}

function formatEntryTime(iso: string): string {
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h ago`;
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 8 },
  emptySub: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    minHeight: 68,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '700', color: '#111827', flexShrink: 1 },
  partnerPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    maxWidth: 140,
  },
  partnerPillText: { fontSize: 10, fontWeight: '800', color: '#92400E', letterSpacing: 0.4 },
  meta: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },
});
