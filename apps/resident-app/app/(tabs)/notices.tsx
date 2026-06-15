import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  IconCircle,
  SegmentedTabs,
  rd,
} from '../../src/components/ui';

type Tab = 'notices' | 'polls';

// Shape from GET /notices
type Notice = {
  id: string;
  title: string;
  body?: string;
  publishedAt?: string;
  createdAt?: string;
  isPinned?: boolean;
  category?: string;
};

// Shape from GET /notices/polls
type PollOption = { id: string; label: string; votes: number };
type Poll = {
  id: string;
  question: string;
  closesAt?: string;
  totalVotes: number;
  options: PollOption[];
  votedOptionId: string | null;
};

// Shape from GET /residents/birthdays
type Birthday = {
  id: string;
  name: string;
  flat: string;
  date: string; // ISO or date string
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}hrs ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function closesInDays(iso?: string): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days <= 0) return 'Closes today';
  if (days === 1) return 'Closes in 1 day';
  return `Closes in ${days} days`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function categoryIcon(category?: string): keyof typeof Ionicons.glyphMap {
  const c = (category ?? '').toLowerCase();
  if (c.includes('water') || c.includes('maintenance')) return 'water-outline';
  if (c.includes('meeting') || c.includes('general')) return 'people-outline';
  if (c.includes('security') || c.includes('gate')) return 'shield-outline';
  if (c.includes('event') || c.includes('celebrat')) return 'sparkles-outline';
  return 'megaphone-outline';
}

// Today's birthdays for the notice-board section (max 2)
function todayBirthdays(list: Birthday[]): Birthday[] {
  const today = new Date();
  return list.filter((b) => {
    const d = new Date(b.date);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
  });
}

// ----------------------------------------------------------------------------
// Main screen
// ----------------------------------------------------------------------------
export default function NoticesScreen() {
  const t = useTheme();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(tabParam === 'polls' ? 'polls' : 'notices');
  useEffect(() => {
    if (tabParam === 'polls' || tabParam === 'notices') setTab(tabParam);
  }, [tabParam]);

  const { data: notices, isLoading: noticesLoading } = useQuery({
    queryKey: ['notices'],
    queryFn: () => api.get<Notice[]>('/notices'),
    enabled: tab === 'notices',
  });

  const { data: polls, isLoading: pollsLoading } = useQuery({
    queryKey: ['polls'],
    queryFn: () => api.get<Poll[]>('/notices/polls'),
    enabled: tab === 'polls',
    retry: false,
  });

  const { data: birthdays } = useQuery({
    queryKey: ['birthdays'],
    queryFn: () => api.get<Birthday[]>('/residents/birthdays'),
    retry: false,
  });

  const isLoading = tab === 'notices' ? noticesLoading : pollsLoading;
  const noticeList: Notice[] = Array.isArray(notices) ? notices : [];
  const pollList: Poll[] = Array.isArray(polls) ? polls : [];
  const birthdayList: Birthday[] = Array.isArray(birthdays) ? birthdays : [];
  const todayBdays = todayBirthdays(birthdayList);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Notice Board" onBack={null} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { key: 'notices', label: 'Notices' },
            { key: 'polls', label: 'Polls' },
          ]}
          style={{ marginBottom: 20 }}
        />

        {isLoading ? (
          <ActivityIndicator color={t.accentPrimary} style={{ marginTop: 48 }} />
        ) : tab === 'notices' ? (
          <NoticesTab
            notices={noticeList}
            todayBdays={todayBdays}
            allBirthdays={birthdayList}
            t={t}
          />
        ) : (
          <PollsTab polls={pollList} t={t} />
        )}
      </ScrollView>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Notices tab
// ----------------------------------------------------------------------------
function NoticesTab({
  notices,
  todayBdays,
  allBirthdays,
  t,
}: {
  notices: Notice[];
  todayBdays: Birthday[];
  allBirthdays: Birthday[];
  t: ReturnType<typeof useTheme>;
}) {
  if (notices.length === 0) {
    return (
      <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginTop: 8 }}>
        <View style={{ paddingVertical: 48, alignItems: 'center' }}>
          <Display size="md" align="center">No new notices</Display>
          <Text
            style={{
              textAlign: 'center',
              color: t.textMuted,
              fontSize: t.fontBase,
              marginTop: 8,
              lineHeight: t.fontBase * 1.5,
            }}
          >
            New notices from the society will appear here.
          </Text>
        </View>
      </RoundCard>
    );
  }

  return (
    <>
      <View style={{ gap: 12 }}>
        {notices.map((notice) => (
          <NoticeCard key={notice.id} notice={notice} t={t} />
        ))}
      </View>

      {/* Birthdays section */}
      {allBirthdays.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>
              {todayBdays.length > 0 ? 'Birthdays Today' : 'Upcoming Birthdays'}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/notices/birthdays' as any)}
              accessibilityRole="button"
              accessibilityLabel="View upcoming birthdays"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: t.fontSm, fontWeight: '600', color: t.accentPrimary }}>
                Upcoming →
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ gap: 0 }}>
            {(todayBdays.length > 0 ? todayBdays : allBirthdays).slice(0, 3).map((b, i, arr) => (
              <BirthdayRow key={b.id} birthday={b} isLast={i === arr.length - 1} t={t} />
            ))}
          </View>
        </View>
      )}
    </>
  );
}

