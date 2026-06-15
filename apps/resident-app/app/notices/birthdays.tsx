import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  IconCircle,
  rd,
} from '../../src/components/ui';

type Birthday = {
  id: string;
  name: string;
  flat: string;
  date: string; // ISO date string
};

type Group = 'Today' | 'This Week' | 'Next Week';

// -------------------------------------------------------------------------
// Grouping helpers
// -------------------------------------------------------------------------
function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const isSameDay = d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
  if (isSameDay) return 'Today';
  // Use month + day
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function groupBirthdays(list: Birthday[]): Record<Group, Birthday[]> {
  const now = new Date();
  const todayDoy = dayOfYear(now);
  const groups: Record<Group, Birthday[]> = { Today: [], 'This Week': [], 'Next Week': [] };

  for (const b of list) {
    const d = new Date(b.date);
    if (isNaN(d.getTime())) continue;
    // Use month+day comparison (ignore year for birthdays)
    const bDoy = dayOfYear(new Date(now.getFullYear(), d.getMonth(), d.getDate()));
    const diff = ((bDoy - todayDoy) + 365) % 365;
    if (diff === 0) {
      groups.Today.push(b);
    } else if (diff > 0 && diff <= 7) {
      groups['This Week'].push(b);
    } else if (diff > 7 && diff <= 14) {
      groups['Next Week'].push(b);
    }
  }

  return groups;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// -------------------------------------------------------------------------
// Screen
// -------------------------------------------------------------------------
export default function BirthdaysScreen() {
  const t = useTheme();

  const { data, isLoading } = useQuery({
    queryKey: ['birthdays'],
    queryFn: () => api.get<Birthday[]>('/residents/birthdays'),
    retry: false,
  });

  const list: Birthday[] = Array.isArray(data) ? data : [];
  const groups = groupBirthdays(list);
  const hasAny = list.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Birthdays" />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.accentPrimary} />
        </View>
      ) : !hasAny ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Display size="md" align="center">No birthdays</Display>
          <Text style={{ textAlign: 'center', color: t.textMuted, fontSize: t.fontBase, marginTop: 8, lineHeight: t.fontBase * 1.5 }}>
            Residents' birthdays will appear here when available.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 8, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {(['Today', 'This Week', 'Next Week'] as Group[]).map((group) => {
            const items = groups[group];
            if (items.length === 0) return null;
            return (
              <View key={group} style={{ marginBottom: 28 }}>
                {/* Group header */}
                <Text
                  style={{
                    fontSize: t.fontBase,
                    fontWeight: '700',
                    color: t.textMuted,
                    marginBottom: 8,
                    marginTop: 8,
                  }}
                >
                  {group}
                </Text>

                {/* Rows */}
                {items.map((b, i) => (
                  <BirthdayRow
                    key={b.id}
                    birthday={b}
                    isLast={i === items.length - 1}
                    t={t}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// -------------------------------------------------------------------------
// Birthday row
// -------------------------------------------------------------------------
function BirthdayRow({
  birthday,
  isLast,
  t,
}: {
  birthday: Birthday;
  isLast: boolean;
  t: ReturnType<typeof useTheme>;
}) {
  const initStr = initials(birthday.name);
  const dateLabel = formatDate(birthday.date);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: rd.cardBorder,
      }}
    >
      <IconCircle size={48} bg={rd.crimsonSoft}>
        <Text style={{ fontSize: t.fontSm, fontWeight: '700', color: t.accentPrimary }}>{initStr}</Text>
      </IconCircle>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>{birthday.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <Ionicons name="calendar-outline" size={12} color={t.textMuted} />
          <Text style={{ fontSize: t.fontSm, color: t.textMuted }}>
            {dateLabel}{'  '}•{'  '}Flat {birthday.flat}
          </Text>
        </View>
      </View>
    </View>
  );
}
