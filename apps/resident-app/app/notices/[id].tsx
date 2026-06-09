import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import { ErrorCard } from '../../src/components/ErrorCard';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  IconCircle,
  StatusPill,
  rd,
} from '../../src/components/ui';

type Attachment = { url: string; name?: string; mimeType?: string };

type Notice = {
  id: string;
  title: string;
  body: string;
  publishedAt?: string;
  createdAt: string;
  isPinned?: boolean;
  category?: string;
  attachments?: Attachment[];
  // Poll fields (when this notice is also a poll)
  question?: string;
  options?: string[];
  deadline?: string;
  isPoll?: boolean;
  myVote?: number | null;
};

function categoryIcon(category?: string): keyof typeof Ionicons.glyphMap {
  const c = (category ?? '').toLowerCase();
  if (c.includes('water') || c.includes('maintenance')) return 'water-outline';
  if (c.includes('meeting') || c.includes('general')) return 'people-outline';
  if (c.includes('security') || c.includes('gate')) return 'shield-outline';
  if (c.includes('event') || c.includes('celebrat')) return 'sparkles-outline';
  return 'megaphone-outline';
}

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<Notice>({
    queryKey: ['notice', id],
    queryFn: () => api.get<Notice>(`/notices/${id}`),
    enabled: !!id,
  });

  const voteMutation = useMutation({
    mutationFn: (optionIndex: number) =>
      api.post(`/notices/${id}/vote`, { options: [optionIndex] }),
    onSuccess: () => {
      setVoted(true);
      qc.invalidateQueries({ queryKey: ['notice', id] });
      qc.invalidateQueries({ queryKey: ['polls'] });
    },
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={t.accentPrimary} />
      </View>
    );
  }

  const isNotFound = isError && /404|not found/i.test((error as Error)?.message ?? '');
  if (isNotFound || (!isLoading && !isError && !data)) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader title="Notice" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <IconCircle size={64} bg={rd.inkSoft} icon="document-outline" color={t.textMuted} />
          <Display size="sm" align="center" style={{ marginTop: 16 }}>Notice not found</Display>
          <Text style={{ textAlign: 'center', color: t.textMuted, fontSize: t.fontSm, marginTop: 8 }}>
            It may have been removed by management.
          </Text>
        </View>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader title="Notice" />
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 20 }}>
          <ErrorCard message="Could not load this notice. Please try again." onRetry={() => refetch()} />
        </View>
      </View>
    );
  }

  const isPoll = data.isPoll || (Array.isArray(data.options) && data.options.length > 0);
  const deadline = data.deadline ? new Date(data.deadline) : null;
  const isExpired = deadline ? deadline < new Date() : false;
  const hasVoted = data.myVote != null || voted;
  const dateStr = (data.publishedAt ?? data.createdAt)
    ? new Date(data.publishedAt ?? data.createdAt).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Notice" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Category chip + pinned */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <IconCircle size={44} bg={rd.crimsonSoft} icon={categoryIcon(data.category)} color={t.accentPrimary} />
          {data.isPinned ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: rd.crimsonSoft,
                borderRadius: rd.radiusPill,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Ionicons name="bookmark" size={12} color={t.accentPrimary} />
              <Text style={{ fontSize: t.fontXs, fontWeight: '700', color: t.accentPrimary }}>PINNED</Text>
            </View>
          ) : null}
        </View>

        {/* Title */}
        <Display size="md" style={{ marginBottom: 6 }}>{data.title || data.question}</Display>

        {/* Date */}
        {dateStr ? (
          <Text style={{ fontSize: t.fontSm, color: t.textMuted, marginBottom: 18 }}>{dateStr}</Text>
        ) : null}

        {/* Body */}
        {data.body ? (
          <Text style={{ fontSize: t.fontBase, color: t.textSecondary, lineHeight: t.fontBase * 1.6, marginBottom: 24 }}>
            {data.body}
          </Text>
        ) : null}

        {/* Attachments */}
        {data.attachments && data.attachments.length > 0 ? (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: t.fontXs, fontWeight: '700', color: t.textMuted, letterSpacing: 0.8, marginBottom: 12 }}>
              ATTACHMENTS
            </Text>
            <View style={{ gap: 10 }}>
              {data.attachments.map((att, i) => {
                const isImage = att.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url);
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => Linking.openURL(att.url)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Open attachment ${att.name ?? i + 1}`}
                  >
                    <RoundCard tone="white" padding={12}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {isImage ? (
                          <Image source={{ uri: att.url }} style={{ width: 48, height: 48, borderRadius: 8 }} />
                        ) : (
                          <IconCircle size={48} bg={rd.crimsonSoft} icon="document-outline" color={t.accentPrimary} />
                        )}
                        <Text style={{ flex: 1, fontSize: t.fontSm, color: t.textPrimary, fontWeight: '500' }} numberOfLines={1}>
                          {att.name ?? `Attachment ${i + 1}`}
                        </Text>
                        <Ionicons name="open-outline" size={18} color={t.textMuted} />
                      </View>
                    </RoundCard>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Poll section */}
        {isPoll && data.options ? (
          <RoundCard tone="white" padding={t.cardPaddingLg}>
            <Text style={{ fontSize: t.fontXs, fontWeight: '700', color: t.textMuted, letterSpacing: 0.8, marginBottom: 12 }}>
              CAST YOUR VOTE
            </Text>

            <View style={{ gap: 10 }}>
              {data.options.map((option, i) => {
                const isSelected = selected === i;
                const isMine = data.myVote === i;
                const disabled = isExpired || hasVoted || voteMutation.isPending;
                const highlighted = isSelected || isMine;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => !disabled && setSelected(i)}
                    disabled={disabled}
                    activeOpacity={0.85}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: highlighted }}
                    style={{
                      minHeight: t.touchTarget,
                      borderRadius: rd.radiusPill,
                      paddingHorizontal: 18,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: highlighted ? '#FFFFFF' : rd.inkSoft,
                      borderWidth: highlighted ? 1.5 : 0,
                      borderColor: highlighted ? rd.ink : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: t.fontBase,
                        color: t.textPrimary,
                        fontWeight: highlighted ? '700' : '400',
                      }}
                    >
                      {option}
                    </Text>
                    {highlighted ? <Ionicons name="checkmark" size={18} color={t.textPrimary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {hasVoted ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                <Ionicons name="checkmark-circle" size={18} color={rd.green} />
                <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: rd.green }}>Vote Submitted</Text>
              </View>
            ) : isExpired ? (
              <Text style={{ textAlign: 'center', color: t.textMuted, fontSize: t.fontSm, marginTop: 14 }}>
                Voting has closed.
              </Text>
            ) : (
              <PillButton
                label={voteMutation.isPending ? 'Submitting…' : 'Submit Vote'}
                tone="dark"
                onPress={() => selected !== null && voteMutation.mutate(selected)}
                disabled={selected === null}
                loading={voteMutation.isPending}
                style={{ marginTop: 16 }}
              />
            )}

            {deadline ? (
              <Text style={{ textAlign: 'center', color: t.textMuted, fontSize: t.fontXs, marginTop: 12 }}>
                {isExpired
                  ? 'Poll closed'
                  : `Closes ${deadline.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
              </Text>
            ) : null}
          </RoundCard>
        ) : null}
      </ScrollView>
    </View>
  );
}