// ----------------------------------------------------------------------------
// Notice card
// ----------------------------------------------------------------------------
function NoticeCard({ notice, t }: { notice: Notice; t: ReturnType<typeof useTheme> }) {
  const dateStr = timeAgo(notice.publishedAt ?? notice.createdAt);
  return (
    <RoundCard
      tone="white"
      padding={t.cardPaddingLg}
      onPress={() => router.push((`/notices/${notice.id}`) as any)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
        <IconCircle size={44} bg={rd.crimsonSoft} icon={categoryIcon(notice.category)} color={t.accentPrimary} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 4 }}>
            {notice.title}
          </Text>
          {notice.body ? (
            <Text numberOfLines={2} style={{ fontSize: t.fontSm, color: t.textMuted, lineHeight: t.fontSm * 1.5 }}>
              {notice.body}
            </Text>
          ) : null}
          {dateStr ? (
            <Text style={{ fontSize: t.fontXs, color: t.textMuted, marginTop: 6 }}>{dateStr}</Text>
          ) : null}
        </View>
      </View>
    </RoundCard>
  );
}

// ----------------------------------------------------------------------------
// Birthday row
// ----------------------------------------------------------------------------
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
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: rd.cardBorder,
      }}
    >
      <IconCircle size={44} bg={rd.crimsonSoft}>
        <Text style={{ fontSize: t.fontSm, fontWeight: '700', color: t.accentPrimary }}>{initStr}</Text>
      </IconCircle>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>{birthday.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Ionicons name="calendar-outline" size={12} color={t.textMuted} />
          <Text style={{ fontSize: t.fontSm, color: t.textMuted }}>
            Today{'  '}•{'  '}Flat {birthday.flat}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Polls tab
// ----------------------------------------------------------------------------
function PollsTab({ polls, t }: { polls: Poll[]; t: ReturnType<typeof useTheme> }) {
  if (polls.length === 0) {
    return (
      <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginTop: 8 }}>
        <View style={{ paddingVertical: 48, alignItems: 'center' }}>
          <Display size="md" align="center">No active polls</Display>
          <Text
            style={{
              textAlign: 'center',
              color: t.textMuted,
              fontSize: t.fontBase,
              marginTop: 8,
              lineHeight: t.fontBase * 1.5,
            }}
          >
            Committee will post polls when there are community decisions to make.
          </Text>
        </View>
      </RoundCard>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      {polls.map((poll) => (
        <PollCard key={poll.id} poll={poll} t={t} />
      ))}
    </View>
  );
}

// ----------------------------------------------------------------------------
// Poll card
// ----------------------------------------------------------------------------
function PollCard({ poll, t }: { poll: Poll; t: ReturnType<typeof useTheme> }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(poll.votedOptionId ?? null);
  const [voted, setVoted] = useState(poll.votedOptionId != null);

  const voteMutation = useMutation({
    mutationFn: (optionId: string) =>
      api.post(`/notices/polls/${poll.id}/vote`, { optionId }),
    onSuccess: (updated: any) => {
      setVoted(true);
      qc.setQueryData(['polls'], (old: Poll[] | undefined) =>
        old ? old.map((p) => (p.id === poll.id ? { ...p, ...updated, votedOptionId: selectedId } : p)) : old,
      );
    },
  });

  const handleSubmit = () => {
    if (!selectedId || voted || voteMutation.isPending) return;
    voteMutation.mutate(selectedId);
  };

  const closesLabel = closesInDays(poll.closesAt);
  const meta = [closesLabel, `${poll.totalVotes} votes`].filter(Boolean).join('  •  ');

  return (
    <RoundCard tone="white" padding={t.cardPaddingLg}>
      {/* Active Poll badge */}
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: rd.amberSoft,
          borderRadius: rd.radiusPill,
          paddingHorizontal: 10,
          paddingVertical: 4,
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: t.fontXs, fontWeight: '700', color: '#9A6B00' }}>Active Poll</Text>
      </View>

      {/* Question */}
      <Display size="sm" style={{ marginBottom: 6 }}>{poll.question}</Display>

      {/* Meta */}
      {meta ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <Ionicons name="time-outline" size={13} color={t.textMuted} />
          <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>{meta}</Text>
        </View>
      ) : null}

      {/* Options */}
      <View style={{ gap: 10 }}>
        {poll.options.map((opt) => {
          const isSelected = selectedId === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => !voted && !voteMutation.isPending && setSelectedId(opt.id)}
              disabled={voted || voteMutation.isPending}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              style={{
                minHeight: t.touchTarget,
                borderRadius: rd.radiusPill,
                paddingHorizontal: 18,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: isSelected ? '#FFFFFF' : rd.inkSoft,
                borderWidth: isSelected ? 1.5 : 0,
                borderColor: isSelected ? rd.ink : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: t.fontBase,
                  color: t.textPrimary,
                  fontWeight: isSelected ? '700' : '400',
                }}
              >
                {opt.label}
              </Text>
              {isSelected ? <Ionicons name="checkmark" size={18} color={t.textPrimary} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer: either "Submit Vote" or "Vote Submitted" */}
      {voted ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <Ionicons name="checkmark-circle" size={18} color={rd.green} />
          <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: rd.green }}>Vote Submitted</Text>
        </View>
      ) : (
        <PillButton
          label={voteMutation.isPending ? 'Submitting…' : 'Submit Vote'}
          tone="dark"
          onPress={handleSubmit}
          disabled={!selectedId}
          loading={voteMutation.isPending}
          style={{ marginTop: 16 }}
        />
      )}
    </RoundCard>
  );
}
